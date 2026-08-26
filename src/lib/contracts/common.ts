import { z } from "zod";

/* ---------------------------------------------------------------------------
 * Provenance — DPR §7.1, §16.1, §22
 *
 * Every fact SocialOrbit surfaces must say where it came from. This is the
 * product's differentiator, not metadata: a follower count read from the
 * YouTube Data API and a follower count an LLM inferred from a bio are not the
 * same claim, and the UI must never render them identically.
 * ------------------------------------------------------------------------ */

/** Source tiers, highest authority first. */
export const SourceTier = z.enum([
  "platform_api", // 1 — official API. Authoritative structured metric.
  "oauth_authorized", // 2 — first-party creator analytics via OAuth consent.
  "licensed_provider", // 3 — approved third-party data provider.
  "public_research", // 4 — permitted public-web content.
  "ai_inference", // 5 — model classification. Always labelled inferred.
  "manual_entry", //     — entered by a SocialOrbit operator.
]);
export type SourceTier = z.infer<typeof SourceTier>;

/**
 * How a value should be presented to a user. Derived from the tier but stated
 * explicitly so the UI never has to re-derive presentation from source rules.
 */
export const FactKind = z.enum([
  "verified", // OAuth-confirmed first-party value
  "observed", // measured through an official API
  "derived", // computed by SocialOrbit from observed values
  "estimated", // modelled — must carry an explicit estimate label
  "inferred", // AI classification — must carry an AI label
]);
export type FactKind = z.infer<typeof FactKind>;

export const EvidenceItem = z.object({
  claim: z.string(),
  sourceUrl: z.string().url().nullable(),
  confidence: z.number().min(0).max(1),
});
export type EvidenceItem = z.infer<typeof EvidenceItem>;

/** Attached to any value whose trustworthiness the user needs to judge. */
export const Provenance = z.object({
  tier: SourceTier,
  kind: FactKind,
  /** ISO timestamp the underlying observation was collected. */
  collectedAt: z.string().datetime(),
  /** Set only once an OAuth identity match confirmed the value. */
  verifiedAt: z.string().datetime().nullable().default(null),
  sourceUrl: z.string().url().nullable().default(null),
  /** 0–100. Field-level confidence, independent of quality. */
  confidence: z.number().min(0).max(100),
  /** Present only when tier is ai_inference. */
  ai: z
    .object({
      provider: z.string(),
      model: z.string(),
      promptVersion: z.string(),
      schemaVersion: z.string(),
      generatedAt: z.string().datetime(),
    })
    .nullable()
    .default(null),
});
export type Provenance = z.infer<typeof Provenance>;

/** A value carried together with the reason to believe it. */
export function tracked<T extends z.ZodTypeAny>(value: T) {
  return z.object({ value, provenance: Provenance });
}
export type Tracked<T> = { value: T; provenance: Provenance };

/* ---------------------------------------------------------------------------
 * Confidence — DPR §10.2
 *
 * A separate axis from quality. A creator can score 91/100 on health with 40%
 * confidence; conflating the two is the single most misleading thing this
 * product could do.
 * ------------------------------------------------------------------------ */

export const ConfidenceBand = z.enum([
  "high", // 90–100
  "good", // 70–89
  "moderate", // 50–69
  "preliminary", // <50 — the UI must warn
]);
export type ConfidenceBand = z.infer<typeof ConfidenceBand>;

export const DataConfidence = z.object({
  score: z.number().min(0).max(100),
  band: ConfidenceBand,
  components: z.object({
    dataCompleteness: z.number(),
    historicalDepth: z.number(),
    sourceAuthority: z.number(),
    observationCount: z.number(),
    staleDataPenalty: z.number(),
    conflictPenalty: z.number(),
  }),
  /** Share of surfaced facts by kind — drives the profile footer readout. */
  mix: z.object({
    verified: z.number(),
    observed: z.number(),
    derived: z.number(),
    estimated: z.number(),
    inferred: z.number(),
  }),
  computedAt: z.string().datetime(),
});
export type DataConfidence = z.infer<typeof DataConfidence>;

export function confidenceBand(score: number): ConfidenceBand {
  if (score >= 90) return "high";
  if (score >= 70) return "good";
  if (score >= 50) return "moderate";
  return "preliminary";
}

/* ---------------------------------------------------------------------------
 * Platforms
 * ------------------------------------------------------------------------ */

export const Platform = z.enum(["youtube", "instagram", "tiktok"]);
export type Platform = z.infer<typeof Platform>;

/** Platforms with a working connector today. TikTok is DPR §29 roadmap. */
export const SUPPORTED_PLATFORMS: Platform[] = ["youtube", "instagram"];

export const PLATFORM_LABEL: Record<Platform, string> = {
  youtube: "YouTube",
  instagram: "Instagram",
  tiktok: "TikTok",
};

/* ---------------------------------------------------------------------------
 * Pagination — DPR §23: cursor or page, default 25–50
 * ------------------------------------------------------------------------ */

export const PageQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
export type PageQuery = z.infer<typeof PageQuery>;

export function paged<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    items: z.array(item),
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
    totalPages: z.number().int(),
  });
}
export type Paged<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

/* ---------------------------------------------------------------------------
 * Errors — one shape for every failure the API can return.
 * ------------------------------------------------------------------------ */

export const ApiErrorCode = z.enum([
  "unauthenticated",
  "forbidden",
  "not_found",
  "validation_failed",
  "rate_limited",
  "quota_exceeded",
  "conflict",
  "connector_unavailable",
  "internal_error",
]);
export type ApiErrorCode = z.infer<typeof ApiErrorCode>;

export const ApiError = z.object({
  error: z.object({
    code: ApiErrorCode,
    message: z.string(),
    /** Field-level detail for validation_failed. */
    details: z.record(z.string(), z.array(z.string())).optional(),
    /** Present on quota_exceeded so the UI can render upgrade messaging. */
    quota: z
      .object({
        limit: z.number(),
        used: z.number(),
        resetsAt: z.string().datetime(),
      })
      .optional(),
  }),
});
export type ApiError = z.infer<typeof ApiError>;

/* ---------------------------------------------------------------------------
 * Taxonomy
 * ------------------------------------------------------------------------ */

export const Category = z.enum([
  "fashion",
  "beauty",
  "technology",
  "travel",
  "food",
  "finance",
  "fitness",
  "gaming",
  "education",
  "lifestyle",
  "entertainment",
  "parenting",
  "automotive",
  "business",
  "health",
  "sports",
]);
export type Category = z.infer<typeof Category>;

export const CATEGORY_LABEL: Record<Category, string> = {
  fashion: "Fashion",
  beauty: "Beauty",
  technology: "Technology",
  travel: "Travel",
  food: "Food & Beverage",
  finance: "Finance",
  fitness: "Fitness",
  gaming: "Gaming",
  education: "Education",
  lifestyle: "Lifestyle",
  entertainment: "Entertainment",
  parenting: "Parenting",
  automotive: "Automotive",
  business: "Business",
  health: "Health & Wellness",
  sports: "Sports",
};

export const RiskLevel = z.enum(["low", "medium", "high"]);
export type RiskLevel = z.infer<typeof RiskLevel>;

export const ActivityStatus = z.enum([
  "active", // published within the expected cadence
  "recently_active", // published within 30d
  "slowing", // cadence materially below its own baseline
  "dormant", // no qualifying publication in 90d
]);
export type ActivityStatus = z.infer<typeof ActivityStatus>;

export const VerificationStatus = z.enum([
  "verified", // OAuth connected + identity matched
  "pending", // OAuth connected, checks running or awaiting review
  "unverified", // public research only
]);
export type VerificationStatus = z.infer<typeof VerificationStatus>;
