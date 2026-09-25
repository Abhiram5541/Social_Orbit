import { describe, expect, it, vi } from "vitest";
import type { SessionUser } from "@/lib/contracts/auth";

const CONTENT = [
  { id: "p1", influencerId: "i1", title: "Range day with the new gun", caption: "", url: "u1", publishedAt: "2026-09-01T00:00:00.000Z" },
  { id: "p2", influencerId: "i1", title: "Shot on iPhone", caption: "a gun shot sound effect", url: "u2", publishedAt: "2026-08-01T00:00:00.000Z" },
  { id: "p3", influencerId: "i1", title: "Begun a new series", caption: "", url: "u3", publishedAt: "2026-07-01T00:00:00.000Z" },
  { id: "p4", influencerId: "i1", title: "Vegan recipes", caption: "plant based cooking", url: "u4", publishedAt: "2026-06-01T00:00:00.000Z" },
];

vi.mock("@/server/data/records", () => ({
  readRecords: () => ({
    influencers: [{ id: "i1", bio: "Outdoors and cooking channel" }],
    content: CONTENT,
  }),
}));

const USER = { orgId: "org_x" } as SessionUser;

describe("rules engine", () => {
  it("matches whole words only, and an exception on the same post cancels it", async () => {
    const svc = await import("./rules-service");
    svc.createRule(USER, {
      kind: "brand_safety", name: "Firearms", label: null, severity: "review",
      scope: "content", terms: ["gun"], exceptions: ["sound effect"], minMatches: 1, enabled: true, campaignId: null,
    });
    const report = svc.evaluateCreator(USER, "i1");
    const hit = report.hits[0];
    // p1 matches; p2 is cancelled by the exception; p3 "Begun" is not "gun".
    expect(hit.matches).toBe(1);
    expect(hit.evidence[0].contentId).toBe("p1");
    expect(report.verdict).toBe("review");
    // Every flag carries the version of the rule that judged it.
    expect(hit.ruleVersion).toBe(1);
  });

  it("reports how much was read, so 'no hits' is not confused with 'nothing looked at'", async () => {
    const svc = await import("./rules-service");
    const report = svc.evaluateCreator(USER, "i1");
    expect(report.postsScanned).toBe(4);
    expect(report.bioScanned).toBe(true);
    const empty = svc.evaluateCreator(USER, "unknown_creator");
    expect(empty.postsScanned).toBe(0);
  });

  it("applies classifier labels and versions a rule when its terms change", async () => {
    const svc = await import("./rules-service");
    const rule = svc.createRule(USER, {
      kind: "classifier", name: "Plant based", label: "Vegan", severity: "note",
      scope: "content", terms: ["vegan"], exceptions: [], minMatches: 1, enabled: true, campaignId: null,
    });
    expect(svc.evaluateCreator(USER, "i1").labels).toContain("Vegan");

    const same = svc.updateRule(USER, rule.id, {
      kind: "classifier", name: "Plant based diets", label: "Vegan", severity: "note",
      scope: "content", terms: ["vegan"], exceptions: [], minMatches: 1, enabled: true, campaignId: null,
    });
    // Renaming is not a new judgement.
    expect(same.version).toBe(1);

    const changed = svc.updateRule(USER, rule.id, {
      kind: "classifier", name: "Plant based diets", label: "Vegan", severity: "note",
      scope: "content", terms: ["vegan", "plant based"], exceptions: [], minMatches: 1, enabled: true, campaignId: null,
    });
    // Changing the terms is.
    expect(changed.version).toBe(2);
  });

  it("requires minMatches distinct posts before firing", async () => {
    const svc = await import("./rules-service");
    svc.createRule(USER, {
      kind: "brand_safety", name: "Pattern", label: null, severity: "block",
      scope: "content", terms: ["vegan"], exceptions: [], minMatches: 3, enabled: true, campaignId: null,
    });
    const report = svc.evaluateCreator(USER, "i1");
    // One post mentions it; the rule asked for three.
    expect(report.hits.some((hit) => hit.ruleName === "Pattern")).toBe(false);
  });
});
