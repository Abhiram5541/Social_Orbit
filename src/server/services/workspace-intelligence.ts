import type { SessionUser } from "@/lib/contracts/auth";
import type { InfluencerSummary } from "@/lib/contracts/influencer";
import type { CampaignSummary } from "@/lib/contracts/campaign";
import { confidenceBand, type RiskLevel } from "@/lib/contracts/common";
import { isStale } from "@/lib/format";
import { median } from "@/server/analytics/metrics";
import { toSummary } from "@/server/repositories/influencer-repository";
import {
  getShortlist,
  listCampaigns,
  listShortlists,
} from "@/server/repositories/workspace-repository";

/* ---------------------------------------------------------------------------
 * Workspace intelligence.
 *
 * The client overview used to render whatever the repositories happened to
 * return — counts of rows. This composes those same reads into the reading a
 * marketing lead actually opens the page for: how sound is the roster we are
 * about to spend money on, and what changed.
 *
 * Every figure here is computed from stored, versioned scores. Nothing is
 * modelled, nothing is smoothed, and where a signal was never measurable it
 * stays null rather than defaulting to a confident zero (CLAUDE.md D13).
 * ------------------------------------------------------------------------ */

export interface PortfolioSignal {
  /** Unique creators across every shortlist this org owns. */
  creators: InfluencerSummary[];
  tracked: number;

  /** Median of stored health scores. Null when nothing is scored yet. */
  medianHealth: number | null;
  /** Counts by health band, lowest first — the distribution behind the median. */
  healthBands: { label: string; range: string; count: number; tone: BandTone }[];

  medianConfidence: number | null;
  medianEngagement: number | null;
  totalReach: number | null;

  verified: number;
  /** Share of tracked creators whose identity is OAuth-confirmed. */
  verifiedShare: number | null;

  /** `unknown` is "no audience-quality signal was measurable", not a severity. */
  risk: Record<RiskLevel, number>;
  /** Creators with a measured medium or high risk signal. */
  flagged: number;

  dormant: number;
  stale: number;
  /** Confidence too thin to publish without a warning — DPR §10.2. */
  preliminary: number;
}

export type BandTone = "positive" | "brand" | "caution" | "critical" | "neutral";

export interface WorkspaceInsight {
  id: string;
  kind: "positive" | "caution" | "critical" | "neutral" | "brand";
  headline: string;
  /** The figure inside the headline, so the view can set it in the numeric face. */
  figure?: string;
  evidence: string;
  href?: string;
  actionLabel?: string;
  meta?: string;
}

export interface WorkspaceIntelligence {
  portfolio: PortfolioSignal;
  campaigns: CampaignSummary[];
  liveCampaigns: CampaignSummary[];
  insights: WorkspaceInsight[];
  shortlistCount: number;
}

/**
 * The product's own scoring bands, not a second set invented for a chart. A
 * distribution drawn against different cut points from the ones the score
 * publishes would disagree with every profile page in the product.
 */
const HEALTH_BANDS: { label: string; range: string; min: number; tone: BandTone }[] = [
  { label: "Excellent", range: "85–100", min: 85, tone: "positive" },
  { label: "Strong", range: "70–84", min: 70, tone: "brand" },
  { label: "Fair", range: "50–69", min: 50, tone: "caution" },
  { label: "Needs review", range: "0–49", min: 0, tone: "critical" },
];

export function portfolioSignal(creators: InfluencerSummary[]): PortfolioSignal {
  const health = creators
    .map((creator) => creator.healthScore)
    .filter((value): value is number => value !== null);
  const engagement = creators
    .map((creator) => creator.engagementRate)
    .filter((value): value is number => value !== null);
  const followers = creators
    .map((creator) => creator.followers)
    .filter((value): value is number => value !== null);

  const risk: Record<RiskLevel, number> = { unknown: 0, low: 0, medium: 0, high: 0 };
  for (const creator of creators) risk[creator.risk] += 1;

  const verified = creators.filter((creator) => creator.verification === "verified").length;

  return {
    creators,
    tracked: creators.length,
    medianHealth: median(health),
    healthBands: HEALTH_BANDS.map((band, index) => {
      const max = index === 0 ? Infinity : HEALTH_BANDS[index - 1].min;
      return {
        label: band.label,
        range: band.range,
        tone: band.tone,
        count: health.filter((value) => value >= band.min && value < max).length,
      };
    }),
    medianConfidence: median(creators.map((creator) => creator.confidence)),
    medianEngagement: median(engagement),
    totalReach: followers.length > 0 ? followers.reduce((sum, n) => sum + n, 0) : null,
    verified,
    verifiedShare: creators.length > 0 ? (verified / creators.length) * 100 : null,
    risk,
    flagged: risk.medium + risk.high,
    dormant: creators.filter((creator) => creator.activity === "dormant").length,
    stale: creators.filter((creator) => isStale(creator.lastActiveAt)).length,
    preliminary: creators.filter(
      (creator) => confidenceBand(creator.confidence) === "preliminary",
    ).length,
  };
}

/**
 * The feed.
 *
 * Every row is a condition that is true right now, phrased as the finding it
 * is. Rows are emitted only when they fire — an empty feed is a real state and
 * the view renders it as one, rather than being padded with rows that say
 * nothing happened.
 */
function buildInsights(
  portfolio: PortfolioSignal,
  campaigns: CampaignSummary[],
): WorkspaceInsight[] {
  const insights: WorkspaceInsight[] = [];
  const { creators } = portfolio;

  if (portfolio.risk.high > 0) {
    insights.push({
      id: "risk-high",
      kind: "critical",
      figure: String(portfolio.risk.high),
      headline: `${portfolio.risk.high} tracked ${plural(portfolio.risk.high, "creator carries", "creators carry")} a high audience-risk signal`,
      evidence:
        "A single disqualifying signal sets the risk floor — it is not averaged away by clean components.",
      href: "/shortlists",
      actionLabel: "Review",
    });
  }

  const weak = creators
    .filter((creator) => creator.healthScore !== null && creator.healthScore < 60)
    .sort((a, b) => (a.healthScore ?? 0) - (b.healthScore ?? 0));
  if (weak.length > 0) {
    insights.push({
      id: "health-weak",
      kind: "caution",
      figure: String(weak.length),
      headline: `${weak.length} tracked ${plural(weak.length, "creator scores", "creators score")} below 60 on SocialOrbit Health`,
      evidence: `Lowest is ${weak[0].displayName} at ${Math.round(weak[0].healthScore ?? 0)}. Health is deterministic and versioned — the components are on each profile.`,
      href: `/influencers/${weak[0].id}`,
      actionLabel: "Inspect",
    });
  }

  if (portfolio.preliminary > 0) {
    insights.push({
      id: "confidence-preliminary",
      kind: "caution",
      figure: String(portfolio.preliminary),
      headline: `${portfolio.preliminary} ${plural(portfolio.preliminary, "profile has", "profiles have")} preliminary data confidence`,
      evidence:
        "Below 50% confidence there is not enough history or source authority to rely on these numbers yet.",
      href: "/shortlists",
      actionLabel: "Review",
    });
  }

  if (portfolio.dormant > 0) {
    insights.push({
      id: "dormant",
      kind: "caution",
      figure: String(portfolio.dormant),
      headline: `${portfolio.dormant} tracked ${plural(portfolio.dormant, "creator has", "creators have")} gone dormant`,
      evidence: "No qualifying publication in the last 90 days.",
      href: "/shortlists",
      actionLabel: "Review",
    });
  }

  if (portfolio.tracked > 0 && portfolio.verified === 0) {
    insights.push({
      id: "verification-none",
      kind: "brand",
      headline: "No tracked creator has confirmed their identity yet",
      evidence:
        "Verified status is issued only after a creator connects an account over OAuth and the identity match passes. Public data can never produce it.",
      href: "/help/verification",
      actionLabel: "How it works",
    });
  } else if (portfolio.verifiedShare !== null && portfolio.verifiedShare < 100) {
    const unverified = portfolio.tracked - portfolio.verified;
    insights.push({
      id: "verification-partial",
      kind: "neutral",
      figure: String(unverified),
      headline: `${unverified} of ${portfolio.tracked} tracked ${plural(unverified, "creator is", "creators are")} not identity-verified`,
      evidence:
        "Their figures are observed from official APIs but not confirmed by the creator's own account.",
      href: "/help/verification",
      actionLabel: "How it works",
    });
  }

  const live = campaigns.filter((campaign) => campaign.status === "live");
  for (const campaign of live) {
    const pending = campaign.participantCount - campaign.confirmedCount;
    if (pending > 0) {
      insights.push({
        id: `campaign-pending-${campaign.id}`,
        kind: "caution",
        figure: String(pending),
        headline: `${campaign.name} is live with ${pending} ${plural(pending, "creator", "creators")} unconfirmed`,
        evidence: `${campaign.confirmedCount} of ${campaign.participantCount} confirmed · tracking #${campaign.hashtag}`,
        href: `/campaigns/${campaign.id}`,
        actionLabel: "Open",
      });
    } else if (campaign.attributedPosts > 0) {
      insights.push({
        id: `campaign-live-${campaign.id}`,
        kind: "positive",
        figure: String(campaign.attributedPosts),
        headline: `${campaign.name} has attributed ${campaign.attributedPosts} ${plural(campaign.attributedPosts, "post", "posts")}`,
        evidence: `Matched to #${campaign.hashtag} across ${campaign.confirmedCount} confirmed ${plural(campaign.confirmedCount, "creator", "creators")}.`,
        href: `/campaigns/${campaign.id}`,
        actionLabel: "Open",
      });
    }
  }

  if (portfolio.stale > 0) {
    insights.push({
      id: "stale",
      kind: "neutral",
      figure: String(portfolio.stale),
      headline: `${portfolio.stale} tracked ${plural(portfolio.stale, "profile is", "profiles are")} past the refresh window`,
      evidence: "Last observation is more than 48 hours old; figures may have moved.",
      href: "/shortlists",
    });
  }

  return insights;
}

function plural(count: number, one: string, many: string) {
  return count === 1 ? one : many;
}

export function workspaceIntelligence(user: SessionUser): WorkspaceIntelligence {
  const shortlists = listShortlists(user);
  const campaigns = listCampaigns(user);

  const seen = new Set<string>();
  const creators: InfluencerSummary[] = [];
  for (const shortlist of shortlists) {
    for (const item of getShortlist(user, shortlist.id)?.items ?? []) {
      if (seen.has(item.influencerId)) continue;
      seen.add(item.influencerId);
      // The summary is the scored view; a shortlist row carries only what was
      // copied onto it when the creator was saved.
      const summary = toSummary(item.influencerId);
      if (summary) creators.push(summary);
    }
  }

  const portfolio = portfolioSignal(creators);

  return {
    portfolio,
    campaigns,
    liveCampaigns: campaigns.filter((campaign) => campaign.status === "live"),
    insights: buildInsights(portfolio, campaigns),
    shortlistCount: shortlists.length,
  };
}

/**
 * The reading for each shortlist, computed the same way the roster is.
 *
 * A shortlist index that shows only a name and a count makes the user open
 * every list to find out which one is worth opening. These are the four facts
 * that answer that from the index: how good the roster is, how big it is, how
 * much of it is measurable, and whether anything on it is flagged.
 */
export interface ShortlistSignal {
  id: string;
  tracked: number;
  medianHealth: number | null;
  medianConfidence: number | null;
  totalReach: number | null;
  verified: number;
  flagged: number;
  unmeasurable: number;
}

export function shortlistSignals(user: SessionUser): ShortlistSignal[] {
  return listShortlists(user).map((shortlist) => {
    const creators = (getShortlist(user, shortlist.id)?.items ?? [])
      .map((item) => toSummary(item.influencerId))
      .filter((summary): summary is InfluencerSummary => summary !== null);
    const signal = portfolioSignal(creators);
    return {
      id: shortlist.id,
      tracked: signal.tracked,
      medianHealth: signal.medianHealth,
      medianConfidence: signal.medianConfidence,
      totalReach: signal.totalReach,
      verified: signal.verified,
      flagged: signal.flagged,
      unmeasurable: signal.risk.unknown,
    };
  });
}
