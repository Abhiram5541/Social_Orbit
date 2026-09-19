import { z } from "zod";
import type { Provenance } from "@/lib/contracts/common";

/* ---------------------------------------------------------------------------
 * Instagram Graph API connector — Business Discovery.
 *
 * Instagram exposes no public read of an arbitrary account. What it does
 * expose is Business Discovery: an Instagram *professional* account that SENSO
 * owns may ask, by username, for the public profile figures and recent media
 * of any other professional (Business or Creator) account. Personal accounts
 * return nothing, and there is no search — creators are added by handle.
 *
 * Every call is made as SENSO's own account, so two things are configured
 * beyond the app keys: `META_IG_USER_ID` (the Instagram professional account's
 * id) and `META_IG_TOKEN` — either a long-lived Instagram Login token (60
 * days, refreshed by `scripts/meta-token.mjs --refresh`) or a Page token from
 * Facebook Login. The reads are Standard Access — they need no App Review,
 * because the only "user" whose token is involved is ours.
 *
 * Rate limit is per token: 200 calls an hour. Each observation is one call,
 * so the budget is ~4,800 creators a day — the ceiling this connector runs at
 * until a second professional account is added.
 * ------------------------------------------------------------------------ */

/**
 * Two hosts serve the same Business Discovery call. A token minted through
 * "Instagram API with Instagram Login" (prefix `IGAA`) is only valid on
 * graph.instagram.com; a Facebook user/Page token (`EAA`) on graph.facebook.com.
 * Read from the token, so switching login products is a token swap, not a deploy.
 */
function graphHost(token: string): string {
  return token.startsWith("IG") ? "https://graph.instagram.com" : "https://graph.facebook.com";
}

export class ConnectorUnavailable extends Error {
  constructor(
    readonly platform: "instagram",
    readonly reason: "credentials_missing" | "quota_exceeded" | "forbidden" | "not_found" | "upstream_error",
    message: string,
  ) {
    super(message);
    this.name = "ConnectorUnavailable";
  }
}

export function instagramToken(): string | null {
  return process.env.META_IG_TOKEN?.trim() || null;
}

export function instagramUserId(): string | null {
  return process.env.META_IG_USER_ID?.trim() || null;
}

/* --- Credential pool -------------------------------------------------------
 *
 * The 200-an-hour limit is per Instagram account, not per app. Every Page the
 * token holder manages that has an Instagram professional account linked is
 * another 200, and the same Business Discovery read works as any of them. So
 * `META_IG_POOL` may carry further `userId:token` pairs (comma separated,
 * from scripts/meta-token.mjs); reads round-robin across the pool and a
 * credential that hits its limit is benched for the rest of the hour.
 * ------------------------------------------------------------------------ */

interface Credential {
  userId: string;
  token: string;
  /** Epoch ms until which this credential is rate-limited. */
  benchedUntil: number;
}

let pool: Credential[] | null = null;
let cursor = 0;

function credentials(): Credential[] {
  if (pool) return pool;
  const primary = instagramToken() && instagramUserId() ? [{ userId: instagramUserId()!, token: instagramToken()!, benchedUntil: 0 }] : [];
  const extra = (process.env.META_IG_POOL ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const at = entry.indexOf(":");
      return { userId: entry.slice(0, at), token: entry.slice(at + 1), benchedUntil: 0 };
    })
    .filter((c) => c.userId && c.token && c.userId !== primary[0]?.userId);
  pool = [...primary, ...extra];
  return pool;
}

/** The next credential that is not benched; the soonest-to-return one if all are. */
function requireCredentials(): Credential {
  const all = credentials();
  if (all.length === 0) {
    throw new ConnectorUnavailable(
      "instagram",
      "credentials_missing",
      "META_IG_TOKEN and META_IG_USER_ID are not both set, so Instagram cannot be read.",
    );
  }
  const now = Date.now();
  for (let i = 0; i < all.length; i += 1) {
    const candidate = all[(cursor + i) % all.length];
    if (candidate.benchedUntil <= now) {
      cursor = (cursor + i + 1) % all.length;
      return candidate;
    }
  }
  return all.reduce((a, b) => (a.benchedUntil <= b.benchedUntil ? a : b));
}

/** How many credentials can still be read from this hour. */
export function instagramCapacity(): { total: number; available: number } {
  const all = credentials();
  const now = Date.now();
  return { total: all.length, available: all.filter((c) => c.benchedUntil <= now).length };
}

/** Test seam. */
export function __resetInstagramPool(): void {
  pool = null;
  cursor = 0;
}

/* --- Wire shapes ---------------------------------------------------------- */

const Media = z.object({
  id: z.string(),
  caption: z.string().optional(),
  media_type: z.string().optional(),
  media_product_type: z.string().optional(),
  permalink: z.string().optional(),
  timestamp: z.string().optional(),
  like_count: z.number().optional(),
  comments_count: z.number().optional(),
  thumbnail_url: z.string().optional(),
  media_url: z.string().optional(),
});

const Discovered = z.object({
  id: z.string(),
  username: z.string(),
  name: z.string().optional(),
  biography: z.string().optional(),
  website: z.string().optional(),
  profile_picture_url: z.string().optional(),
  followers_count: z.number().optional(),
  follows_count: z.number().optional(),
  media_count: z.number().optional(),
  media: z.object({ data: z.array(Media).default([]) }).optional(),
});

const DiscoveryResponse = z.object({ business_discovery: Discovered });

const GraphError = z.object({
  error: z.object({
    message: z.string().optional(),
    type: z.string().optional(),
    code: z.number().optional(),
    error_subcode: z.number().optional(),
  }),
});

/* --- Transport ----------------------------------------------------------- */

async function call<T extends z.ZodTypeAny>(
  path: string,
  params: Record<string, string>,
  schema: T,
  credential: Credential = requireCredentials(),
): Promise<z.infer<T>> {
  const { token } = credential;
  const version = process.env.META_GRAPH_VERSION?.trim() || "v21.0";
  const url = new URL(`${graphHost(token)}/${version}/${path}`);
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
  url.searchParams.set("access_token", token);

  let response: Response;
  try {
    response = await fetch(url, { cache: "no-store" });
  } catch (cause) {
    throw new ConnectorUnavailable("instagram", "upstream_error", `Instagram Graph API unreachable: ${String(cause)}`);
  }
  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const parsed = GraphError.safeParse(body);
    const error = parsed.success ? parsed.data.error : {};
    const detail = error.message ?? `HTTP ${response.status}`;
    // Codes from the Graph API error reference. 110 / subcode 2207013 is
    // "no such professional account"; 190 is a dead or wrong token; 4, 17
    // and 32 are the rate limits; 10 and 200-299 are permissions.
    if (error.code === 110 || error.error_subcode === 2207013 || error.code === 100) {
      throw new ConnectorUnavailable("instagram", "not_found", detail);
    }
    if (error.code === 190) {
      throw new ConnectorUnavailable("instagram", "credentials_missing", `Instagram rejected the token: ${detail}`);
    }
    if (error.code === 4 || error.code === 17 || error.code === 32 || error.code === 613) {
      // Bench this credential for the rest of the rolling hour; another may still read.
      credential.benchedUntil = Date.now() + 60 * 60_000;
      throw new ConnectorUnavailable("instagram", "quota_exceeded", `Instagram rate limit reached: ${detail}`);
    }
    if (error.code === 10 || (error.code !== undefined && error.code >= 200 && error.code < 300)) {
      throw new ConnectorUnavailable("instagram", "forbidden", `Instagram forbade the request: ${detail}`);
    }
    throw new ConnectorUnavailable("instagram", "upstream_error", `Instagram Graph API error: ${detail}`);
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ConnectorUnavailable(
      "instagram",
      "upstream_error",
      `Instagram returned an unexpected shape for ${path}: ${parsed.error.issues[0]?.message}`,
    );
  }
  return parsed.data;
}

/* --- Identifier resolution ----------------------------------------------- */

/** Accepts `@name`, `name`, or an instagram.com URL. Business Discovery only takes usernames. */
export function parseAccountInput(input: string): string {
  const trimmed = input.trim();
  const fromUrl = trimmed.match(/instagram\.com\/([A-Za-z0-9._]+)/i);
  const raw = fromUrl ? fromUrl[1] : trimmed.replace(/^@/, "");
  return raw.toLowerCase();
}

/* --- Account ------------------------------------------------------------- */

export interface InstagramAccount {
  userId: string;
  username: string;
  name: string;
  biography: string;
  website: string | null;
  avatarUrl: string | null;
  followers: number | null;
  following: number | null;
  mediaCount: number | null;
  url: string;
}

export interface InstagramPost {
  postId: string;
  caption: string;
  /** IMAGE, VIDEO or CAROUSEL_ALBUM; product type FEED or REELS. */
  mediaType: string | null;
  productType: string | null;
  url: string;
  thumbnailUrl: string | null;
  publishedAt: string | null;
  likes: number | null;
  comments: number | null;
}

const MEDIA_FIELDS = "id,caption,media_type,media_product_type,permalink,timestamp,like_count,comments_count,thumbnail_url,media_url";

/**
 * One Business Discovery call: the profile and its most recent media.
 * Null when the username is not a professional account (or does not exist);
 * Instagram does not distinguish the two.
 */
export async function fetchAccount(input: string, mediaLimit = 50): Promise<{ account: InstagramAccount; posts: InstagramPost[] } | null> {
  const username = parseAccountInput(input);
  const fields =
    `business_discovery.username(${username}){id,username,name,biography,website,profile_picture_url,` +
    `followers_count,follows_count,media_count,media.limit(${Math.min(100, Math.max(1, mediaLimit))}){${MEDIA_FIELDS}}}`;

  let data: z.infer<typeof DiscoveryResponse> | null = null;
  // A credential that hits its limit mid-read is benched by `call`; retry once
  // per remaining credential so one exhausted account does not fail the read.
  for (let attempt = 0; attempt < Math.max(1, credentials().length) && data === null; attempt += 1) {
    const credential = requireCredentials();
    try {
      data = await call(credential.userId, { fields }, DiscoveryResponse, credential);
    } catch (error) {
      if (error instanceof ConnectorUnavailable && error.reason === "not_found") return null;
      if (error instanceof ConnectorUnavailable && error.reason === "quota_exceeded" && instagramCapacity().available > 0) continue;
      throw error;
    }
  }
  if (!data) throw new ConnectorUnavailable("instagram", "quota_exceeded", "Every Instagram credential has reached its hourly limit.");

  const d = data.business_discovery;
  return {
    account: {
      userId: d.id,
      username: d.username,
      name: d.name?.trim() || d.username,
      biography: d.biography ?? "",
      website: d.website ?? null,
      avatarUrl: d.profile_picture_url ?? null,
      followers: d.followers_count ?? null,
      following: d.follows_count ?? null,
      mediaCount: d.media_count ?? null,
      url: `https://www.instagram.com/${d.username}/`,
    },
    posts: (d.media?.data ?? []).map((m) => ({
      postId: m.id,
      caption: m.caption ?? "",
      mediaType: m.media_type ?? null,
      productType: m.media_product_type ?? null,
      url: m.permalink ?? `https://www.instagram.com/p/${m.id}/`,
      thumbnailUrl: m.thumbnail_url ?? m.media_url ?? null,
      publishedAt: m.timestamp ?? null,
      // Absent when the creator hides like counts — absent, not zero.
      likes: m.like_count ?? null,
      comments: m.comments_count ?? null,
    })),
  };
}

export interface InstagramObservation {
  account: InstagramAccount;
  recentContent: InstagramPost[];
  provenance: Provenance;
  /** Calls made — the unit the 200/hour rate limit is counted in. */
  quotaUnitsSpent: number;
}

/**
 * One collection pass, stamped with the provenance every SENSO fact carries
 * (DPR §16.1). Confidence 90: platform figures, read without the creator's
 * OAuth, so `observed` and never `verified`.
 */
export async function observeAccount(input: string, mediaLimit = 50): Promise<InstagramObservation | null> {
  const found = await fetchAccount(input, mediaLimit);
  if (!found) return null;
  return {
    account: found.account,
    recentContent: found.posts,
    provenance: {
      tier: "platform_api",
      kind: "observed",
      collectedAt: new Date().toISOString(),
      verifiedAt: null,
      sourceUrl: found.account.url,
      confidence: 90,
      ai: null,
    },
    quotaUnitsSpent: 1,
  };
}
