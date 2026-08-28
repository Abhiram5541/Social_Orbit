import { z } from "zod";
import { RiskLevel } from "./common";

/* ---------------------------------------------------------------------------
 * SocialOrbit scoring contracts — DPR §10, §26
 *
 * Scores are computed by `src/server/scoring`, never by a model. Every stored
 * score carries the formula version and every component that produced it, so
 * any number in the product can be re-derived and defended.
 * ------------------------------------------------------------------------ */

export const SCORE_VERSION = "1.0.0";
export const FORMULA_VERSION = "health-1.0.0";

/** The nine weighted inputs to the health score (DPR §10.1). */
export const HealthComponentKey = z.enum([
  "authenticity",
  "engagementQuality",
  "engagementRate",
  "growthPattern",
  "viewConsistency",
  "audienceActivity",
  "commentQuality",
  "uploadConsistency",
  "brandSafety",
]);
export type HealthComponentKey = z.infer<typeof HealthComponentKey>;

export const HEALTH_WEIGHTS: Record<HealthComponentKey, number> = {
  authenticity: 0.2,
  engagementQuality: 0.15,
  engagementRate: 0.15,
  growthPattern: 0.15,
  viewConsistency: 0.1,
  audienceActivity: 0.1,
  commentQuality: 0.05,
  uploadConsistency: 0.05,
  brandSafety: 0.05,
};

export const HEALTH_COMPONENT_LABEL: Record<HealthComponentKey, string> = {
  authenticity: "Audience authenticity",
  engagementQuality: "Engagement quality",
  engagementRate: "Engagement rate",
  growthPattern: "Growth pattern",
  viewConsistency: "View consistency",
  audienceActivity: "Audience activity",
  commentQuality: "Comment quality",
  uploadConsistency: "Upload consistency",
  brandSafety: "Brand safety",
};

/**
 * One weighted component. `inputs` records the raw measurements the normaliser
 * consumed, so a score can be re-computed years later from stored data alone.
 */
export const ScoreComponent = z.object({
  key: HealthComponentKey,
  /** Normalised 0–100. */
  value: z.number().min(0).max(100),
  weight: z.number().min(0).max(1),
  /** Raw measurements behind the normalised value. */
  inputs: z.record(z.string(), z.number().nullable()),
  /** False when there was not enough data; the component is then excluded and weights renormalise. */
  available: z.boolean(),
});
export type ScoreComponent = z.infer<typeof ScoreComponent>;

export const HealthScore = z.object({
  value: z.number().min(0).max(100),
  band: z.enum(["excellent", "strong", "fair", "weak"]),
  components: z.array(ScoreComponent),
  /** Sum of weights actually applied. Below 1 when components were unavailable. */
  weightCovered: z.number().min(0).max(1),
  scoreVersion: z.string(),
  formulaVersion: z.string(),
  computedAt: z.string().datetime(),
});
export type HealthScore = z.infer<typeof HealthScore>;

export function healthBand(value: number): HealthScore["band"] {
  if (value >= 85) return "excellent";
  if (value >= 70) return "strong";
  if (value >= 50) return "fair";
  return "weak";
}

/**
 * Risk signals. DPR §5.2 forbids claiming an exact fake-follower percentage
 * without defensible data, so these are explicitly *estimated* 0–100 signals
 * with the evidence that produced them, never a headline "% fake" figure.
 */
export const RiskSignals = z.object({
  /** 0–100, lower is safer. Null where the signal was never measured. */
  botRisk: z.number().min(0).max(100).nullable(),
  /** 0–100 inactivity signal from measurable indicators. Null if unmeasured. */
  inactiveAudience: z.number().min(0).max(100).nullable(),
  /** Deviation of recent content from expected performance. Null if unmeasured. */
  viewAnomaly: z.number().min(0).max(100).nullable(),
  level: RiskLevel,
  /** Human-readable measurements that justify the numbers above. */
  evidence: z.array(
    z.object({
      signal: z.string(),
      observation: z.string(),
      weight: z.enum(["supporting", "primary"]),
    }),
  ),
  computedAt: z.string().datetime(),
});
export type RiskSignals = z.infer<typeof RiskSignals>;

/** Campaign fit is a ranking model, not a promise — DPR §11.3. */
export const CampaignFit = z.object({
  value: z.number().min(0).max(100),
  components: z.object({
    categoryBenchmark: z.number(),
    // Nullable: a component the platform could not measure is excluded from
    // the weighting rather than scored as zero.
    engagementQuality: z.number().nullable(),
    audienceFit: z.number().nullable(),
    commercialIntent: z.number().nullable(),
    historicalCampaignPerformance: z.number().nullable(),
    costEfficiency: z.number().nullable(),
  }),
  formulaVersion: z.string(),
  computedAt: z.string().datetime(),
});
export type CampaignFit = z.infer<typeof CampaignFit>;

/** Everything the profile header and result cards need in one object. */
export const ScoreSummary = z.object({
  health: HealthScore,
  risk: RiskSignals,
  campaignFit: CampaignFit,
});
export type ScoreSummary = z.infer<typeof ScoreSummary>;
