import { describe, expect, it, vi } from "vitest";
import type { SessionUser } from "@/lib/contracts/auth";

const participant = (influencerId: string, agreedRate: number | null, posts = 2) => ({
  influencerId, agreedRate, currency: "INR",
  performance: { attributedPosts: posts },
});

vi.mock("@/server/repositories/workspace-repository", () => ({
  listCampaigns: () => [{ id: "c1" }, { id: "c2" }],
  getCampaign: (_u: SessionUser, id: string) =>
    id === "c1"
      ? { id: "c1", name: "First", startsOn: "2026-01-01", participants: [participant("a", 100_000), participant("b", 300_000)] }
      : { id: "c2", name: "Second", startsOn: "2026-06-01", participants: [participant("a", 200_000, 4)] },
}));
vi.mock("@/server/repositories/influencer-repository", () => ({
  toSummary: (id: string) => ({ id, categories: ["beauty"], followers: 2_000_000 }),
}));

const USER = { orgId: "org_x" } as SessionUser;

describe("rate intelligence", () => {
  it("reports what was agreed, its trend and cost per post", async () => {
    const { rateIntelligence } = await import("./rate-service");
    const rates = rateIntelligence(USER, "a");
    expect(rates.observed.agreements).toBe(2);
    expect(rates.observed.medianRate).toBe(150_000);
    expect(rates.observed.latestRate).toBe(200_000); // newest campaign first
    // 200k over 4 posts, 100k over 2 posts — both 50k, so the median is 50k.
    expect(rates.observed.medianCostPerPost).toBe(50_000);
    expect(rates.observed.trendPct).toBe(100);
    // A real rate exists, so no modelled one is offered beside it.
    expect(rates.estimated).toBeNull();
  });

  it("withholds a comparable median below three peers, and never models over an observation", async () => {
    const { rateIntelligence } = await import("./rate-service");
    const rates = rateIntelligence(USER, "a");
    // Only one peer (b) in the cohort — not enough to publish.
    expect(rates.comparable.sampleSize).toBe(1);
    expect(rates.comparable.published).toBe(false);
    expect(rates.comparable.medianRate).toBeNull();
  });

  it("offers the modelled range only when nothing was agreed", async () => {
    const { rateIntelligence } = await import("./rate-service");
    const model = { currency: "USD", low: 10, high: 50 };
    expect(rateIntelligence(USER, "never_hired", model).estimated).toEqual(model);
    expect(rateIntelligence(USER, "a", model).estimated).toBeNull();
  });
});
