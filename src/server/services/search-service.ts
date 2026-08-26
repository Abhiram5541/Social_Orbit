import type { SessionUser } from "@/lib/contracts/auth";
import type { Paged } from "@/lib/contracts/common";
import type { InfluencerSummary } from "@/lib/contracts/influencer";
import {
  FOLLOWER_BANDS,
  type SearchFacet,
  type SearchQuery,
  type SearchQuota,
} from "@/lib/contracts/search";
import { CATEGORY_LABEL, PLATFORM_LABEL } from "@/lib/contracts/common";
import { allSummaries } from "@/server/repositories/influencer-repository";
import {
  getUsage,
  hasQuota,
  incrementUsage,
  quotaFor,
} from "@/server/repositories/usage-repository";
import { ApiFailure } from "@/server/auth/rbac";

/* ---------------------------------------------------------------------------
 * Influencer search — DPR §11.
 *
 * The business rules live here, not in the route handler and not in the
 * component. In particular the free-plan allowance is charged here, once, on
 * the searches that actually consume it.
 * ------------------------------------------------------------------------ */

export interface SearchResult {
  page: Paged<InfluencerSummary>;
  facets: SearchFacet[];
  quota: SearchQuota;
  /** True when this call consumed one of the org's metered searches. */
  charged: boolean;
}

/**
 * Only a *narrowing* search is metered. Browsing the unfiltered directory,
 * paging through results already paid for, or re-sorting them would otherwise
 * burn a free-plan client's five monthly searches in under a minute — which
 * is not what Arch §3 describes.
 */
export function isMeteredSearch(query: SearchQuery, previousSignature?: string): boolean {
  const narrowing =
    Boolean(query.q && query.q.trim().length > 0) || countFilters(query) > 0;
  if (!narrowing) return false;
  // Paging or re-sorting an identical filter set is the same search.
  return previousSignature !== signatureOf(query);
}

/** Identifies a search independently of pagination and sort order. */
export function signatureOf(query: SearchQuery): string {
  const relevant: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(query)) {
    if (key === "page" || key === "pageSize" || key === "sort") continue;
    if (value === undefined || value === null) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    relevant[key] = Array.isArray(value) ? [...value].sort() : value;
  }
  return JSON.stringify(relevant, Object.keys(relevant).sort());
}

function countFilters(query: SearchQuery): number {
  const keys: (keyof SearchQuery)[] = [
    "platform", "category", "country", "language", "verification", "activity", "risk",
    "followerBand", "followersMin", "followersMax", "engagementMin", "medianViewsMin",
    "growthMin", "healthMin", "authenticityMin", "campaignFitMin", "roiCategory",
  ];
  return keys.reduce((total, key) => {
    const value = query[key];
    if (value === undefined || value === null) return total;
    if (Array.isArray(value)) return total + (value.length > 0 ? 1 : 0);
    return total + 1;
  }, 0);
}

/* --- Matching ----------------------------------------------------------- */

function matchesText(item: InfluencerSummary, needle: string): boolean {
  const haystack = [
    item.displayName,
    item.primaryHandle,
    item.countryName ?? "",
    ...item.categories.map((category) => CATEGORY_LABEL[category]),
    ...item.languages,
  ]
    .join(" ")
    .toLowerCase();
  // Every token must appear — "tech india" narrows rather than widens.
  return needle
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((token) => haystack.includes(token));
}

function matches(item: InfluencerSummary, query: SearchQuery): boolean {
  if (query.q?.trim() && !matchesText(item, query.q.trim())) return false;

  if (query.platform?.length && !query.platform.some((p) => item.platforms.includes(p)))
    return false;
  if (query.category?.length && !query.category.some((c) => item.categories.includes(c)))
    return false;
  if (query.country?.length && !query.country.includes(item.countryCode ?? "")) return false;
  if (query.language?.length && !query.language.some((l) => item.languages.includes(l)))
    return false;
  if (query.verification?.length && !query.verification.includes(item.verification))
    return false;
  if (query.activity?.length && !query.activity.includes(item.activity)) return false;
  if (query.risk?.length && !query.risk.includes(item.risk)) return false;

  if (query.followerBand?.length) {
    const followers = item.followers ?? 0;
    const inAnyBand = query.followerBand.some((band) => {
      const { min, max } = FOLLOWER_BANDS[band];
      return followers >= min && (max === null || followers < max);
    });
    if (!inAnyBand) return false;
  }

  if (query.followersMin !== undefined && (item.followers ?? 0) < query.followersMin)
    return false;
  if (query.followersMax !== undefined && (item.followers ?? 0) > query.followersMax)
    return false;

  // A null metric fails a minimum threshold rather than passing it: an
  // unmeasured engagement rate is not evidence of a good one.
  if (query.engagementMin !== undefined && (item.engagementRate ?? -1) < query.engagementMin)
    return false;
  if (query.medianViewsMin !== undefined && (item.medianViews ?? -1) < query.medianViewsMin)
    return false;
  if (query.healthMin !== undefined && (item.healthScore ?? -1) < query.healthMin)
    return false;
  if (query.campaignFitMin !== undefined && (item.campaignFit ?? -1) < query.campaignFitMin)
    return false;

  if (query.roiCategory === "high" && (item.campaignFit ?? 0) < 75) return false;
  if (query.roiCategory === "medium" && (item.campaignFit ?? 0) < 55) return false;

  return true;
}

function sortResults(items: InfluencerSummary[], query: SearchQuery): InfluencerSummary[] {
  const byNullableDesc = (a: number | null, b: number | null) => (b ?? -1) - (a ?? -1);

  const sorted = [...items];
  switch (query.sort) {
    case "health_score_desc":
      sorted.sort((a, b) => byNullableDesc(a.healthScore, b.healthScore));
      break;
    case "followers_desc":
      sorted.sort((a, b) => byNullableDesc(a.followers, b.followers));
      break;
    case "followers_asc":
      sorted.sort((a, b) => (a.followers ?? Infinity) - (b.followers ?? Infinity));
      break;
    case "engagement_desc":
      sorted.sort((a, b) => byNullableDesc(a.engagementRate, b.engagementRate));
      break;
    case "median_views_desc":
      sorted.sort((a, b) => byNullableDesc(a.medianViews, b.medianViews));
      break;
    case "campaign_fit_desc":
      sorted.sort((a, b) => byNullableDesc(a.campaignFit, b.campaignFit));
      break;
    case "last_active_desc":
      sorted.sort((a, b) => (b.lastActiveAt ?? "").localeCompare(a.lastActiveAt ?? ""));
      break;
    case "growth_desc":
    case "relevance":
    default:
      // Relevance blends quality with how much of it we can actually vouch for,
      // so a thin, unverified profile does not outrank a well-observed one.
      sorted.sort(
        (a, b) =>
          (b.healthScore ?? 0) * 0.7 +
          b.confidence * 0.3 -
          ((a.healthScore ?? 0) * 0.7 + a.confidence * 0.3),
      );
  }
  return sorted;
}

function buildFacets(items: InfluencerSummary[]): SearchFacet[] {
  const count = <T extends string>(values: T[]): Map<T, number> => {
    const map = new Map<T, number>();
    for (const value of values) map.set(value, (map.get(value) ?? 0) + 1);
    return map;
  };

  const platforms = count(items.flatMap((item) => item.platforms));
  const categories = count(items.flatMap((item) => item.categories));
  const countries = count(
    items.map((item) => item.countryCode).filter((code): code is string => code !== null),
  );
  const countryNames = new Map(items.map((item) => [item.countryCode, item.countryName]));
  const verification = count(items.map((item) => item.verification));

  const toBuckets = <T extends string>(map: Map<T, number>, label: (value: T) => string) =>
    [...map]
      .sort((a, b) => b[1] - a[1])
      .map(([value, itemCount]) => ({ value, label: label(value), count: itemCount }));

  return [
    { key: "platform", buckets: toBuckets(platforms, (v) => PLATFORM_LABEL[v]) },
    { key: "category", buckets: toBuckets(categories, (v) => CATEGORY_LABEL[v]) },
    {
      key: "country",
      buckets: toBuckets(countries, (v) => countryNames.get(v) ?? v).slice(0, 12),
    },
    {
      key: "verification",
      buckets: toBuckets(verification, (v) =>
        v === "verified" ? "SocialOrbit Verified" : v === "pending" ? "Connection pending" : "Unverified",
      ),
    },
  ];
}

/* --- Entry point -------------------------------------------------------- */

export async function searchInfluencers(
  user: SessionUser,
  query: SearchQuery,
  options: { previousSignature?: string; now?: Date } = {},
): Promise<SearchResult> {
  const now = options.now ?? new Date();
  const metered = isMeteredSearch(query, options.previousSignature);

  let quota = quotaFor(user.orgId, user.plan, now);

  // Platform staff are not metered against a client plan.
  const chargeable = metered && user.orgKind === "client";

  if (chargeable && !hasQuota(quota)) {
    throw new ApiFailure(
      "quota_exceeded",
      `Your ${quota.plan} plan includes ${quota.limit} influencer searches per month. Upgrade to continue searching.`,
      {
        quota: { limit: quota.limit, used: quota.used, resetsAt: quota.resetsAt },
      },
    );
  }

  const all = allSummaries(now);
  const filtered = all.filter((item) => matches(item, query));
  const sorted = sortResults(filtered, query);

  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
  const page = Math.min(query.page, totalPages);
  const start = (page - 1) * query.pageSize;

  // Charged only after the search has actually succeeded — a failed request
  // must never cost a client one of five monthly searches.
  if (chargeable) {
    incrementUsage(user.orgId, "influencer_search", now);
    quota = quotaFor(user.orgId, user.plan, now);
  }

  return {
    page: {
      items: sorted.slice(start, start + query.pageSize),
      page,
      pageSize: query.pageSize,
      total,
      totalPages,
    },
    // Facets describe the unpaginated result set, so counts do not change as
    // the user pages through.
    facets: buildFacets(filtered),
    quota,
    charged: chargeable,
  };
}

/** Type-ahead for the command palette. Never metered — it is navigation. */
export function quickSearch(term: string, limit = 6): InfluencerSummary[] {
  const needle = term.trim();
  if (needle.length < 2) return [];
  return allSummaries()
    .filter((item) => matchesText(item, needle))
    .sort((a, b) => (b.healthScore ?? 0) - (a.healthScore ?? 0))
    .slice(0, limit);
}

export function usageSnapshot(orgId: string, now: Date = new Date()) {
  return {
    searches: getUsage(orgId, "influencer_search", now),
    apiRequests: getUsage(orgId, "api_request", now),
    exports: getUsage(orgId, "export", now),
    reports: getUsage(orgId, "report", now),
  };
}
