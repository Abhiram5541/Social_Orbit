import { describe, expect, it, vi } from "vitest";

const PROFILES: Record<string, { contentCount: number; medianViews: number | null }> = {
  steady: { contentCount: 40, medianViews: 100_000 },
  thin: { contentCount: 2, medianViews: 50_000 },
  noviews: { contentCount: 30, medianViews: null },
};

vi.mock("@/server/repositories/influencer-repository", () => ({
  toProfile: (id: string) =>
    PROFILES[id] ? { glance: PROFILES[id], health: { value: 80, sufficient: true, weightCovered: 0.6 } } : null,
  toSummary: (id: string) =>
    PROFILES[id]
      ? { id, displayName: id, engagementRate: 5, categories: ["beauty"], countryCode: "IN", countryName: "India" }
      : null,
}));
vi.mock("@/server/repositories/workspace-repository", () => ({
  getCampaign: () => null, listCampaigns: () => [],
}));
vi.mock("@/server/repositories/crm-repository", () => ({ getOrCreateCrm: () => ({ relationship: { value: null, components: {} } }) }));
vi.mock("./rules-service", () => ({ evaluateCreator: () => ({ verdict: "no_rules", hits: [], postsScanned: 0 }) }));
vi.mock("./rate-service", () => ({ rateIntelligence: () => ({ observed: { medianRate: null } }) }));

describe("ROI forecast", () => {
  it("forecasts only from a creator's own observed medians, and says who it could not read", async () => {
    const { forecastRoi } = await import("./forecast-service");
    const out = forecastRoi(["steady", "thin", "noviews", "missing"], { plannedPosts: 2 });

    expect(out.forecastable).toBe(1);
    expect(out.expected.views!.mid).toBe(200_000); // 100k median × 2 posts
    // Each exclusion states its own reason rather than contributing zero.
    const reasons = out.creators.filter((c) => c.excluded).map((c) => c.excluded!);
    expect(reasons.some((r) => r.includes("at least"))).toBe(true);
    expect(reasons.some((r) => r.includes("No view count"))).toBe(true);
    expect(reasons.some((r) => r.includes("Not in the index"))).toBe(true);
    // Reading one of four creators cannot be high confidence.
    expect(out.confidence).toBeLessThan(50);
  });

  it("returns a band, never a bare point", async () => {
    const { forecastRoi } = await import("./forecast-service");
    const out = forecastRoi(["steady"], { plannedPosts: 1 });
    expect(out.expected.views!.low).toBeLessThan(out.expected.views!.mid);
    expect(out.expected.views!.high).toBeGreaterThan(out.expected.views!.mid);
  });

  it("forecasts nothing when nothing can be read", async () => {
    const { forecastRoi } = await import("./forecast-service");
    const out = forecastRoi(["missing"], {});
    expect(out.expected.views).toBeNull();
    expect(out.confidence).toBe(0);
  });
});

describe("Campaign Fit 2.0", () => {
  it("drops unmeasurable components and explains every one it keeps", async () => {
    const { campaignFit2 } = await import("./forecast-service");
    const fit = campaignFit2({ orgId: "o" } as never, "steady", { categories: ["beauty"], countries: ["IN"] });
    const keys = fit.components.filter((c) => c.value !== null).map((c) => c.key);
    expect(keys).toContain("audience");
    expect(keys).toContain("category");
    expect(keys).toContain("geography");
    // No rules, no history, no rate: those three are withheld, not zeroed.
    expect(fit.components.find((c) => c.key === "safety")!.value).toBeNull();
    expect(fit.components.find((c) => c.key === "reliability")!.value).toBeNull();
    expect(fit.components.find((c) => c.key === "price")!.value).toBeNull();
    expect(fit.coverage).toBeCloseTo(0.6, 2);
    // Every component carries a sentence that explains it.
    expect(fit.components.every((c) => c.evidence.length > 0)).toBe(true);
  });

  it("scores a category mismatch as zero, not as unmeasurable", async () => {
    const { campaignFit2 } = await import("./forecast-service");
    const fit = campaignFit2({ orgId: "o" } as never, "steady", { categories: ["gaming"] });
    expect(fit.components.find((c) => c.key === "category")!.value).toBe(0);
  });
});
