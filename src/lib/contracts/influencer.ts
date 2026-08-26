import { z } from "zod";
import {
  ActivityStatus,
  Category,
  DataConfidence,
  EvidenceItem,
  Platform,
  Provenance,
  RiskLevel,
  VerificationStatus,
} from "./common";
import { CampaignFit, HealthScore, RiskSignals } from "./score";

/* ---------------------------------------------------------------------------
 * Canonical influencer identity — DPR §16
 *
 * One creator, many social accounts. The canonical record never carries
 * platform-specific fields; adding a platform must not change this shape.
 * ------------------------------------------------------------------------ */

export const SocialAccount = z.object({
  id: z.string(),
  platform: Platform,
  /** Immutable platform-side identifier (channel id, IG user id). */
  platformAccountId: z.string(),
  handle: z.string(),
  url: z.string().url(),
  /** True when this account drives the creator's headline metrics. */
  isPrimary: z.boolean(),
  /** OAuth connected. Distinct from the creator being SocialOrbit Verified. */
  isConnected: z.boolean(),
  connectedAt: z.string().datetime().nullable(),
  /** Set when a connected token needs re-consent (DPR §21). */
  needsReauth: z.boolean().default(false),
  followers: z.number().int().nonnegative().nullable(),
  lastSyncedAt: z.string().datetime().nullable(),
});
export type SocialAccount = z.infer<typeof SocialAccount>;

/** DPR §9.2 — "Channel/Profile at a glance". */
export const ProfileGlance = z.object({
  followers: z.number().int().nullable(),
  totalViews: z.number().int().nullable(),
  contentCount: z.number().int().nullable(),
  medianViews: z.number().int().nullable(),
  averageViews: z.number().int().nullable(),
  /** Current snapshot minus the seven-day-prior snapshot. Null until history exists. */
  viewsGained7d: z.number().int().nullable(),
  followersGained7d: z.number().int().nullable(),
  /** Publications per week over the selected window. */
  uploadFrequency: z.number().nullable(),
  /** Seconds. Only where the platform reports duration. */
  averageContentLength: z.number().nullable(),
  engagementRate: z.number().nullable(),
  /** Modelled, never observed — the UI must label it. */
  estimatedMonthlyEarnings: z
    .object({ currency: z.string(), low: z.number(), high: z.number() })
    .nullable(),
  estimatedMonthlyReach: z.number().int().nullable(),
});
export type ProfileGlance = z.infer<typeof ProfileGlance>;

/** AI-produced classification. Every field here is inferred and labelled. */
export const AiProfileIntelligence = z.object({
  summary: z.string(),
  /** The "What the signals say" panel — grounded in stored metrics only. */
  signalReading: z.string(),
  creatorType: z.string(),
  contentThemes: z.array(z.string()),
  audienceIntent: z.string().nullable(),
  commercialIntent: z.number().min(0).max(100),
  brandSafetyScore: z.number().min(0).max(100),
  sponsorshipSignals: z.array(z.string()),
  recommendedIndustries: z.array(z.string()),
  strengths: z.array(z.string()),
  risks: z.array(z.string()),
  evidence: z.array(EvidenceItem),
  provider: z.string(),
  model: z.string(),
  promptVersion: z.string(),
  schemaVersion: z.string(),
  generatedAt: z.string().datetime(),
});
export type AiProfileIntelligence = z.infer<typeof AiProfileIntelligence>;

/** Where the creator's own audience is — only from authorized sources. */
export const AudienceBreakdown = z.object({
  /** Null when no connected account authorizes demographic data. */
  available: z.boolean(),
  reason: z.string().nullable(),
  countries: z.array(z.object({ code: z.string(), name: z.string(), share: z.number() })),
  languages: z.array(z.object({ code: z.string(), name: z.string(), share: z.number() })),
  ageBands: z.array(z.object({ band: z.string(), share: z.number() })),
  gender: z.array(z.object({ label: z.string(), share: z.number() })),
  provenance: Provenance.nullable(),
});
export type AudienceBreakdown = z.infer<typeof AudienceBreakdown>;

/** Category + follower-band percentile position — DPR §19.1. */
export const BenchmarkPosition = z.object({
  category: Category,
  followerBand: z.string(),
  cohortSize: z.number().int(),
  metrics: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      value: z.number(),
      categoryMedian: z.number(),
      top25: z.number(),
      top10: z.number(),
      percentile: z.number().min(0).max(100),
      /** Higher is better for most metrics; false for risk-style metrics. */
      higherIsBetter: z.boolean(),
    }),
  ),
  computedAt: z.string().datetime(),
});
export type BenchmarkPosition = z.infer<typeof BenchmarkPosition>;

export const ContentItem = z.object({
  id: z.string(),
  platform: Platform,
  title: z.string(),
  url: z.string().url(),
  thumbnailUrl: z.string().url().nullable(),
  publishedAt: z.string().datetime(),
  views: z.number().int().nullable(),
  likes: z.number().int().nullable(),
  comments: z.number().int().nullable(),
  shares: z.number().int().nullable(),
  durationSeconds: z.number().int().nullable(),
  engagementRate: z.number().nullable(),
  /** Views as a multiple of this creator's own median. 1.0 is typical for them. */
  performanceIndex: z.number().nullable(),
  /** Flagged by the anomaly detector as outside this creator's own range. */
  isAnomalous: z.boolean().default(false),
  isSponsored: z.boolean().nullable(),
});
export type ContentItem = z.infer<typeof ContentItem>;

/** A point on a historical chart. Snapshots, never overwritten. */
export const SnapshotPoint = z.object({
  date: z.string(),
  followers: z.number().int().nullable(),
  views: z.number().int().nullable(),
  engagementRate: z.number().nullable(),
  contentCount: z.number().int().nullable(),
});
export type SnapshotPoint = z.infer<typeof SnapshotPoint>;

/**
 * Charts render a "building history" state rather than a misleading line when
 * there are too few snapshots. DPR §10.2 makes this formal behaviour.
 */
export const HistorySeries = z.object({
  points: z.array(SnapshotPoint),
  /** Snapshots required before the series is considered readable. */
  minimumPoints: z.number().int(),
  sufficient: z.boolean(),
  firstObservedAt: z.string().datetime().nullable(),
});
export type HistorySeries = z.infer<typeof HistorySeries>;

/** The shape a search result card renders — DPR §11.4. */
export const InfluencerSummary = z.object({
  id: z.string(),
  displayName: z.string(),
  primaryHandle: z.string(),
  avatarUrl: z.string().nullable(),
  verification: VerificationStatus,
  platforms: z.array(Platform),
  primaryPlatform: Platform,
  followers: z.number().int().nullable(),
  medianViews: z.number().int().nullable(),
  engagementRate: z.number().nullable(),
  healthScore: z.number().min(0).max(100).nullable(),
  campaignFit: z.number().min(0).max(100).nullable(),
  risk: RiskLevel,
  categories: z.array(Category),
  countryCode: z.string().nullable(),
  countryName: z.string().nullable(),
  languages: z.array(z.string()),
  activity: ActivityStatus,
  lastActiveAt: z.string().datetime().nullable(),
  confidence: z.number().min(0).max(100),
});
export type InfluencerSummary = z.infer<typeof InfluencerSummary>;

/** The full profile — DPR §9, §20. */
export const InfluencerProfile = InfluencerSummary.extend({
  bio: z.string().nullable(),
  status: z.enum(["draft", "in_review", "published", "archived"]),
  socialAccounts: z.array(SocialAccount),
  glance: ProfileGlance,
  health: HealthScore,
  riskSignals: RiskSignals,
  fit: CampaignFit,
  confidenceDetail: DataConfidence,
  ai: AiProfileIntelligence.nullable(),
  audience: AudienceBreakdown,
  benchmarks: BenchmarkPosition.nullable(),
  topContent: z.array(ContentItem),
  recentContent: z.array(ContentItem),
  followerHistory: HistorySeries,
  engagementHistory: HistorySeries,
  lastRefreshedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
});
export type InfluencerProfile = z.infer<typeof InfluencerProfile>;
