import type { SessionUser } from "@/lib/contracts/auth";
import { median } from "@/server/analytics/metrics";
import { toSummary } from "@/server/repositories/influencer-repository";
import { getCampaign, listCampaigns } from "@/server/repositories/workspace-repository";

/* ---------------------------------------------------------------------------
 * Creator pricing — observed first, modelled only where nothing was observed.
 *
 * SENSO holds no rate card and never asks a model what a creator costs. What
 * it holds is what *this organisation* actually agreed, campaign by campaign,
 * which is an observation. Everything derived from it says so.
 *
 * Rates never cross a tenant boundary. A market median built from every
 * client's negotiated rates would be the most commercially sensitive number
 * in the product, and one client would be funding another's leverage — so a
 * comparison is drawn against this organisation's own history only, and a
 * cohort of fewer than three agreements publishes nothing (the same
 * withholding rule benchmarks follow).
 * ------------------------------------------------------------------------ */

export const RATE_FORMULA_VERSION = "rates-1.0.0";

/** Fewer agreements than this and a median is one number wearing a hat. */
const MIN_AGREEMENTS = 3;

export interface AgreedRate {
  campaignId: string;
  campaignName: string;
  agreedAt: string;
  amount: number;
  currency: string;
  /** Posts the creator was actually credited with on that campaign. */
  attributedPosts: number;
  costPerPost: number | null;
}

export interface RateIntelligence {
  /** What this organisation has agreed with this creator, newest first. */
  history: AgreedRate[];
  observed: {
    medianRate: number | null;
    latestRate: number | null;
    medianCostPerPost: number | null;
    currency: string | null;
    agreements: number;
    /** Change between the first and latest agreement, as a percentage. */
    trendPct: number | null;
  };
  /** Comparable creators inside this organisation: same category and size band. */
  comparable: {
    medianRate: number | null;
    sampleSize: number;
    published: boolean;
    cohort: string | null;
  };
  /** Only offered where nothing was agreed: the reach-based model. */
  estimated: { low: number; high: number; currency: string } | null;
  formulaVersion: string;
}

/** Category and size band, the same cohort key benchmarks use. */
function cohortKeyOf(influencerId: string): string | null {
  const summary = toSummary(influencerId);
  if (!summary) return null;
  const followers = summary.followers ?? 0;
  const band =
    followers >= 1_000_000
      ? "Mega"
      : followers >= 500_000
        ? "Macro"
        : followers >= 100_000
          ? "Mid"
          : followers >= 10_000
            ? "Micro"
            : "Nano";
  return `${summary.categories[0] ?? "uncategorised"} · ${band}`;
}

/** Every agreed rate this organisation holds, by creator. */
function agreementsByCreator(user: SessionUser): Map<string, AgreedRate[]> {
  const byCreator = new Map<string, AgreedRate[]>();

  for (const summary of listCampaigns(user)) {
    const detail = getCampaign(user, summary.id);
    if (!detail) continue;
    for (const participant of detail.participants) {
      if (participant.agreedRate === null || participant.agreedRate <= 0) continue;
      const posts = participant.performance.attributedPosts;
      const entry: AgreedRate = {
        campaignId: detail.id,
        campaignName: detail.name,
        // The campaign's own start is when the rate applied; a rate has no
        // separate agreement date until contracts record one.
        agreedAt: detail.startsOn,
        amount: participant.agreedRate,
        currency: participant.currency,
        attributedPosts: posts,
        costPerPost: posts > 0 ? Number((participant.agreedRate / posts).toFixed(2)) : null,
      };
      const list = byCreator.get(participant.influencerId) ?? [];
      list.push(entry);
      byCreator.set(participant.influencerId, list);
    }
  }

  for (const list of byCreator.values()) {
    list.sort((a, b) => b.agreedAt.localeCompare(a.agreedAt));
  }
  return byCreator;
}

export function rateIntelligence(
  user: SessionUser,
  influencerId: string,
  estimatedMonthlyEarnings: { currency: string; low: number; high: number } | null = null,
): RateIntelligence {
  const byCreator = agreementsByCreator(user);
  const history = byCreator.get(influencerId) ?? [];
  const amounts = history.map((entry) => entry.amount);
  const perPost = history
    .map((entry) => entry.costPerPost)
    .filter((value): value is number => value !== null);

  const oldest = history[history.length - 1];
  const latest = history[0];
  const trendPct =
    history.length >= 2 && oldest.amount > 0
      ? Number((((latest.amount - oldest.amount) / oldest.amount) * 100).toFixed(1))
      : null;

  // Comparable creators: the same cohort, this organisation's own agreements.
  const cohort = cohortKeyOf(influencerId);
  const peerRates: number[] = [];
  if (cohort) {
    for (const [otherId, entries] of byCreator) {
      if (otherId === influencerId) continue;
      if (cohortKeyOf(otherId) !== cohort) continue;
      const peerMedian = median(entries.map((entry) => entry.amount));
      if (peerMedian !== null) peerRates.push(peerMedian);
    }
  }

  return {
    history,
    observed: {
      medianRate: median(amounts),
      latestRate: latest?.amount ?? null,
      medianCostPerPost: median(perPost),
      currency: latest?.currency ?? null,
      agreements: history.length,
      trendPct,
    },
    comparable: {
      medianRate: peerRates.length >= MIN_AGREEMENTS ? median(peerRates) : null,
      sampleSize: peerRates.length,
      published: peerRates.length >= MIN_AGREEMENTS,
      cohort,
    },
    // A model only where there is nothing observed to show: once a real rate
    // exists, offering a modelled one beside it invites the wrong number to
    // be quoted.
    estimated: history.length === 0 ? estimatedMonthlyEarnings : null,
    formulaVersion: RATE_FORMULA_VERSION,
  };
}
