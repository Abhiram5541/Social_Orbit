import { connectorStatuses, type ConnectorState } from "./ops-repository";

/* ---------------------------------------------------------------------------
 * The integrations catalog — everything SocialOrbit connects to, or intends
 * to, in one honestly-graded list.
 *
 * The same rule as the connector grid (ops-repository): status is derived
 * from what is actually configured and implemented, never asserted. A catalog
 * that shows sixteen green ticks sells the product for a week and costs it
 * every client who connects something and gets nothing. The states here are
 * deliberately unflattering:
 *
 *   live                 an adapter exists, credentials are set, data flows
 *   not_implemented      credentials are set but no adapter is written
 *   credentials_missing  an adapter path exists; the environment is empty
 *   not_configured       environment slots exist and are empty, no adapter
 *   planned              on the roadmap; no adapter and no environment slot
 *   deferred             deliberately out of v1 scope (CLAUDE.md D4)
 * ------------------------------------------------------------------------ */

export type IntegrationState = ConnectorState | "planned" | "deferred";

export type IntegrationCategory =
  | "social_platforms"
  | "commerce_attribution"
  | "crm"
  | "communications"
  | "storage";

export interface Integration {
  id: string;
  name: string;
  category: IntegrationCategory;
  state: IntegrationState;
  /** What connecting this actually does for the user, in product terms. */
  purpose: string;
  /** The honest reason for the current state — blockers included. */
  statusDetail: string;
  /** Environment variables involved, where any exist. */
  requires: string[];
  missing: string[];
  /** Deep link for integrations that have a real management surface. */
  manageHref: string | null;
}

const env = (key: string) => Boolean(process.env[key]);

/**
 * Built per request rather than at module load: state depends on the
 * environment and on connector health, both of which belong to the server
 * that answers, not to whichever build produced the bundle.
 */
export function integrationCatalog(): Integration[] {
  const connectors = new Map(connectorStatuses().map((c) => [c.platform, c]));
  const youtube = connectors.get("youtube");
  const instagram = connectors.get("instagram");
  const tiktok = connectors.get("tiktok");

  const storageRequires = [
    "STORAGE_BUCKET",
    "STORAGE_REGION",
    "STORAGE_ACCESS_KEY_ID",
    "STORAGE_SECRET_ACCESS_KEY",
  ];

  return [
    /* --- Social platforms — the data foundation -------------------------- */
    {
      id: "youtube",
      name: "YouTube",
      category: "social_platforms",
      state: youtube?.state ?? "credentials_missing",
      purpose:
        "Channel discovery, statistics, upload history and comment sampling through the Data API; creator verification and first-party analytics over OAuth.",
      statusDetail:
        youtube?.state === "live"
          ? `The primary data source. ${youtube.accountsTracked} channels are tracked against a 10,000-unit daily quota.`
          : "Adapter is written; supply the environment credentials to activate it.",
      requires: youtube?.requires ?? [],
      missing: youtube?.missing ?? [],
      manageHref: "/admin/connectors",
    },
    {
      id: "instagram",
      name: "Instagram",
      category: "social_platforms",
      state: instagram?.state ?? "credentials_missing",
      purpose:
        "Professional-account insights — reach, demographics, story and reel performance — through the Instagram Graph API on creator consent.",
      statusDetail:
        (instagram && instagram.missing.length === 0
          ? "Meta app credentials are set, but no adapter is written yet, and the app still needs "
          : "No adapter is written yet, and beyond credentials the Meta app needs ") +
        "instagram_basic and instagram_manage_insights through Meta App Review. Instagram publishes no discovery endpoint, so creators will be added by handle, not found by sweep.",
      requires: instagram?.requires ?? [],
      missing: instagram?.missing ?? [],
      manageHref: "/admin/connectors",
    },
    {
      id: "meta",
      name: "Meta (Facebook Pages)",
      category: "social_platforms",
      // Not "credentials_missing" when empty: that grade is for an adapter
      // waiting on keys, and no Meta adapter exists. Empty slots with no code
      // behind them are "not_configured" (see TikTok and storage).
      state: env("META_APP_ID") && env("META_APP_SECRET") ? "not_implemented" : "not_configured",
      purpose:
        "Page-level reach and audience data for creators who publish to Facebook, through the same Meta app that serves Instagram.",
      statusDetail:
        "Shares the Instagram app registration and inherits its blockers: no adapter yet, and page permissions must clear Meta App Review before anything can be read.",
      requires: ["META_APP_ID", "META_APP_SECRET"],
      missing: ["META_APP_ID", "META_APP_SECRET"].filter((key) => !env(key)),
      manageHref: "/admin/connectors",
    },
    {
      id: "tiktok",
      name: "TikTok",
      category: "social_platforms",
      state: tiktok?.state ?? "not_configured",
      purpose:
        "Creator profiles and video performance through the TikTok for Developers API, with verification over its OAuth flow.",
      statusDetail:
        "Roadmap connector (DPR §29). Environment slots exist; no adapter is written and no creators are indexed.",
      requires: tiktok?.requires ?? ["TIKTOK_CLIENT_KEY", "TIKTOK_CLIENT_SECRET"],
      missing: tiktok?.missing ?? [],
      manageHref: "/admin/connectors",
    },
    {
      id: "linkedin",
      name: "LinkedIn",
      category: "social_platforms",
      state: "planned",
      purpose:
        "B2B creator intelligence — newsletter and post performance for the professional-audience campaigns the client roster keeps asking about.",
      statusDetail:
        "No adapter and no environment slot yet. LinkedIn's API surface for third-party analytics is narrow, so scope depends on what its Community Management API actually grants.",
      requires: [],
      missing: [],
      manageHref: null,
    },
    {
      id: "x",
      name: "X",
      category: "social_platforms",
      state: "planned",
      purpose: "Post and audience metrics for creators whose reach is conversation-led.",
      statusDetail:
        "No adapter and no environment slot yet. API pricing tiers make per-creator polling expensive, so this waits on a clear client need.",
      requires: [],
      missing: [],
      manageHref: null,
    },
    {
      id: "snapchat",
      name: "Snapchat",
      category: "social_platforms",
      state: "planned",
      purpose: "Public profile and Spotlight performance for creators with a younger-skewing audience.",
      statusDetail: "No adapter and no environment slot yet.",
      requires: [],
      missing: [],
      manageHref: null,
    },

    /* --- Commerce & attribution ------------------------------------------ */
    {
      id: "google_analytics",
      name: "Google Analytics",
      category: "commerce_attribution",
      state: "planned",
      purpose:
        "Tie campaign traffic to on-site behaviour: sessions, conversions and revenue attributed to a creator's tracked links.",
      statusDetail:
        "Planned against the GA4 Data API. Depends on campaign link tracking, which ships with Campaign Intelligence.",
      requires: [],
      missing: [],
      manageHref: null,
    },
    {
      id: "shopify",
      name: "Shopify",
      category: "commerce_attribution",
      state: "planned",
      purpose:
        "Order-level attribution for commerce campaigns — discount-code and link redemptions per creator, so campaign performance can be scored in revenue.",
      statusDetail: "Planned. Waits on the same campaign attribution layer as Google Analytics.",
      requires: [],
      missing: [],
      manageHref: null,
    },

    /* --- CRM -------------------------------------------------------------- */
    {
      id: "hubspot",
      name: "HubSpot",
      category: "crm",
      state: "deferred",
      purpose: "Sync shortlisted creators and campaign outcomes into HubSpot as companies and deals.",
      statusDetail:
        "CRM sync is deliberately out of v1 scope (CLAUDE.md D4) — an engine slot is reserved, nothing more is promised.",
      requires: [],
      missing: [],
      manageHref: null,
    },
    {
      id: "salesforce",
      name: "Salesforce",
      category: "crm",
      state: "deferred",
      purpose: "Push campaign results into Salesforce objects for teams that report there.",
      statusDetail: "Deferred with HubSpot under the same v1 scope decision (CLAUDE.md D4).",
      requires: [],
      missing: [],
      manageHref: null,
    },
    {
      id: "crm_generic",
      name: "Generic CRM (CSV / webhook)",
      category: "crm",
      state: "deferred",
      purpose:
        "A neutral export path — webhook or scheduled CSV — for every CRM this page does not name.",
      statusDetail:
        "Deferred with the rest of CRM sync (CLAUDE.md D4). Likely ships first of the three, since it is an export format rather than a vendor API.",
      requires: [],
      missing: [],
      manageHref: null,
    },

    /* --- Communications --------------------------------------------------- */
    {
      id: "slack",
      name: "Slack",
      category: "communications",
      state: "planned",
      purpose:
        "Anomaly alerts and scheduled report summaries into a channel the team already watches.",
      statusDetail: "Planned as an outbound webhook first; interactive commands only if asked for.",
      requires: [],
      missing: [],
      manageHref: null,
    },
    {
      id: "microsoft_teams",
      name: "Microsoft Teams",
      category: "communications",
      state: "planned",
      purpose: "The same alert and report delivery for organisations that live in Teams.",
      statusDetail: "Planned via incoming webhooks, behind Slack in sequence.",
      requires: [],
      missing: [],
      manageHref: null,
    },
    {
      id: "email",
      name: "Email",
      category: "communications",
      state: "planned",
      purpose:
        "Scheduled report delivery, verification notices and correction-request updates by mail.",
      statusDetail:
        "Planned. No mail provider is configured; today every notification is in-app only.",
      requires: [],
      missing: [],
      manageHref: null,
    },
    {
      id: "whatsapp",
      name: "WhatsApp",
      category: "communications",
      state: "planned",
      purpose: "Campaign alerts over the WhatsApp Business API for teams that coordinate there.",
      statusDetail:
        "Planned last in the communications set: the Business API needs Meta approval and per-message templates, which is heavy machinery for an alert channel.",
      requires: [],
      missing: [],
      manageHref: null,
    },

    /* --- Storage & export -------------------------------------------------- */
    {
      id: "cloud_storage",
      name: "Cloud storage (S3-compatible)",
      category: "storage",
      // every(env) → the environment is complete and only the worker is
      // missing; anything less is unconfigured slots. `some()` here once graded
      // a fully-configured store "credentials_missing" with nothing to list.
      state: storageRequires.every(env) ? "not_implemented" : "not_configured",
      purpose:
        "Scheduled export of reports and raw campaign data to a client-owned S3-compatible bucket.",
      statusDetail:
        "Environment slots exist for any S3-compatible store. The export worker is not written; exports today are on-demand downloads only.",
      requires: storageRequires,
      missing: storageRequires.filter((key) => !env(key)),
      manageHref: null,
    },
  ];
}
