import { describe, expect, it } from "vitest";
import { FORMULA_VERSION, HEALTH_WEIGHTS } from "@/lib/contracts/score";
import {
  computeConfidence,
  computeHealthScore,
  normaliseAuthenticity,
  normaliseEngagementRate,
  riskLevel,
  type HealthInputs,
} from "./formulas";

const AT = new Date("2026-08-26T00:00:00.000Z");

function inputs(overrides: Partial<HealthInputs> = {}): HealthInputs {
  return {
    authenticity: 80,
    engagementQuality: 80,
    engagementRate: 80,
    growthPattern: 80,
    viewConsistency: 80,
    audienceActivity: 80,
    commentQuality: 80,
    uploadConsistency: 80,
    brandSafety: 80,
    ...overrides,
  };
}

describe("health weights", () => {
  it("sum to exactly 1 — the DPR §10.1 table must stay whole", () => {
    const total = Object.values(HEALTH_WEIGHTS).reduce((sum, w) => sum + w, 0);
    expect(Number(total.toFixed(10))).toBe(1);
  });
});

describe("computeHealthScore", () => {
  it("is the weighted mean when every component is present", () => {
    expect(computeHealthScore(inputs(), {}, AT).value).toBe(80);
  });

  it("is reproducible — identical inputs give an identical result", () => {
    const a = computeHealthScore(inputs({ growthPattern: 41.7 }), {}, AT);
    const b = computeHealthScore(inputs({ growthPattern: 41.7 }), {}, AT);
    expect(a).toEqual(b);
  });

  it("renormalises rather than counting a missing component as zero", () => {
    // Growth carries 15%. Dropping it must not drag an otherwise-80 profile down.
    const score = computeHealthScore(inputs({ growthPattern: null }), {}, AT);
    expect(score.value).toBe(80);
    expect(score.weightCovered).toBe(0.85);
    expect(score.components.find((c) => c.key === "growthPattern")?.available).toBe(false);
  });

  it("weights authenticity above brand safety, per the published table", () => {
    const authenticityDrop = computeHealthScore(inputs({ authenticity: 0 }), {}, AT).value;
    const safetyDrop = computeHealthScore(inputs({ brandSafety: 0 }), {}, AT).value;
    expect(authenticityDrop).toBeLessThan(safetyDrop);
  });

  it("stores every component and its evidence so a score can be re-derived", () => {
    const score = computeHealthScore(
      inputs(),
      { engagementRate: { medianRate: 4.2, cohortMedian: 3.1 } },
      AT,
    );
    expect(score.components).toHaveLength(9);
    expect(score.components.find((c) => c.key === "engagementRate")?.inputs).toEqual({
      medianRate: 4.2,
      cohortMedian: 3.1,
    });
    // Against the constant, not a literal: the guarantee is that a score
    // carries the version that produced it, and a literal here would fail on
    // every legitimate recalibration while proving nothing extra.
    expect(score.formulaVersion).toBe(FORMULA_VERSION);
    expect(score.formulaVersion).toMatch(/^health-\d+\.\d+\.\d+$/);
    expect(score.computedAt).toBe(AT.toISOString());
  });

  it("yields 0 with no measurable component, and reports zero coverage", () => {
    const empty = inputs();
    for (const key of Object.keys(empty) as (keyof HealthInputs)[]) empty[key] = null;
    const score = computeHealthScore(empty, {}, AT);
    expect(score.value).toBe(0);
    // Coverage is what tells a caller this is "unknown", not "measured as bad".
    expect(score.weightCovered).toBe(0);
  });

  it("clamps out-of-range inputs instead of letting them skew the mean", () => {
    expect(computeHealthScore(inputs({ authenticity: 500 }), {}, AT).value).toBe(84);
  });
});

describe("normaliseEngagementRate", () => {
  it("places cohort-median performance mid-scale, not at the top", () => {
    const score = normaliseEngagementRate(3, 3)!;
    expect(score).toBeGreaterThan(55);
    expect(score).toBeLessThan(65);
  });

  it("rewards outperformance and penalises underperformance", () => {
    expect(normaliseEngagementRate(6, 3)!).toBeGreaterThan(normaliseEngagementRate(3, 3)!);
    expect(normaliseEngagementRate(1, 3)!).toBeLessThan(normaliseEngagementRate(3, 3)!);
  });

  it("falls back to an absolute curve when no benchmark exists yet", () => {
    expect(normaliseEngagementRate(4, null)).toBeGreaterThan(0);
    expect(normaliseEngagementRate(null, 3)).toBeNull();
  });
});

describe("normaliseAuthenticity", () => {
  it("treats bot risk as more damaging than inactivity", () => {
    expect(normaliseAuthenticity(40, 0)!).toBeLessThan(normaliseAuthenticity(0, 40)!);
  });

  it("returns null when neither signal is measurable", () => {
    expect(normaliseAuthenticity(null, null)).toBeNull();
  });
});

describe("riskLevel", () => {
  it("reads a clean profile as low risk", () => {
    expect(riskLevel({ botRisk: 8, inactiveAudience: 10, viewAnomaly: 95, brandSafety: 92 })).toBe(
      "low",
    );
  });

  it("escalates on high bot risk even when everything else is clean", () => {
    expect(riskLevel({ botRisk: 85, inactiveAudience: 5, viewAnomaly: 98, brandSafety: 95 })).toBe(
      "high",
    );
  });
});

describe("computeConfidence", () => {
  const base = {
    fieldCompleteness: 1,
    snapshotCount: 26,
    hasAuthorizedSource: true,
    hasPlatformApiSource: true,
    observationCount: 400,
    hoursSinceRefresh: 2,
    conflictCount: 0,
    mix: { verified: 40, observed: 40, derived: 10, estimated: 5, inferred: 5 },
  };

  it("is a separate axis from quality and reports its own band", () => {
    const confidence = computeConfidence(base, AT);
    expect(confidence.score).toBeGreaterThanOrEqual(90);
    expect(confidence.band).toBe("high");
  });

  it("falls to preliminary for a thin, unverified, stale profile", () => {
    const confidence = computeConfidence(
      {
        ...base,
        fieldCompleteness: 0.3,
        snapshotCount: 1,
        hasAuthorizedSource: false,
        hasPlatformApiSource: false,
        observationCount: 4,
        hoursSinceRefresh: 24 * 30,
      },
      AT,
    );
    expect(confidence.band).toBe("preliminary");
  });

  it("penalises unresolved source conflicts", () => {
    const clean = computeConfidence(base, AT).score;
    const conflicted = computeConfidence({ ...base, conflictCount: 3 }, AT).score;
    expect(conflicted).toBeLessThan(clean);
  });

  it("never leaves the 0–100 range", () => {
    const worst = computeConfidence(
      {
        ...base,
        fieldCompleteness: 0,
        snapshotCount: 0,
        hasAuthorizedSource: false,
        hasPlatformApiSource: false,
        observationCount: 0,
        hoursSinceRefresh: 24 * 365,
        conflictCount: 50,
      },
      AT,
    );
    expect(worst.score).toBeGreaterThanOrEqual(0);
    expect(worst.score).toBeLessThanOrEqual(100);
  });
});

describe("minimum formula coverage", () => {
  const only = (key: keyof HealthInputs, value: number): HealthInputs => ({
    authenticity: null,
    engagementQuality: null,
    engagementRate: null,
    growthPattern: null,
    viewConsistency: null,
    audienceActivity: null,
    commentQuality: null,
    uploadConsistency: null,
    brandSafety: null,
    [key]: value,
  });

  it("withholds a score built from a tenth of the formula", () => {
    // A channel with one indexed upload has no engagement rate, no consistency
    // and no history. One viral video against a small following pins audience
    // activity at 100 — and renormalising over that alone published 100/100.
    const score = computeHealthScore(only("audienceActivity", 100));

    expect(score.weightCovered).toBeCloseTo(0.1);
    expect(score.sufficient).toBe(false);
  });

  it("still scores a creator missing only the components nobody can measure", () => {
    // No bot-risk signal and no snapshot history is the normal state of a
    // creator read from a public API. That must remain scoreable.
    const score = computeHealthScore({
      authenticity: null,
      growthPattern: null,
      engagementQuality: 60,
      engagementRate: 55,
      viewConsistency: 70,
      audienceActivity: 50,
      commentQuality: 65,
      uploadConsistency: 40,
      brandSafety: 90,
    });

    expect(score.weightCovered).toBeCloseTo(0.65);
    expect(score.sufficient).toBe(true);
  });
});
