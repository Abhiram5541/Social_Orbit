import {
  FORMULA_VERSION,
  HEALTH_WEIGHTS,
  SCORE_VERSION,
  healthBand,
  type HealthComponentKey,
  type HealthScore,
  type RiskSignals,
  type ScoreComponent,
} from "@/lib/contracts/score";
import { confidenceBand, type DataConfidence, type RiskLevel } from "@/lib/contracts/common";
import { clamp } from "@/server/analytics/metrics";

/* ---------------------------------------------------------------------------
 * The SocialOrbit scoring engine — DPR §10.
 *
 * Deterministic, versioned and reproducible. An LLM never sees this file's
 * output as an input to itself: AI may produce the *classification* inputs
 * (comment quality, brand safety), but the arithmetic that turns them into a
 * score lives here where it can be tested, versioned and defended.
 *
 * Components that lack data are excluded and the remaining weights are
 * renormalised, so a creator is never punished for a metric the platform does
 * not expose. `weightCovered` records how much of the formula actually ran.
 * ------------------------------------------------------------------------ */

/** Raw, already-normalised 0–100 inputs. Null means "not measurable". */
export interface HealthInputs {
  authenticity: number | null;
  engagementQuality: number | null;
  engagementRate: number | null;
  growthPattern: number | null;
  viewConsistency: number | null;
  audienceActivity: number | null;
  commentQuality: number | null;
  uploadConsistency: number | null;
  brandSafety: number | null;
}

/** The measurements behind each normalised input, stored for reproducibility. */
export type HealthEvidence = Partial<
  Record<HealthComponentKey, Record<string, number | null>>
>;

export function computeHealthScore(
  inputs: HealthInputs,
  evidence: HealthEvidence = {},
  now: Date = new Date(),
): HealthScore {
  const components: ScoreComponent[] = (
    Object.keys(HEALTH_WEIGHTS) as HealthComponentKey[]
  ).map((key) => {
    const raw = inputs[key];
    const available = raw !== null && Number.isFinite(raw);
    return {
      key,
      value: available ? clamp(raw, 0, 100) : 0,
      weight: HEALTH_WEIGHTS[key],
      inputs: evidence[key] ?? {},
      available,
    };
  });

  const covered = components
    .filter((component) => component.available)
    .reduce((sum, component) => sum + component.weight, 0);

  // With no measurable component there is no score — not a zero, which would
  // read as "measured and terrible" rather than "not yet known".
  const value =
    covered === 0
      ? 0
      : components
          .filter((component) => component.available)
          .reduce((sum, component) => sum + component.value * component.weight, 0) / covered;

  const rounded = Number(value.toFixed(1));

  return {
    value: rounded,
    band: healthBand(rounded),
    components,
    weightCovered: Number(covered.toFixed(4)),
    scoreVersion: SCORE_VERSION,
    formulaVersion: FORMULA_VERSION,
    computedAt: now.toISOString(),
  };
}

/* ---------------------------------------------------------------------------
 * Component normalisers.
 *
 * Each turns a real measurement into the 0–100 space the formula expects.
 * They live here rather than at the call site so the mapping is versioned
 * along with the weights.
 * ------------------------------------------------------------------------ */

export const NORMALISER_VERSION = "1.0.0";

/**
 * Engagement rate is only meaningful against a peer group: 1.2% is strong on
 * YouTube and poor on a small Instagram account. Normalised against the
 * category-and-size cohort median rather than an absolute scale.
 */
export function normaliseEngagementRate(
  rate: number | null,
  cohortMedian: number | null,
): number | null {
  if (rate === null) return null;
  if (!cohortMedian || cohortMedian <= 0) {
    // No benchmark yet — fall back to a conservative absolute curve.
    return clamp(Math.log10(1 + rate * 9) * 55, 0, 100);
  }
  const ratio = rate / cohortMedian;
  // Median performance sits at 60; twice the median approaches the ceiling.
  return clamp(60 * Math.min(ratio, 1) + 40 * clamp((ratio - 1) / 1.5, 0, 1), 0, 100);
}

/**
 * Authenticity composes the two measurable audience-risk signals. DPR §5.2
 * forbids publishing an exact fake-follower percentage, so this is explicitly a
 * composite quality signal rather than a claim about a share of the audience.
 */
export function normaliseAuthenticity(
  botRisk: number | null,
  inactiveAudience: number | null,
): number | null {
  if (botRisk === null && inactiveAudience === null) return null;
  const bot = botRisk ?? 0;
  const inactive = inactiveAudience ?? 0;
  // Bot risk is weighted more heavily: an inactive follower is worth little,
  // an inauthentic one is actively misleading.
  return clamp(100 - (bot * 0.65 + inactive * 0.35), 0, 100);
}

/**
 * Engagement adjusted by the quality of that engagement. Volume of generic
 * one-word comments is not the same signal as a discussion, and this is where
 * that distinction enters the score.
 */
export function normaliseEngagementQuality(
  engagementRateScore: number | null,
  commentQuality: number | null,
  audienceActivity: number | null,
): number | null {
  if (engagementRateScore === null) return null;
  const quality = commentQuality ?? 60;
  const activity = audienceActivity ?? 60;
  const adjustment = (quality * 0.6 + activity * 0.4) / 100;
  return clamp(engagementRateScore * (0.55 + 0.45 * adjustment), 0, 100);
}

/**
 * Share of the audience showing any measurable activity. Derived from the
 * relationship between reach and audience size, which is observable, rather
 * than from a claim about individual accounts, which is not.
 */
export function normaliseAudienceActivity(
  viewsPerFollowerRatio: number | null,
  cohortRatio: number | null,
): number | null {
  if (viewsPerFollowerRatio === null) return null;
  const benchmark = cohortRatio && cohortRatio > 0 ? cohortRatio : 20;
  return clamp((viewsPerFollowerRatio / benchmark) * 70, 0, 100);
}

/* ---------------------------------------------------------------------------
 * Risk
 * ------------------------------------------------------------------------ */

export const RISK_FORMULA_VERSION = "risk-1.0.0";

export interface RiskInputs {
  /** 0–100 estimated bot-risk signal with its supporting evidence. */
  botRisk: number | null;
  inactiveAudience: number | null;
  viewAnomaly: number | null;
  brandSafety: number | null;
}

export function riskLevel(inputs: RiskInputs): RiskLevel {
  // Audience-quality signals are what a risk level is about. With none of them
  // measured there is nothing to grade, and defaulting the absent ones to
  // "clean" would manufacture a low-risk verdict out of missing data.
  const assessable =
    inputs.botRisk !== null || inputs.inactiveAudience !== null || inputs.brandSafety !== null;
  if (!assessable) return "unknown";

  const bot = inputs.botRisk ?? 0;
  const inactive = inputs.inactiveAudience ?? 0;
  const safety = inputs.brandSafety ?? 100;
  const anomaly = 100 - (inputs.viewAnomaly ?? 100);

  const composite = bot * 0.4 + inactive * 0.2 + anomaly * 0.2 + (100 - safety) * 0.2;

  // A blended average lets one severe signal be washed out by three clean
  // ones — a creator with 85/100 bot risk would read "medium" simply because
  // nothing else was wrong. Risk does not average: a single disqualifying
  // signal sets a floor the composite cannot pull below.
  const floor: RiskLevel =
    bot >= 70 || safety <= 35
      ? "high"
      : bot >= 40 || safety <= 60 || inactive >= 65 || anomaly >= 60
        ? "medium"
        : "low";

  const fromComposite: RiskLevel =
    composite >= 45 ? "high" : composite >= 22 ? "medium" : "low";

  const RANK: Record<RiskLevel, number> = { unknown: 0, low: 0, medium: 1, high: 2 };
  return RANK[floor] >= RANK[fromComposite] ? floor : fromComposite;
}

export function computeRiskSignals(
  inputs: RiskInputs,
  evidence: RiskSignals["evidence"],
  now: Date = new Date(),
): RiskSignals {
  // Null passes through as null. Rounding an absent signal to 0 published
  // "bot risk 0/100" — a clean bill of health for something never measured.
  return {
    botRisk: inputs.botRisk === null ? null : Math.round(inputs.botRisk),
    inactiveAudience:
      inputs.inactiveAudience === null ? null : Math.round(inputs.inactiveAudience),
    viewAnomaly: inputs.viewAnomaly === null ? null : Math.round(inputs.viewAnomaly),
    level: riskLevel(inputs),
    evidence,
    computedAt: now.toISOString(),
  };
}

/* ---------------------------------------------------------------------------
 * Confidence — DPR §10.2
 *
 * Deliberately separate from quality. It answers "how much should you trust
 * the numbers above?", which is a different question from "are they good?".
 * ------------------------------------------------------------------------ */

export const CONFIDENCE_FORMULA_VERSION = "confidence-1.0.0";

export interface ConfidenceInputs {
  /** Share of the expected profile fields that are populated, 0–1. */
  fieldCompleteness: number;
  /** Number of historical snapshots held. */
  snapshotCount: number;
  /** Highest source tier backing this profile. */
  hasAuthorizedSource: boolean;
  hasPlatformApiSource: boolean;
  /** Number of content observations indexed. */
  observationCount: number;
  /** Hours since the most recent successful refresh. */
  hoursSinceRefresh: number | null;
  /** Facts where two sources disagreed and a review is open. */
  conflictCount: number;
  mix: DataConfidence["mix"];
}

export function computeConfidence(
  inputs: ConfidenceInputs,
  now: Date = new Date(),
): DataConfidence {
  const dataCompleteness = clamp(inputs.fieldCompleteness * 30, 0, 30);

  // 26 weekly snapshots — half a year — is treated as full historical depth.
  const historicalDepth = clamp((inputs.snapshotCount / 26) * 25, 0, 25);

  const sourceAuthority = inputs.hasAuthorizedSource
    ? 25
    : inputs.hasPlatformApiSource
      ? 18
      : 8;

  const observationCount = clamp(Math.log10(1 + inputs.observationCount) * 12, 0, 20);

  // Nothing decays for two days; after that trust erodes steadily.
  const hours = inputs.hoursSinceRefresh ?? 24 * 30;
  const staleDataPenalty = clamp(((hours - 48) / 24) * 1.5, 0, 25);

  const conflictPenalty = clamp(inputs.conflictCount * 6, 0, 20);

  const raw =
    dataCompleteness +
    historicalDepth +
    sourceAuthority +
    observationCount -
    staleDataPenalty -
    conflictPenalty;

  const score = Number(clamp(raw, 0, 100).toFixed(1));

  return {
    score,
    band: confidenceBand(score),
    components: {
      dataCompleteness: Number(dataCompleteness.toFixed(2)),
      historicalDepth: Number(historicalDepth.toFixed(2)),
      sourceAuthority,
      observationCount: Number(observationCount.toFixed(2)),
      staleDataPenalty: Number(staleDataPenalty.toFixed(2)),
      conflictPenalty,
    },
    mix: inputs.mix,
    computedAt: now.toISOString(),
  };
}

/* ---------------------------------------------------------------------------
 * Campaign fit — DPR §11.3
 *
 * A ranking model, not a promise. Historical campaign performance is null
 * until a client supplies real outcomes, and the formula renormalises rather
 * than substituting a guess.
 * ------------------------------------------------------------------------ */

export const FIT_FORMULA_VERSION = "fit-1.0.0";

export interface CampaignFitInputs {
  categoryBenchmark: number;
  /** Null where the component could not be measured. Dropped, not scored zero. */
  engagementQuality: number | null;
  audienceFit: number | null;
  commercialIntent: number | null;
  historicalCampaignPerformance: number | null;
  costEfficiency: number | null;
}

const FIT_WEIGHTS = {
  categoryBenchmark: 0.2,
  engagementQuality: 0.25,
  audienceFit: 0.2,
  commercialIntent: 0.15,
  historicalCampaignPerformance: 0.12,
  costEfficiency: 0.08,
} as const;

export function computeCampaignFit(inputs: CampaignFitInputs, now: Date = new Date()) {
  let total = 0;
  let covered = 0;
  for (const key of Object.keys(FIT_WEIGHTS) as (keyof typeof FIT_WEIGHTS)[]) {
    const value = inputs[key];
    if (value === null || !Number.isFinite(value)) continue;
    total += clamp(value, 0, 100) * FIT_WEIGHTS[key];
    covered += FIT_WEIGHTS[key];
  }
  const value = covered === 0 ? 0 : Number((total / covered).toFixed(1));

  return {
    value,
    components: {
      categoryBenchmark: inputs.categoryBenchmark,
      engagementQuality: inputs.engagementQuality,
      audienceFit: inputs.audienceFit,
      commercialIntent: inputs.commercialIntent,
      historicalCampaignPerformance: inputs.historicalCampaignPerformance,
      costEfficiency: inputs.costEfficiency,
    },
    formulaVersion: FIT_FORMULA_VERSION,
    computedAt: now.toISOString(),
  };
}
