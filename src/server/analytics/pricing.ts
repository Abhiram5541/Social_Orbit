/* ---------------------------------------------------------------------------
 * Cost efficiency — deterministic, and explicitly modelled.
 *
 * CPM, CPE and CPV are arithmetic over an assumed placement price, not
 * observations and not a rate card. SocialOrbit does not hold creator rates
 * (CLAUDE.md D4), so every figure here is derived from the same modelled
 * earnings band the profile already labels as an estimate.
 *
 * They live in `analytics/` rather than in the AI layer on purpose: a price per
 * thousand views is arithmetic, and asking a model to do arithmetic over
 * numbers it was shown is how an invented figure ends up wearing a label that
 * says "observed".
 * ------------------------------------------------------------------------ */

/** A modelled cost, always carrying the band it was derived from. */
export interface CostEstimate {
  currency: string;
  low: number;
  high: number;
}

export interface CostEfficiency {
  /** Cost per thousand views. */
  cpm: CostEstimate | null;
  /** Cost per engagement — a like, comment or share. */
  cpe: CostEstimate | null;
  /** Cost per view. */
  cpv: CostEstimate | null;
}

const NONE: CostEfficiency = { cpm: null, cpe: null, cpv: null };

/**
 * Cost efficiency for one placement, from the modelled rate band.
 *
 * Null throughout when median views are unknown: dividing by an absent
 * denominator would produce a confident number out of missing data, which is
 * the failure this codebase exists to avoid.
 */
export function costEfficiency(
  rateBand: CostEstimate | null,
  medianViews: number | null,
  engagementRatePct: number | null,
): CostEfficiency {
  if (!rateBand || medianViews === null || medianViews <= 0) return NONE;

  const round = (value: number, dp = 2) => Number(value.toFixed(dp));
  const per = (amount: number, denominator: number, dp: number) =>
    denominator > 0 ? round(amount / denominator, dp) : null;

  const cpv = {
    currency: rateBand.currency,
    low: per(rateBand.low, medianViews, 4) ?? 0,
    high: per(rateBand.high, medianViews, 4) ?? 0,
  };

  const cpm = {
    currency: rateBand.currency,
    low: round((rateBand.low / medianViews) * 1000),
    high: round((rateBand.high / medianViews) * 1000),
  };

  // Engagements per placement, from the creator's own observed engagement rate.
  const engagements =
    engagementRatePct === null ? null : (medianViews * engagementRatePct) / 100;

  const cpe =
    engagements === null || engagements <= 0
      ? null
      : {
          currency: rateBand.currency,
          low: round(rateBand.low / engagements),
          high: round(rateBand.high / engagements),
        };

  return { cpm, cpe, cpv };
}

/**
 * A per-placement rate band from the modelled monthly earnings.
 *
 * The monthly figure already assumes a publishing cadence, so dividing it back
 * out recovers roughly what one placement is worth under the same assumptions.
 * Same model, same label, no new claim.
 */
export function placementRate(
  monthly: CostEstimate | null,
  uploadsPerWeek: number | null,
): CostEstimate | null {
  if (!monthly || uploadsPerWeek === null || uploadsPerWeek <= 0) return null;
  const perMonth = uploadsPerWeek * 4.3;
  return {
    currency: monthly.currency,
    low: Math.round(monthly.low / perMonth),
    high: Math.round(monthly.high / perMonth),
  };
}
