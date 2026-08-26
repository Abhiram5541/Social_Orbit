import { z } from "zod";
import { Platform } from "./common";

/* ---------------------------------------------------------------------------
 * Campaign Management — Architecture doc §8–§11
 *
 * Campaign performance is deliberately kept separate from general influencer
 * intelligence. The same creator has a health score (who they are) and a
 * campaign score (how they performed for you). Merging them would destroy the
 * one question campaigns exist to answer.
 * ------------------------------------------------------------------------ */

export const CampaignStatus = z.enum([
  "draft",
  "planning",
  "live",
  "completed",
  "archived",
]);
export type CampaignStatus = z.infer<typeof CampaignStatus>;

export const CAMPAIGN_STATUS_LABEL: Record<CampaignStatus, string> = {
  draft: "Draft",
  planning: "Planning",
  live: "Live",
  completed: "Completed",
  archived: "Archived",
};

export const ParticipantStatus = z.enum([
  "shortlisted",
  "invited",
  "negotiating",
  "confirmed",
  "delivering",
  "delivered",
  "declined",
]);
export type ParticipantStatus = z.infer<typeof ParticipantStatus>;

/**
 * Hashtag-based content detection — Arch §10. A campaign without a tracking
 * hashtag has no way to attribute posts, so it is required before going live.
 */
export const TrackingHashtag = z
  .string()
  .trim()
  .transform((v) => (v.startsWith("#") ? v.slice(1) : v))
  .pipe(
    z
      .string()
      .min(3, "Use at least 3 characters")
      .max(60)
      .regex(/^[A-Za-z0-9_]+$/, "Letters, numbers and underscores only"),
  );

export const CampaignInput = z.object({
  name: z.string().trim().min(2, "Name the campaign").max(120),
  brief: z.string().trim().max(4000).optional(),
  hashtag: TrackingHashtag,
  platforms: z.array(Platform).min(1, "Select at least one platform"),
  startsOn: z.string().date(),
  endsOn: z.string().date(),
  budgetCurrency: z.string().length(3).default("INR"),
  budgetAmount: z.number().nonnegative().nullable(),
});
export type CampaignInput = z.infer<typeof CampaignInput>;

/** Per-influencer campaign results — Arch §11. Only from attributed posts. */
export const CampaignPerformance = z.object({
  reach: z.number().int().nullable(),
  views: z.number().int().nullable(),
  likes: z.number().int().nullable(),
  comments: z.number().int().nullable(),
  shares: z.number().int().nullable(),
  engagementRate: z.number().nullable(),
  /** Posts matched to the campaign hashtag. */
  attributedPosts: z.number().int(),
  /** Deterministic, versioned, separate from the health score. */
  campaignScore: z.number().min(0).max(100).nullable(),
  costPerEngagement: z.number().nullable(),
  formulaVersion: z.string(),
  computedAt: z.string().datetime().nullable(),
});
export type CampaignPerformance = z.infer<typeof CampaignPerformance>;

export const CampaignParticipant = z.object({
  id: z.string(),
  influencerId: z.string(),
  displayName: z.string(),
  primaryHandle: z.string(),
  avatarUrl: z.string().nullable(),
  primaryPlatform: Platform,
  followers: z.number().int().nullable(),
  status: ParticipantStatus,
  /** The creator's stated rate. Null until supplied — never inferred (Arch §9). */
  talentRate: z.number().nullable(),
  /** What the client proposes to pay. */
  clientRate: z.number().nullable(),
  agreedRate: z.number().nullable(),
  currency: z.string(),
  healthScore: z.number().nullable(),
  campaignFit: z.number().nullable(),
  performance: CampaignPerformance,
});
export type CampaignParticipant = z.infer<typeof CampaignParticipant>;

export const CampaignSummary = z.object({
  id: z.string(),
  orgId: z.string(),
  name: z.string(),
  hashtag: z.string(),
  status: CampaignStatus,
  platforms: z.array(Platform),
  startsOn: z.string().date(),
  endsOn: z.string().date(),
  participantCount: z.number().int(),
  confirmedCount: z.number().int(),
  budgetCurrency: z.string(),
  budgetAmount: z.number().nullable(),
  spentAmount: z.number().nullable(),
  totalReach: z.number().int().nullable(),
  totalEngagements: z.number().int().nullable(),
  attributedPosts: z.number().int(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type CampaignSummary = z.infer<typeof CampaignSummary>;

export const CampaignDetail = CampaignSummary.extend({
  brief: z.string().nullable(),
  participants: z.array(CampaignParticipant),
  /** Daily attributed performance, for the campaign trend chart. */
  timeline: z.array(
    z.object({
      date: z.string(),
      posts: z.number().int(),
      views: z.number().int(),
      engagements: z.number().int(),
    }),
  ),
  /** Posts the tracker matched to the hashtag, newest first. */
  attributedContent: z.array(
    z.object({
      id: z.string(),
      influencerId: z.string(),
      influencerName: z.string(),
      platform: Platform,
      url: z.string().url(),
      thumbnailUrl: z.string().nullable(),
      caption: z.string(),
      publishedAt: z.string().datetime(),
      views: z.number().int().nullable(),
      engagements: z.number().int().nullable(),
      matchedAt: z.string().datetime(),
    }),
  ),
});
export type CampaignDetail = z.infer<typeof CampaignDetail>;

/* --- Shortlists — DPR UC-09 -------------------------------------------- */

export const ShortlistItem = z.object({
  id: z.string(),
  influencerId: z.string(),
  displayName: z.string(),
  primaryHandle: z.string(),
  avatarUrl: z.string().nullable(),
  primaryPlatform: Platform,
  followers: z.number().int().nullable(),
  healthScore: z.number().nullable(),
  engagementRate: z.number().nullable(),
  campaignFit: z.number().nullable(),
  note: z.string().nullable(),
  addedAt: z.string().datetime(),
  addedByName: z.string(),
});
export type ShortlistItem = z.infer<typeof ShortlistItem>;

export const Shortlist = z.object({
  id: z.string(),
  orgId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  itemCount: z.number().int(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  createdByName: z.string(),
});
export type Shortlist = z.infer<typeof Shortlist>;

export const ShortlistDetail = Shortlist.extend({
  items: z.array(ShortlistItem),
});
export type ShortlistDetail = z.infer<typeof ShortlistDetail>;

export const ShortlistInput = z.object({
  name: z.string().trim().min(2, "Name the shortlist").max(80),
  description: z.string().trim().max(500).optional(),
});
export type ShortlistInput = z.infer<typeof ShortlistInput>;
