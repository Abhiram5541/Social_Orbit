import type { Category, Platform } from "@/lib/contracts/common";
import { ingestedRecords } from "./ingested-store";

/* ---------------------------------------------------------------------------
 * Record shapes and the driver's read view — see README.md in this directory.
 *
 * Raw, platform-shaped observations only. Every analytic, score, band, risk
 * level and confidence figure in the product is computed from these by the real
 * engines at read time, so nothing here is ever a pre-baked result.
 *
 * There is no generator any more. The database is built from real channels
 * through `src/server/connectors`, and these types describe what a connector
 * writes. Under the Postgres driver they become table rows and this file's
 * read view is replaced by queries.
 * ------------------------------------------------------------------------ */

/**
 * The reference instant reads default to.
 *
 * Analytics take `now` as a parameter so a score is reproducible rather than
 * dependent on when it happened to run. Callers that want live figures pass
 * their own clock.
 */
export const EPOCH = new Date("2026-08-26T09:00:00.000Z");

/* --- Raw record shapes -------------------------------------------------- */

export interface RawAccount {
  id: string;
  influencerId: string;
  platform: Platform;
  platformAccountId: string;
  handle: string;
  url: string;
  isPrimary: boolean;
  isConnected: boolean;
  connectedAt: string | null;
  needsReauth: boolean;
  followers: number;
  totalViews: number | null;
  contentCount: number;
  lastSyncedAt: string;
}

export interface RawSnapshot {
  accountId: string;
  date: string;
  followers: number;
  views: number | null;
  contentCount: number;
}

export interface RawContent {
  id: string;
  accountId: string;
  influencerId: string;
  platform: Platform;
  title: string;
  url: string;
  thumbnailUrl: string | null;
  publishedAt: string;
  views: number | null;
  /** Null where the creator hides likes or has disabled comments. */
  likes: number | null;
  comments: number | null;
  /** Null where the platform reports no share count at all. */
  shares: number | null;
  durationSeconds: number | null;
  /** Null where disclosure is not visible to us — absent is not "not sponsored". */
  isSponsored: boolean | null;
  caption: string;
  hashtags: string[];
  /** YouTube's own video category id. Observed platform classification. */
  platformCategoryId: string | null;
}

/**
 * Audience data exists only where a connected professional account authorises
 * it. Unconnected creators legitimately have none, and the UI says so rather
 * than inventing a breakdown.
 */
export interface RawAudience {
  influencerId: string;
  countries: { code: string; name: string; share: number }[];
  languages: { code: string; name: string; share: number }[];
  ageBands: { band: string; share: number }[];
  gender: { label: string; share: number }[];
  collectedAt: string;
}

/** Classifications a model produced. Kept apart from measurements by design. */
export interface RawAiOutput {
  influencerId: string;
  creatorType: string;
  contentThemes: string[];
  audienceIntent: string;
  commercialIntent: number;
  brandSafetyScore: number;
  commentQuality: number;
  sponsorshipSignals: string[];
  recommendedIndustries: string[];
  strengths: string[];
  risks: string[];
  evidence: { claim: string; sourceUrl: string | null; confidence: number }[];
  provider: string;
  model: string;
  promptVersion: string;
  schemaVersion: string;
  generatedAt: string;
}

/** Audience-quality signals a connector/inference step measured. */
export interface RawAudienceSignals {
  influencerId: string;
  botRisk: number;
  inactiveAudience: number;
  evidence: { signal: string; observation: string; weight: "supporting" | "primary" }[];
}

export interface RawInfluencer {
  id: string;
  displayName: string;
  primaryHandle: string;
  avatarUrl: string | null;
  bio: string;
  status: "draft" | "in_review" | "published" | "archived";
  isConnected: boolean;
  identityMatched: boolean;
  categories: Category[];
  countryCode: string;
  countryName: string;
  languages: string[];
  primaryPlatform: Platform;
  createdAt: string;
  lastRefreshedAt: string;
  conflictCount: number;
}

/* --- Read view ----------------------------------------------------------- */

/**
 * Everything the repository layer reads.
 *
 * `signals`, `audience` and `ai` are the slots for facts a public API cannot
 * reach: audience-quality signals and demographics need OAuth, and
 * classifications need an AI provider. They stay empty until those credentials
 * exist, and the scoring engine renormalises around what is missing rather
 * than substituting a number nobody measured.
 */
export interface DataView {
  influencers: RawInfluencer[];
  accounts: RawAccount[];
  snapshots: RawSnapshot[];
  content: RawContent[];
  signals: Map<string, RawAudienceSignals>;
  audience: Map<string, RawAudience>;
  ai: Map<string, RawAiOutput>;
}

const NO_SIGNALS: DataView["signals"] = new Map();
const NO_AUDIENCE: DataView["audience"] = new Map();
const NO_AI: DataView["ai"] = new Map();

/**
 * Memoised against the store's revision. Reads call this once per influencer,
 * and a cohort pass calls it once per influencer in the database, so rebuilding
 * the view per call would copy every content row tens of thousands of times in
 * a single request.
 */
let view: { revision: number; data: DataView } | null = null;

export function readRecords(): DataView {
  const ingested = ingestedRecords();
  if (view?.revision === ingested.revision) return view.data;

  view = {
    revision: ingested.revision,
    data: {
      influencers: ingested.influencers,
      accounts: ingested.accounts,
      snapshots: ingested.snapshots,
      content: ingested.content,
      signals: NO_SIGNALS,
      audience: NO_AUDIENCE,
      ai: NO_AI,
    },
  };
  return view.data;
}
