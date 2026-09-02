import { beforeEach, describe, expect, it } from "vitest";
import type { SessionUser } from "@/lib/contracts/auth";
import { SearchQuery } from "@/lib/contracts/search";
import { __resetUsage, quotaFor } from "@/server/repositories/usage-repository";
import { isMeteredSearch, searchInfluencers, signatureOf } from "./search-service";

const NOW = new Date("2026-08-26T09:00:00.000Z");

const freeClient: SessionUser = {
  id: "usr_free", email: "hello@lumen.example", name: "Tomas Berg", avatarUrl: null,
  role: "client_owner", orgId: "org_test_free", orgName: "Lumen", orgKind: "client",
  plan: "free", influencerId: null,
};

const staff: SessionUser = {
  ...freeClient,
  id: "usr_staff", role: "manager", orgId: "org_platform", orgKind: "platform", plan: "enterprise",
};

const query = (overrides: Partial<SearchQuery> = {}) =>
  SearchQuery.parse({ ...overrides });

beforeEach(() => __resetUsage());

describe("metering rules", () => {
  it("does not charge for browsing the unfiltered directory", () => {
    expect(isMeteredSearch(query())).toBe(false);
  });

  it("charges for a keyword search", () => {
    expect(isMeteredSearch(query({ q: "technology" }))).toBe(true);
  });

  it("charges for a filtered search with no keyword", () => {
    expect(isMeteredSearch(query({ category: ["fashion"] }))).toBe(true);
  });

  it("does not charge again for paging or re-sorting the same search", () => {
    const first = query({ q: "fashion", page: 1 });
    const nextPage = query({ q: "fashion", page: 3, sort: "followers_desc" });
    expect(isMeteredSearch(nextPage, signatureOf(first))).toBe(false);
  });

  it("charges when the filters actually change", () => {
    const first = query({ q: "fashion" });
    const changed = query({ q: "fashion", country: ["IN"] });
    expect(isMeteredSearch(changed, signatureOf(first))).toBe(true);
  });

  it("treats reordered array filters as the same search", () => {
    const a = query({ category: ["fashion", "beauty"] });
    const b = query({ category: ["beauty", "fashion"] });
    expect(signatureOf(a)).toBe(signatureOf(b));
  });
});

/*
 * These exercise the real search path, which loads and scores every creator in
 * the database. That is the point — the quota must be counted against a real
 * search, not a stub — but it means the first call pays for reading a store
 * that is now tens of megabytes, which overruns the 5s default.
 */
describe("free plan allowance — Architecture doc §3", { timeout: 60_000 }, () => {
  it("permits exactly five searches and then blocks the sixth", async () => {
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      const result = await searchInfluencers(
        freeClient,
        query({ q: `search-${attempt}` }),
        { now: NOW },
      );
      expect(result.charged).toBe(true);
      expect(result.quota.remaining).toBe(5 - attempt);
    }

    await expect(
      searchInfluencers(freeClient, query({ q: "search-6" }), { now: NOW }),
    ).rejects.toMatchObject({ code: "quota_exceeded" });
  });

  it("keeps unfiltered browsing available after the allowance is spent", async () => {
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      await searchInfluencers(freeClient, query({ q: `s${attempt}` }), { now: NOW });
    }
    const browse = await searchInfluencers(freeClient, query(), { now: NOW });
    expect(browse.charged).toBe(false);
    expect(browse.page.items.length).toBeGreaterThan(0);
  });

  it("does not meter platform staff against a client plan", async () => {
    for (let attempt = 1; attempt <= 8; attempt += 1) {
      const result = await searchInfluencers(staff, query({ q: `s${attempt}` }), { now: NOW });
      expect(result.charged).toBe(false);
    }
  });

  it("resets the counter when the billing month rolls over", async () => {
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      await searchInfluencers(freeClient, query({ q: `s${attempt}` }), { now: NOW });
    }
    const nextMonth = new Date("2026-09-01T00:00:00.000Z");
    const result = await searchInfluencers(freeClient, query({ q: "fresh" }), { now: nextMonth });
    expect(result.charged).toBe(true);
    expect(quotaFor(freeClient.orgId, "free", nextMonth).used).toBe(1);
  });

  it("reports unlimited allowance for enterprise rather than a number", () => {
    const quota = quotaFor("org_any", "enterprise", NOW);
    expect(quota.limit).toBeNull();
    expect(quota.remaining).toBeNull();
  });
});

describe("filtering and ranking", () => {
  it("returns real, scored records from the pipeline", async () => {
    const result = await searchInfluencers(staff, query({ pageSize: 5 }), { now: NOW });
    expect(result.page.items).toHaveLength(5);
    for (const item of result.page.items) {
      expect(item.healthScore).toBeGreaterThanOrEqual(0);
      expect(item.healthScore).toBeLessThanOrEqual(100);
      expect(item.confidence).toBeGreaterThanOrEqual(0);
    }
  });

  it("honours a health floor", async () => {
    const result = await searchInfluencers(staff, query({ healthMin: 70 }), { now: NOW });
    for (const item of result.page.items) {
      expect(item.healthScore ?? 0).toBeGreaterThanOrEqual(70);
    }
  });

  it("excludes unmeasured metrics from a minimum threshold", async () => {
    const result = await searchInfluencers(staff, query({ engagementMin: 1 }), { now: NOW });
    for (const item of result.page.items) {
      expect(item.engagementRate).not.toBeNull();
    }
  });

  it("intersects multi-token keywords instead of widening the result set", async () => {
    const broad = await searchInfluencers(staff, query({ q: "technology" }), { now: NOW });
    const narrow = await searchInfluencers(
      staff,
      query({ q: "technology india" }),
      { now: NOW },
    );
    expect(narrow.page.total).toBeLessThanOrEqual(broad.page.total);
  });

  it("keeps facet counts stable across pages of one result set", async () => {
    const first = await searchInfluencers(staff, query({ pageSize: 5, page: 1 }), { now: NOW });
    const second = await searchInfluencers(staff, query({ pageSize: 5, page: 2 }), { now: NOW });
    expect(first.facets).toEqual(second.facets);
  });

  it("clamps a page beyond the end rather than returning nothing", async () => {
    const result = await searchInfluencers(
      staff,
      query({ pageSize: 10, page: 9999 }),
      { now: NOW },
    );
    expect(result.page.page).toBe(result.page.totalPages);
    expect(result.page.items.length).toBeGreaterThan(0);
  });

  it("sorts by followers when asked", async () => {
    const result = await searchInfluencers(
      staff,
      query({ sort: "followers_desc", pageSize: 20 }),
      { now: NOW },
    );
    const followers = result.page.items.map((item) => item.followers ?? 0);
    expect([...followers].sort((a, b) => b - a)).toEqual(followers);
  });
});
