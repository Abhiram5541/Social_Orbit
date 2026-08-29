import type { Platform } from "@/lib/contracts/common";
import { readRecords, EPOCH } from "@/server/data/records";
import { allSummaries, countInfluencers } from "./influencer-repository";

/* ---------------------------------------------------------------------------
 * Platform operations — DPR §12.1, §21, §25.
 *
 * Everything countable here is counted from the actual database rather than
 * stored as a headline figure, so the admin dashboard cannot drift from what
 * the product is really holding.
 * ------------------------------------------------------------------------ */

export interface DatabaseStats {
  totalInfluencers: number;
  published: number;
  inReview: number;
  verified: number;
  connectionPending: number;
  withAuthorizedAudience: number;
  totalAccounts: number;
  totalContent: number;
  totalSnapshots: number;
  staleProfiles: number;
  lowConfidenceProfiles: number;
  conflictedProfiles: number;
  byPlatform: { platform: Platform; accounts: number; followers: number }[];
  byCategory: { category: string; count: number }[];
  byCountry: { country: string; count: number }[];
}

export function databaseStats(now: Date = new Date()): DatabaseStats {
  const data = readRecords();
  const summaries = allSummaries(now);

  const staleAfterMs = 48 * 60 * 60 * 1000;
  const staleProfiles = data.influencers.filter(
    (raw) => now.getTime() - new Date(raw.lastRefreshedAt).getTime() > staleAfterMs,
  ).length;

  const platformTotals = new Map<Platform, { accounts: number; followers: number }>();
  for (const account of data.accounts) {
    const entry = platformTotals.get(account.platform) ?? { accounts: 0, followers: 0 };
    entry.accounts += 1;
    entry.followers += account.followers;
    platformTotals.set(account.platform, entry);
  }

  const tally = <T>(values: T[]) => {
    const map = new Map<T, number>();
    for (const value of values) map.set(value, (map.get(value) ?? 0) + 1);
    return [...map].sort((a, b) => b[1] - a[1]);
  };

  return {
    totalInfluencers: countInfluencers(),
    published: data.influencers.filter((raw) => raw.status === "published").length,
    inReview: data.influencers.filter((raw) => raw.status === "in_review").length,
    verified: data.influencers.filter((raw) => raw.isConnected && raw.identityMatched).length,
    connectionPending: data.influencers.filter((raw) => raw.isConnected && !raw.identityMatched)
      .length,
    withAuthorizedAudience: data.audience.size,
    totalAccounts: data.accounts.length,
    totalContent: data.content.length,
    totalSnapshots: data.snapshots.length,
    staleProfiles,
    lowConfidenceProfiles: summaries.filter((summary) => summary.confidence < 50).length,
    conflictedProfiles: data.influencers.filter((raw) => raw.conflictCount > 0).length,
    byPlatform: [...platformTotals].map(([platform, totals]) => ({ platform, ...totals })),
    byCategory: tally(data.influencers.map((raw) => raw.categories[0])).map(
      ([category, count]) => ({ category, count }),
    ),
    byCountry: tally(data.influencers.map((raw) => raw.countryName)).map(([country, count]) => ({
      country,
      count,
    })),
  };
}

/* --- Connectors --------------------------------------------------------- */

export type ConnectorState = "live" | "credentials_missing" | "degraded" | "not_configured";

export interface ConnectorStatus {
  platform: Platform;
  state: ConnectorState;
  /** Environment variables this connector needs before it can run. */
  requires: string[];
  missing: string[];
  accountsTracked: number;
  lastSuccessfulSync: string | null;
  notes: string;
}

const CONNECTOR_REQUIREMENTS: Record<Platform, string[]> = {
  youtube: ["YOUTUBE_API_KEY", "YOUTUBE_OAUTH_CLIENT_ID", "YOUTUBE_OAUTH_CLIENT_SECRET"],
  instagram: ["META_APP_ID", "META_APP_SECRET"],
  tiktok: ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET"],
};

const CONNECTOR_NOTES: Record<Platform, string> = {
  youtube:
    "Channel resolution, channel statistics, video listings and analytics for OAuth-connected channels.",
  instagram:
    "Professional-account insights through the Instagram Graph API. Consumer accounts are not accessible and are never estimated.",
  tiktok: "Roadmap connector (DPR §29). No creators are indexed for this platform.",
};

/**
 * Connector health reports what is actually configured. A connector without
 * credentials is reported as such rather than shown "green" — a dashboard that
 * lies about its integrations is worse than no dashboard.
 */
export function connectorStatuses(now: Date = new Date()): ConnectorStatus[] {
  const data = readRecords();

  return (Object.keys(CONNECTOR_REQUIREMENTS) as Platform[]).map((platform) => {
    const requires = CONNECTOR_REQUIREMENTS[platform];
    const missing = requires.filter((key) => !process.env[key]);
    const accounts = data.accounts.filter((account) => account.platform === platform);

    const lastSync = accounts
      .map((account) => account.lastSyncedAt)
      .sort()
      .at(-1) ?? null;

    const state: ConnectorState =
      platform === "tiktok"
        ? "not_configured"
        : missing.length === requires.length
          ? "credentials_missing"
          : missing.length > 0
            ? "degraded"
            : "live";

    return {
      platform,
      state,
      requires,
      missing,
      accountsTracked: accounts.length,
      lastSuccessfulSync: lastSync,
      notes: CONNECTOR_NOTES[platform],
    };
  });
}

/* --- AI providers ------------------------------------------------------- */

export interface AiProviderStatus {
  id: "openai" | "gemini";
  label: string;
  role: string;
  configured: boolean;
  model: string | null;
  requires: string[];
}

export function aiProviderStatuses(): AiProviderStatus[] {
  return [
    {
      id: "openai",
      label: "OpenAI",
      role: "Primary extraction, classification, brand safety and score explanation.",
      configured: Boolean(process.env.OPENAI_API_KEY),
      model: process.env.OPENAI_MODEL ?? null,
      requires: ["OPENAI_API_KEY"],
    },
    {
      id: "gemini",
      label: "Google Gemini",
      role: "Secondary validation and search-grounded research on high-value or conflicting facts.",
      configured: Boolean(process.env.GEMINI_API_KEY),
      model: process.env.GEMINI_MODEL ?? null,
      requires: ["GEMINI_API_KEY"],
    },
  ];
}

/* --- Review queues ------------------------------------------------------ */

export interface ReviewItem {
  influencerId: string;
  displayName: string;
  handle: string;
  reason: string;
  detail: string;
  severity: "info" | "warning" | "critical";
  observedAt: string;
}

/** Profiles where two sources disagreed — DPR UC-12. Never silently resolved. */
export function conflictQueue(now: Date = new Date()): ReviewItem[] {
  return readRecords()
    .influencers.filter((raw) => raw.conflictCount > 0)
    .map((raw) => ({
      influencerId: raw.id,
      displayName: raw.displayName,
      handle: raw.primaryHandle,
      reason: "Source conflict",
      detail: `${raw.conflictCount} ${raw.conflictCount === 1 ? "field" : "fields"} where two sources disagree. Confidence is reduced until a reviewer resolves them.`,
      severity: "warning" as const,
      observedAt: raw.lastRefreshedAt,
    }))
    .sort((a, b) => b.observedAt.localeCompare(a.observedAt))
    .slice(0, 50);
}

/** Profiles too thin to publish a confident score against. */
export function lowConfidenceQueue(now: Date = new Date()): ReviewItem[] {
  return allSummaries(now)
    .filter((summary) => summary.confidence < 50)
    .map((summary) => ({
      influencerId: summary.id,
      displayName: summary.displayName,
      handle: summary.primaryHandle,
      reason: "Preliminary confidence",
      detail: `Confidence ${Math.round(summary.confidence)}%. Not enough history, completeness or source authority to publish these numbers without a warning.`,
      severity: "info" as const,
      observedAt: summary.lastActiveAt ?? EPOCH.toISOString(),
    }))
    .sort((a, b) => a.detail.localeCompare(b.detail))
    .slice(0, 50);
}

/** Creators who have connected an account but not yet passed identity matching. */
export function verificationQueue(): ReviewItem[] {
  return readRecords()
    .influencers.filter((raw) => raw.isConnected && !raw.identityMatched)
    .map((raw) => ({
      influencerId: raw.id,
      displayName: raw.displayName,
      handle: raw.primaryHandle,
      reason: "Awaiting identity match",
      detail:
        "OAuth consent completed. Verified status is issued only once the connected platform identity matches the claimed profile.",
      severity: "info" as const,
      observedAt: raw.lastRefreshedAt,
    }));
}

/** Accounts whose stored tokens need re-consent — DPR §21. */
export function reauthQueue(): ReviewItem[] {
  const data = readRecords();
  return data.accounts
    .filter((account) => account.needsReauth)
    .map((account) => {
      const influencer = data.influencers.find((raw) => raw.id === account.influencerId)!;
      return {
        influencerId: influencer.id,
        displayName: influencer.displayName,
        handle: influencer.primaryHandle,
        reason: "OAuth reauthorisation required",
        detail: `The stored ${account.platform} token can no longer be refreshed. Authorized metrics for this account are frozen until the creator reconnects.`,
        severity: "critical" as const,
        observedAt: account.lastSyncedAt,
      };
    });
}

/* --- Audit -------------------------------------------------------------- */

export interface AuditEntry {
  id: string;
  at: string;
  actor: string;
  action: string;
  target: string;
  detail: string;
  ip: string;
}

/**
 * Audit history — DPR §26.
 *
 * ponytail: reads from a fixed development log. The Postgres implementation
 * writes a row from `writeAudit()` on every privileged mutation; the read shape
 * here is already what that table will return.
 */
const AUDIT: AuditEntry[] = [
  { id: "aud_012", at: "2026-08-26T08:31:00.000Z", actor: "owner@northwind.example", action: "auth.login", target: "session", detail: "Password sign-in succeeded", ip: "203.0.113.24" },
  { id: "aud_011", at: "2026-08-26T07:12:00.000Z", actor: "admin@socialorbit.io", action: "scoring.config_read", target: "health-1.0.0", detail: "Viewed scoring weights", ip: "198.51.100.9" },
  { id: "aud_010", at: "2026-08-26T06:05:00.000Z", actor: "analyst@socialorbit.io", action: "auth.login", target: "session", detail: "Password sign-in succeeded", ip: "198.51.100.14" },
  { id: "aud_009", at: "2026-08-25T16:44:00.000Z", actor: "manager@socialorbit.io", action: "influencer.publish", target: "inf_0031", detail: "Draft approved and published after review", ip: "198.51.100.7" },
  { id: "aud_008", at: "2026-08-25T16:40:00.000Z", actor: "manager@socialorbit.io", action: "verification.approve", target: "inf_0031", detail: "Identity match passed; SocialOrbit Verified issued", ip: "198.51.100.7" },
  { id: "aud_007", at: "2026-08-25T11:18:00.000Z", actor: "member@northwind.example", action: "shortlist.item_add", target: "sl_q4_tech", detail: "Added inf_0017", ip: "203.0.113.51" },
  { id: "aud_006", at: "2026-08-24T09:02:00.000Z", actor: "hello@lumen.example", action: "auth.login", target: "session", detail: "Password sign-in succeeded", ip: "203.0.113.88" },
  { id: "aud_005", at: "2026-08-23T14:20:00.000Z", actor: "admin@socialorbit.io", action: "api_key.revoke", target: "key_3f9a", detail: "Key revoked at customer request", ip: "198.51.100.9" },
  { id: "aud_004", at: "2026-08-22T10:03:00.000Z", actor: "admin@socialorbit.io", action: "user.role_change", target: "usr_client_member", detail: "client_member granted (was none)", ip: "198.51.100.9" },
  { id: "aud_003", at: "2026-08-21T09:15:00.000Z", actor: "member@northwind.example", action: "shortlist.create", target: "sl_beauty_always_on", detail: "Shortlist created", ip: "203.0.113.51" },
  { id: "aud_002", at: "2026-08-20T18:41:00.000Z", actor: "system", action: "ingestion.dead_letter", target: "inf_0044:youtube", detail: "Refresh failed 5 times; moved to dead-letter queue", ip: "—" },
  { id: "aud_001", at: "2026-08-19T08:20:00.000Z", actor: "owner@northwind.example", action: "shortlist.item_add", target: "sl_q4_tech", detail: "Added inf_0017", ip: "203.0.113.24" },
];

export function auditLog(limit = 50): AuditEntry[] {
  return AUDIT.slice(0, limit);
}
