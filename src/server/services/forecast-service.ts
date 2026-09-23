import type { SessionUser } from "@/lib/contracts/auth";
import { median } from "@/server/analytics/metrics";
import { toProfile, toSummary } from "@/server/repositories/influencer-repository";
import { getCampaign, listCampaigns } from "@/server/repositories/workspace-repository";
import { getOrCreateCrm } from "@/server/repositories/crm-repository";
import { evaluateCreator } from "./rules-service";
import { rateIntelligence } from "./rate-service";

/* ---------------------------------------------------------------------------
 * Forecasting: what a roster is likely to deliver, and how good the guess was.
 *
 * This is the most dangerous feature in the product to build, because a
 * prediction looks exactly like a measurement once it is on a slide. Three
 * rules keep it honest:
 *
 *   - A forecast is built from the creator's *own observed medians*, never
 *     from a model and never from a category average. If a creator has no
 *     observed views, they contribute no views to the forecast and the
 *     coverage figure says so.
 *   - Every forecast is a range with the evidence behind it: how many posts
 *     it was drawn from, how many creators could be forecast at all, and a
 *     confidence that falls as either shrinks.
 *   - Accuracy is measured, not asserted. Once a campaign has attributed
 *     posts, the same maths is re-run against what actually happened and the
 *     error is reported. A forecast that is never scored against reality is
 *     marketing, not analysis.
 * ------------------------------------------------------------------------ */

export const FORECAST_VERSION = "forecast-1.0.0";

/** Below this many observed posts a creator's median is not a forecast. */
const MIN_POSTS = 5;

export interface CreatorForecast {
  influencerId: string;
  displayName: string;
  postsObserved: number;
  /** Median views per post, from this creator's own catalogue. */
  medianViews: number | null;
  engagementRatePct: number | null;
  plannedPosts: number;
  expectedViews: number | null;
  expectedEngagements: number | null;
  cost: number | null;
  /** Why this creator could not be forecast, when they could not. */
  excluded: string | null;
}

export interface RoiForecast {
  currency: string;
  plannedPostsPerCreator: number;
  creators: CreatorForecast[];
  /** Creators with enough observed history to forecast at all. */
  forecastable: number;
  expected: {
    views: { low: number; mid: number; high: number } | null;
    engagements: { low: number; mid: number; high: number } | null;
    cost: number | null;
    costPerEngagement: number | null;
    costPerThousandViews: number | null;
  };
  /** 0–100. Falls with thin history and with creators that could not be read. */
  confidence: number;
  evidence: { postsRead: number; creatorsRequested: number; creatorsForecast: number };
  version: string;
}

/**
 * A band rather than a point. The spread is the dispersion actually seen in
 * the roster's own catalogues, not a fixed percentage: a roster of steady
 * publishers earns a tighter band than a roster of one-hit creators.
 */
function band(mid: number, spread: number) {
  return {
    low: Math.round(mid * (1 - spread)),
    mid: Math.round(mid),
    high: Math.round(mid * (1 + spread)),
  };
}

export function forecastRoi(
  influencerIds: string[],
  options: { plannedPosts?: number; rates?: Record<string, number>; currency?: string } = {},
): RoiForecast {
  const planned = Math.max(1, options.plannedPosts ?? 1);
  const creators: CreatorForecast[] = [];
  let postsRead = 0;

  for (const id of influencerIds.slice(0, 200)) {
    const profile = toProfile(id);
    const summary = toSummary(id);
    const name = summary?.displayName ?? id;

    if (!profile || !summary) {
      creators.push({
        influencerId: id, displayName: name, postsObserved: 0, medianViews: null,
        engagementRatePct: null, plannedPosts: planned, expectedViews: null,
        expectedEngagements: null, cost: options.rates?.[id] ?? null,
        excluded: "Not in the index.",
      });
      continue;
    }

    const observed = profile.glance.contentCount ?? 0;
    postsRead += observed;
    const views = profile.glance.medianViews;
    const rate = summary.engagementRate;

    if (observed < MIN_POSTS || views === null) {
      creators.push({
        influencerId: id, displayName: name, postsObserved: observed, medianViews: views,
        engagementRatePct: rate, plannedPosts: planned, expectedViews: null,
        expectedEngagements: null, cost: options.rates?.[id] ?? null,
        // Instagram publishes no view count, so those creators land here —
        // stated, rather than forecast at zero.
        excluded:
          views === null
            ? "No view count published for this account."
            : `Only ${observed} posts observed; a median needs at least ${MIN_POSTS}.`,
      });
      continue;
    }

    const expectedViews = views * planned;
    creators.push({
      influencerId: id,
      displayName: name,
      postsObserved: observed,
      medianViews: views,
      engagementRatePct: rate,
      plannedPosts: planned,
      expectedViews,
      expectedEngagements: rate === null ? null : Math.round((expectedViews * rate) / 100),
      cost: options.rates?.[id] ?? null,
      excluded: null,
    });
  }

  const usable = creators.filter((creator) => creator.excluded === null);
  const viewValues = usable.map((creator) => creator.expectedViews!).filter(Number.isFinite);
  const engagementValues = usable
    .map((creator) => creator.expectedEngagements)
    .filter((value): value is number => value !== null);

  const totalViews = viewValues.reduce((total, value) => total + value, 0);
  const totalEngagements = engagementValues.reduce((total, value) => total + value, 0);
  const costs = creators.map((creator) => creator.cost).filter((value): value is number => value !== null);
  const totalCost = costs.length === 0 ? null : costs.reduce((total, value) => total + value, 0);

  // The band widens with the roster's own dispersion: the ratio of the
  // largest contributor to the median one.
  const medianView = median(viewValues) ?? 0;
  const spread =
    viewValues.length < 2 || medianView === 0
      ? 0.5
      : Math.min(0.6, Math.max(0.15, (Math.max(...viewValues) / medianView - 1) / 6));

  // Confidence falls with a thin roster and with creators we could not read.
  const coverage = influencerIds.length === 0 ? 0 : usable.length / influencerIds.length;
  const depth = Math.min(1, postsRead / (influencerIds.length * 25 || 1));
  const confidence = Number((Math.max(0, Math.min(1, coverage * 0.6 + depth * 0.4)) * 100).toFixed(0));

  return {
    currency: options.currency ?? "INR",
    plannedPostsPerCreator: planned,
    creators,
    forecastable: usable.length,
    expected: {
      views: usable.length === 0 ? null : band(totalViews, spread),
      engagements: engagementValues.length === 0 ? null : band(totalEngagements, spread),
      cost: totalCost,
      costPerEngagement:
        totalCost === null || totalEngagements === 0
          ? null
          : Number((totalCost / totalEngagements).toFixed(2)),
      costPerThousandViews:
        totalCost === null || totalViews === 0
          ? null
          : Number(((totalCost / totalViews) * 1000).toFixed(2)),
    },
    confidence,
    evidence: {
      postsRead,
      creatorsRequested: influencerIds.length,
      creatorsForecast: usable.length,
    },
    version: FORECAST_VERSION,
  };
}

/* --- Accuracy ----------------------------------------------------------- */

export interface ForecastAccuracy {
  campaignId: string;
  campaignName: string;
  /** What the same maths would have predicted for this roster. */
  predicted: { views: number | null; engagements: number | null };
  /** What was actually attributed. */
  actual: { views: number | null; engagements: number | null; posts: number };
  errorPct: { views: number | null; engagements: number | null };
  comparable: boolean;
  version: string;
}

/**
 * Scores a forecast against what happened. Only comparable once posts have
 * actually been attributed — before that there is nothing to be right or
 * wrong about, and reporting an error of 100% would be a judgement on a
 * campaign that has not run.
 */
export function forecastAccuracy(user: SessionUser, campaignId: string): ForecastAccuracy {
  const campaign = getCampaign(user, campaignId);
  if (!campaign) throw new Error("Campaign not found.");

  const posts = campaign.attributedPosts;
  const perCreator =
    campaign.participants.length === 0 ? 1 : Math.max(1, Math.round(posts / campaign.participants.length));
  const forecast = forecastRoi(
    campaign.participants.map((participant) => participant.influencerId),
    { plannedPosts: perCreator, currency: campaign.budgetCurrency },
  );

  const actualViews = campaign.totalReach;
  const actualEngagements = campaign.totalEngagements;
  const predictedViews = forecast.expected.views?.mid ?? null;
  const predictedEngagements = forecast.expected.engagements?.mid ?? null;

  const error = (predicted: number | null, actual: number | null) =>
    predicted === null || actual === null || actual === 0
      ? null
      : Number((((predicted - actual) / actual) * 100).toFixed(1));

  return {
    campaignId,
    campaignName: campaign.name,
    predicted: { views: predictedViews, engagements: predictedEngagements },
    actual: { views: actualViews, engagements: actualEngagements, posts },
    errorPct: {
      views: error(predictedViews, actualViews),
      engagements: error(predictedEngagements, actualEngagements),
    },
    comparable: posts > 0,
    version: FORECAST_VERSION,
  };
}

/** Accuracy across every campaign that has run — the calibration record. */
export function forecastCalibration(user: SessionUser) {
  const scored = listCampaigns(user)
    .filter((campaign) => campaign.attributedPosts > 0)
    .map((campaign) => forecastAccuracy(user, campaign.id));

  const viewErrors = scored
    .map((entry) => entry.errorPct.views)
    .filter((value): value is number => value !== null)
    .map(Math.abs);

  return {
    campaignsScored: scored.length,
    medianAbsoluteErrorPct: median(viewErrors),
    campaigns: scored,
    version: FORECAST_VERSION,
  };
}

/* --- Campaign Fit 2.0 ---------------------------------------------------- */

export const FIT2_VERSION = "fit-2.0.0";

export interface Fit2Component {
  key: string;
  label: string;
  value: number | null;
  weight: number;
  /** Why it scored what it scored, or why it could not be measured. */
  evidence: string;
}

export interface Fit2 {
  influencerId: string;
  displayName: string;
  value: number | null;
  components: Fit2Component[];
  /** Share of the formula that was measurable, 0–1. */
  coverage: number;
  version: string;
}

/**
 * A deeper campaign fit: the original model plus geography, brand safety
 * measured against this organisation's own rules, reliability from real
 * collaboration history, and price efficiency against the rates this
 * organisation has actually agreed.
 *
 * Every component that cannot be measured is dropped and the rest
 * renormalise, exactly as the health score does — and each one carries the
 * sentence that explains it, because a fit score nobody can interrogate is
 * a ranking dressed as a judgement.
 */
export function campaignFit2(
  user: SessionUser,
  influencerId: string,
  brief: { categories?: string[]; countries?: string[]; maxRate?: number } = {},
): Fit2 {
  const profile = toProfile(influencerId);
  const summary = toSummary(influencerId);
  if (!profile || !summary) {
    return {
      influencerId, displayName: influencerId, value: null,
      components: [], coverage: 0, version: FIT2_VERSION,
    };
  }

  const components: Fit2Component[] = [];

  components.push({
    key: "audience",
    label: "Audience quality",
    value: profile.health.sufficient ? profile.health.value : null,
    weight: 0.25,
    evidence: profile.health.sufficient
      ? `SENSO Health ${profile.health.value} from ${Math.round(profile.health.weightCovered * 100)}% of the formula.`
      : "Too little of the health formula was measurable to score.",
  });

  const wanted = brief.categories ?? [];
  components.push({
    key: "category",
    label: "Category match",
    value:
      wanted.length === 0
        ? null
        : summary.categories.some((category) => wanted.includes(category))
          ? 100
          : 0,
    weight: 0.2,
    evidence:
      wanted.length === 0
        ? "No categories named in the brief."
        : `Creator: ${summary.categories.join(", ") || "none observed"}. Brief: ${wanted.join(", ")}.`,
  });

  const countries = brief.countries ?? [];
  components.push({
    key: "geography",
    label: "Geography",
    value:
      countries.length === 0 || summary.countryCode === null
        ? null
        : countries.includes(summary.countryCode)
          ? 100
          : 0,
    weight: 0.15,
    evidence:
      summary.countryCode === null
        ? "No country on record — Instagram publishes none."
        : countries.length === 0
          ? "No geography named in the brief."
          : `Creator in ${summary.countryName}. Brief wants ${countries.join(", ")}.`,
  });

  // Brand safety from this organisation's own rules, not a model's opinion.
  const rules = evaluateCreator(user, influencerId);
  components.push({
    key: "safety",
    label: "Brand safety",
    value:
      rules.verdict === "no_rules"
        ? null
        : rules.verdict === "block"
          ? 0
          : rules.verdict === "review"
            ? 40
            : rules.verdict === "note"
              ? 75
              : 100,
    weight: 0.15,
    evidence:
      rules.verdict === "no_rules"
        ? "No brand-safety rules defined for this organisation."
        : `${rules.hits.filter((hit) => hit.kind === "brand_safety").length} rule(s) fired across ${rules.postsScanned} posts read.`,
  });

  const crm = getOrCreateCrm(user, influencerId);
  components.push({
    key: "reliability",
    label: "Reliability",
    value: crm.relationship.value,
    weight: 0.15,
    evidence:
      crm.relationship.value === null
        ? "No collaboration history with this creator yet."
        : `${crm.relationship.components.campaignsCompleted} completed, ${crm.relationship.components.repeatCollaborations} repeat.`,
  });

  const rates = rateIntelligence(user, influencerId);
  const agreed = rates.observed.medianRate;
  components.push({
    key: "price",
    label: "Price efficiency",
    value:
      agreed === null || !brief.maxRate
        ? null
        : Math.max(0, Math.min(100, ((brief.maxRate - agreed) / brief.maxRate) * 100 + 50)),
    weight: 0.1,
    evidence:
      agreed === null
        ? "No rate agreed with this creator yet."
        : !brief.maxRate
          ? "No budget ceiling given in the brief."
          : `Median agreed ${agreed} against a ceiling of ${brief.maxRate}.`,
  });

  const measured = components.filter((component) => component.value !== null);
  const coverage = measured.reduce((sum, component) => sum + component.weight, 0);
  const value =
    coverage === 0
      ? null
      : Number(
          (
            measured.reduce((sum, component) => sum + component.value! * component.weight, 0) /
            coverage
          ).toFixed(1),
        );

  return {
    influencerId,
    displayName: summary.displayName,
    value,
    components,
    coverage: Number(coverage.toFixed(2)),
    version: FIT2_VERSION,
  };
}
