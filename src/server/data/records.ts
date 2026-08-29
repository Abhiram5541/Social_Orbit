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
 * A fixed reference instant, for tests and anything that must be reproducible.
 *
 * Reads do **not** default to this. They once did, back when the database was a
 * frozen fixture set and a frozen clock cost nothing. Against live data it
 * quietly broke everything time-relative: scores recomputed on every request
 * were stamped with this date, so a profile refreshed a minute ago reported
 * "computed 3 days ago" and drifted further every day, while days-since-last-
 * upload and activity status were all measured from a date in the past.
 *
 * Analytics and scoring still take `now` as a parameter, so passing this value
 * gives an exactly reproducible result whenever a test needs one.
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
  /**
   * Categories the model inferred. Deliberately separate from
   * `RawInfluencer.categories`, which is what YouTube itself published: one is
   * an observation and the other an inference, and the platform does not store
   * them in the same field.
   */
  categories: Category[];
  creatorType: string;
  contentThemes: string[];
  audienceIntent: string;
  commercialIntent: number;
  brandSafetyScore: number;
  commentQuality: number;
  sponsorshipSignals: string[];
  recommendedIndustries: string[];
  /** Language the creator publishes in, as classified. Distinct from the
   *  `languages` on the influencer, which the creator declared on their videos. */
  primaryLanguage: string | null;
  creatorInterests: string[];
  creatorKeywords: string[];
  mentionedBrands: string[];
  mentionedProducts: string[];
  brandAffinity: string[];
  competitorAffinity: string[];
  /** Only where the material states a commercial relationship. */
  previousCollaborations: { brand: string; evidence: string; sourceUrl: string | null }[];
  /** The thirteen advertiser-facing checks, each graded with what was seen. */
  safetyChecks: Record<string, { level: "none" | "low" | "moderate" | "high"; note: string }>;
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
 * `signals` and `audience` are the slots for facts a public API cannot reach:
 * audience-quality signals and demographics need OAuth. They stay empty until
 * that credential exists, and the scoring engine renormalises around what is
 * missing rather than substituting a number nobody measured.
 *
 * `ai` is populated once enrichment has run over a creator.
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

/**
 * Memoised against the store's revision. Reads call this once per influencer,
 * and a cohort pass calls it once per influencer in the database, so rebuilding
 * the view per call would copy every content row tens of thousands of times in
 * a single request.
 */
let view: { revision: number; data: DataView } | null = null;

/**
 * Fills in fields added after a record was written.
 *
 * Enrichment schemas version independently of the store, so a database holds
 * records from every schema that has ever run. Normalising here — the one place
 * the driver hands data to the rest of the application — means no consumer has
 * to know which version produced a row. The alternative is every component
 * guarding every field, and forgetting one renders a 500 instead of a profile.
 *
 * The defaults are empty, never invented: a record written before a field
 * existed has no value for it, and an empty list says so honestly.
 */
function normaliseAi(output: RawAiOutput): RawAiOutput {
  return {
    ...output,
    primaryLanguage: output.primaryLanguage ?? null,
    creatorInterests: output.creatorInterests ?? [],
    creatorKeywords: output.creatorKeywords ?? [],
    mentionedBrands: output.mentionedBrands ?? [],
    mentionedProducts: output.mentionedProducts ?? [],
    brandAffinity: output.brandAffinity ?? [],
    competitorAffinity: output.competitorAffinity ?? [],
    previousCollaborations: output.previousCollaborations ?? [],
    // Empty rather than thirteen "not observed" rows: this creator was never
    // checked, and the panel must say that rather than imply a pass.
    safetyChecks: output.safetyChecks ?? {},
    categories: output.categories ?? [],
    contentThemes: output.contentThemes ?? [],
    sponsorshipSignals: output.sponsorshipSignals ?? [],
    recommendedIndustries: output.recommendedIndustries ?? [],
    strengths: output.strengths ?? [],
    risks: output.risks ?? [],
    evidence: output.evidence ?? [],
  };
}

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
      ai: new Map(ingested.ai.map((output) => [output.influencerId, normaliseAi(output)])),
    },
  };
  return view.data;
}
