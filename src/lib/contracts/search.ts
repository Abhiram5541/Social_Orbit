import { z } from "zod";
import { ActivityStatus, Category, Platform, RiskLevel, VerificationStatus } from "./common";

/* ---------------------------------------------------------------------------
 * Advanced search & discovery — DPR §11
 *
 * One schema drives the filter UI, the URL query string, the internal search
 * endpoint and the public /v1/influencers endpoint. They cannot drift.
 * ------------------------------------------------------------------------ */

export const SortKey = z.enum([
  "relevance",
  "health_score_desc",
  "followers_desc",
  "followers_asc",
  "engagement_desc",
  "median_views_desc",
  "growth_desc",
  "campaign_fit_desc",
  "last_active_desc",
]);
export type SortKey = z.infer<typeof SortKey>;

export const SORT_LABEL: Record<SortKey, string> = {
  relevance: "Best match",
  health_score_desc: "Health score",
  followers_desc: "Followers — high to low",
  followers_asc: "Followers — low to high",
  engagement_desc: "Engagement rate",
  median_views_desc: "Median views",
  growth_desc: "Growth",
  campaign_fit_desc: "Campaign fit",
  last_active_desc: "Recently active",
};

/** Named follower bands, used for both filtering and benchmark cohorts. */
export const FollowerBand = z.enum([
  "nano", // 1K–10K
  "micro", // 10K–100K
  "mid", // 100K–500K
  "macro", // 500K–1M
  "mega", // 1M+
]);
export type FollowerBand = z.infer<typeof FollowerBand>;

export const FOLLOWER_BANDS: Record<FollowerBand, { label: string; min: number; max: number | null }> = {
  nano: { label: "Nano · 1K–10K", min: 1_000, max: 10_000 },
  micro: { label: "Micro · 10K–100K", min: 10_000, max: 100_000 },
  mid: { label: "Mid · 100K–500K", min: 100_000, max: 500_000 },
  macro: { label: "Macro · 500K–1M", min: 500_000, max: 1_000_000 },
  mega: { label: "Mega · 1M+", min: 1_000_000, max: null },
};

const csv = <T extends z.ZodTypeAny>(item: T) =>
  z.preprocess(
    (raw) =>
      typeof raw === "string"
        ? raw.split(",").map((s) => s.trim()).filter(Boolean)
        : raw,
    z.array(item),
  );

export const SearchQuery = z.object({
  /** Free text across name, handle, bio keywords and content themes. */
  q: z.string().trim().max(120).optional(),

  platform: csv(Platform).optional(),
  category: csv(Category).optional(),
  country: csv(z.string().length(2)).optional(),
  language: csv(z.string().min(2).max(5)).optional(),
  verification: csv(VerificationStatus).optional(),
  activity: csv(ActivityStatus).optional(),
  risk: csv(RiskLevel).optional(),
  followerBand: csv(FollowerBand).optional(),

  followersMin: z.coerce.number().int().nonnegative().optional(),
  followersMax: z.coerce.number().int().positive().optional(),
  engagementMin: z.coerce.number().min(0).max(100).optional(),
  medianViewsMin: z.coerce.number().int().nonnegative().optional(),
  growthMin: z.coerce.number().optional(),

  healthMin: z.coerce.number().min(0).max(100).optional(),
  authenticityMin: z.coerce.number().min(0).max(100).optional(),
  campaignFitMin: z.coerce.number().min(0).max(100).optional(),

  /** SocialOrbit ROI model, not a universal claim — DPR §11.3. */
  roiCategory: z.enum(["high", "medium", "any"]).optional(),

  sort: SortKey.default("relevance"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type SearchQuery = z.infer<typeof SearchQuery>;

/** Facet counts so filters can show how many results each option would yield. */
export const SearchFacet = z.object({
  key: z.string(),
  buckets: z.array(z.object({ value: z.string(), label: z.string(), count: z.number().int() })),
});
export type SearchFacet = z.infer<typeof SearchFacet>;

/**
 * Returned alongside every search so the UI can show remaining allowance and
 * upgrade messaging. The count is authoritative and server-side (Arch §3).
 */
export const SearchQuota = z.object({
  limit: z.number().int().nullable(), // null = unlimited
  used: z.number().int(),
  remaining: z.number().int().nullable(),
  periodStart: z.string().datetime(),
  resetsAt: z.string().datetime(),
  plan: z.string(),
});
export type SearchQuota = z.infer<typeof SearchQuota>;

/** Serialise a query back into a URL search string, omitting defaults. */
export function toSearchParams(query: Partial<SearchQuery>): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      params.set(key, value.join(","));
    } else {
      params.set(key, String(value));
    }
  }
  if (params.get("sort") === "relevance") params.delete("sort");
  if (params.get("page") === "1") params.delete("page");
  if (params.get("pageSize") === "25") params.delete("pageSize");
  return params;
}

/** Filters that count as "narrowing" — used for the active-filter chip row. */
export const FILTERABLE_KEYS = [
  "platform",
  "category",
  "country",
  "language",
  "verification",
  "activity",
  "risk",
  "followerBand",
  "followersMin",
  "followersMax",
  "engagementMin",
  "medianViewsMin",
  "growthMin",
  "healthMin",
  "authenticityMin",
  "campaignFitMin",
  "roiCategory",
] as const satisfies readonly (keyof SearchQuery)[];

export function countActiveFilters(query: Partial<SearchQuery>): number {
  return FILTERABLE_KEYS.reduce((total, key) => {
    const value = query[key];
    if (value === undefined || value === null) return total;
    if (Array.isArray(value)) return total + value.length;
    return total + 1;
  }, 0);
}
