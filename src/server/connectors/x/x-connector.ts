import { z } from "zod";
import type { Provenance } from "@/lib/contracts/common";

/**
 * X (Twitter) API v2 connector.
 *
 * This is a tier-1 source (DPR §7.1 `platform_api`): every figure it returns is
 * observed, never estimated. It reads *public* account and post statistics
 * with an app-only bearer token. It deliberately computes no engagement rate,
 * median, consistency or any other derived value — that is `src/server/analytics`'
 * job, and doing it here would hide an undeclared formula inside a data source.
 *
 * Authorized creator analytics (private metrics, audience demographics) would
 * require the OAuth2 user-context flow in `./oauth.ts`. That is a different
 * source tier (`oauth_authorized`) and is not reachable with an app-only token.
 *
 * X's metering model does not fit YouTube's per-unit daily-budget shape (D15):
 * X enforces a rate-limit ceiling per endpoint per 15-minute window, not a
 * shared daily unit budget. `RATE_LIMIT` below documents those ceilings for the
 * tier this app was verified against; it is informational only — nothing here
 * spends against a shared budget the way YouTube's `search.list` does, because
 * there is no shared budget to spend against. See CLAUDE.md D18 (proposed).
 */

const API = "https://api.twitter.com/2";

/** Requests per 15-minute window, per endpoint, on the "Basic" app tier this
 *  project was verified against (`x-rate-limit-limit: 300` on user lookup).
 *  Documentation only — X enforces these itself via response headers and 429s;
 *  this connector does not pre-count against them the way YOUTUBE_API_KEY's
 *  daily budget is counted, because the ceiling resets every 15 minutes rather
 *  than accumulating against one shared figure. */
export const RATE_LIMIT = {
  userByUsername: 300,
  usersBatch: 300,
  userTweets: 1500,
  tweetsSearchRecent: 60,
} as const;

const USER_FIELDS = "public_metrics,verified,description,created_at,profile_image_url";
const TWEET_FIELDS = "public_metrics,created_at,lang";

export class ConnectorUnavailable extends Error {
  constructor(
    readonly platform: "x",
    readonly reason:
      | "credentials_missing"
      | "quota_exceeded"
      | "forbidden"
      | "upstream_error"
      // X-specific: the app-only bearer token is valid and the request is
      // well-formed, but the account has no active billing/credits (HTTP 402).
      // This is not a quota reset the caller can wait out — distinct from
      // `quota_exceeded`, which on X's rate-limit model would be a 429 that
      // clears on its own in under 15 minutes.
      | "billing_required",
    message: string,
  ) {
    super(message);
    this.name = "ConnectorUnavailable";
  }
}

/** Null rather than throwing, so health reporting needs no try/catch. */
export function xApiKey(): string | null {
  return process.env.X_API_KEY?.trim() || null;
}

export function xApiSecret(): string | null {
  return process.env.X_API_SECRET?.trim() || null;
}

function requireCredentials(): { key: string; secret: string } {
  const key = xApiKey();
  const secret = xApiSecret();
  if (!key || !secret) {
    throw new ConnectorUnavailable(
      "x",
      "credentials_missing",
      "X_API_KEY and X_API_SECRET are not both set. The X connector cannot read live data.",
    );
  }
  return { key, secret };
}

/* --- App-only bearer token ------------------------------------------------
 *
 * X's app-only auth is OAuth 1.0a consumer credentials traded once for an
 * OAuth2 bearer token (RFC 6749 client_credentials grant, X's specific
 * flavour): POST /oauth2/token with HTTP Basic auth of the urlencoded
 * key:secret pair. The bearer token this returns has no expiry X documents,
 * so it is cached in memory for the life of the process rather than
 * re-minted on every call.
 * ------------------------------------------------------------------------ */

const BearerTokenResponse = z.object({
  token_type: z.string(),
  access_token: z.string(),
});

let cachedBearerToken: string | null = null;

async function mintBearerToken(): Promise<string> {
  const { key, secret } = requireCredentials();
  const basic = Buffer.from(
    `${encodeURIComponent(key)}:${encodeURIComponent(secret)}`,
  ).toString("base64");

  let response: Response;
  try {
    response = await fetch("https://api.twitter.com/oauth2/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      },
      body: "grant_type=client_credentials",
      cache: "no-store",
    });
  } catch (cause) {
    throw new ConnectorUnavailable("x", "upstream_error", `X token endpoint unreachable: ${String(cause)}`);
  }

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ConnectorUnavailable(
      "x",
      response.status === 401 || response.status === 403 ? "credentials_missing" : "upstream_error",
      `X refused to mint a bearer token (HTTP ${response.status}).`,
    );
  }

  const parsed = BearerTokenResponse.safeParse(body);
  if (!parsed.success || parsed.data.token_type !== "bearer") {
    throw new ConnectorUnavailable("x", "upstream_error", "X returned an unexpected token response.");
  }
  return parsed.data.access_token;
}

async function bearerToken(): Promise<string> {
  cachedBearerToken ??= await mintBearerToken();
  return cachedBearerToken;
}

/** Test seam only: the in-memory bearer token cache spans the process, which
 *  would otherwise leak a token minted under one test's mocked credentials
 *  into the next test. */
export function resetBearerTokenCache(): void {
  cachedBearerToken = null;
}

/* --- Response schemas ----------------------------------------------------
 *
 * X returns `public_metrics` as numbers, not strings — unlike YouTube's
 * counters, which arrive as strings with a key omitted when the value is
 * hidden. X has no "hidden follower count" concept for a public profile: the
 * field is present with a real number whenever the lookup succeeds at all, so
 * there is no `followersHidden`-equivalent here. Absence is only possible at
 * the object level (a suspended or not-found account), never at the field
 * level within a returned user.
 * ---------------------------------------------------------------------- */

const PublicMetrics = z.object({
  followers_count: z.number(),
  following_count: z.number(),
  tweet_count: z.number(),
  listed_count: z.number(),
});

const UserObject = z.object({
  id: z.string(),
  username: z.string(),
  name: z.string(),
  description: z.string().default(""),
  created_at: z.string().optional(),
  profile_image_url: z.string().optional(),
  // X's legacy/paid blue-check flag. Deliberately named `xVerifiedBadge` (not
  // `verified`) everywhere past this schema so it can never be confused with
  // SocialOrbit Verified, which is issued only after OAuth identity match
  // (Arch §2). This is a much weaker claim — a paid subscription badge, not a
  // confirmed identity — and CRITICAL RULE 2 forbids writing it to
  // `isConnected` or `identityMatched` anywhere downstream.
  verified: z.boolean().optional(),
  public_metrics: PublicMetrics,
});

const UserLookup = z.object({ data: UserObject.optional() });
const UsersBatch = z.object({ data: z.array(UserObject).default([]) });

const TweetPublicMetrics = z.object({
  like_count: z.number(),
  retweet_count: z.number(),
  reply_count: z.number(),
  quote_count: z.number(),
  // Only present with elevated access; a normal app-only token does not
  // receive it. Absent is the ordinary case, not a malformed response.
  impression_count: z.number().optional(),
});

const TweetObject = z.object({
  id: z.string(),
  text: z.string().default(""),
  created_at: z.string().optional(),
  lang: z.string().optional(),
  public_metrics: TweetPublicMetrics,
});

const TweetPage = z.object({
  // Deliberately lenient, same reasoning as YouTube's `VideoList`: one oddly
  // shaped tweet must not fail the whole page and stop a channel sweep.
  data: z.array(z.unknown()).default([]),
  meta: z.object({ next_token: z.string().optional() }).optional(),
});

const SearchPage = z.object({
  data: z.array(z.object({ author_id: z.string().optional() })).default([]),
});

/** X's error envelope. Both the v2 `{errors:[...]}` shape and the v1.1-style
 *  `{detail,status,title}` shape (the 402 credits-depleted body) appear in
 *  practice, so both are accepted. */
const XError = z.object({
  title: z.string().optional(),
  detail: z.string().optional(),
  status: z.number().optional(),
  errors: z.array(z.object({ message: z.string().optional() })).optional(),
});

/* --- Transport ----------------------------------------------------------- */

async function call<T extends z.ZodTypeAny>(
  path: string,
  params: Record<string, string>,
  schema: T,
): Promise<z.infer<T>> {
  const url = new URL(`${API}${path}`);
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);

  const token = await bearerToken();
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
  } catch (cause) {
    throw new ConnectorUnavailable("x", "upstream_error", `X API unreachable: ${String(cause)}`);
  }

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const parsed = XError.safeParse(body);
    const detail = parsed.success
      ? (parsed.data.detail ?? parsed.data.title ?? parsed.data.errors?.[0]?.message ?? `HTTP ${response.status}`)
      : `HTTP ${response.status}`;

    // Verified live: a well-formed, correctly authenticated request with no
    // active billing returns 402 with body {"detail":"credits depleted",...}.
    // This is not a rate limit and will not clear itself — it is its own
    // reason so an operator sees "billing" rather than "try again later".
    if (response.status === 402) {
      throw new ConnectorUnavailable("x", "billing_required", `X account has no active credits: ${detail}`);
    }
    if (response.status === 429) {
      throw new ConnectorUnavailable("x", "quota_exceeded", `X rate limit exceeded: ${detail}`);
    }
    if (response.status === 401) {
      throw new ConnectorUnavailable("x", "credentials_missing", `X rejected the credentials: ${detail}`);
    }
    if (response.status === 403) {
      throw new ConnectorUnavailable("x", "forbidden", `X forbade the request: ${detail}`);
    }
    throw new ConnectorUnavailable("x", "upstream_error", `X API error: ${detail}`);
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ConnectorUnavailable(
      "x",
      "upstream_error",
      `X returned an unexpected shape for ${path}: ${parsed.error.issues[0]?.message}`,
    );
  }
  return parsed.data;
}

/* --- Identifier resolution ----------------------------------------------- */

export type AccountRef = { kind: "id" | "username"; value: string };

/**
 * Accepts a numeric user id, an @handle, a bare handle, or any x.com/twitter.com
 * profile URL containing one. Unlike YouTube's channel id, X's numeric user id
 * has no fixed-length pattern to detect on sight, so a bare numeric string is
 * still treated as ambiguous and resolved as a username unless it came from a
 * URL path that is unambiguously an id-taking endpoint. In practice X profile
 * URLs always carry the @handle, not the numeric id, so this mirrors what a
 * human actually pastes.
 */
export function parseAccountInput(input: string): AccountRef {
  const trimmed = input.trim();
  const fromUrl = trimmed.match(/(?:x\.com|twitter\.com)\/(@?[\w]{1,15})/i);
  if (fromUrl) return { kind: "username", value: fromUrl[1].replace(/^@/, "") };
  return { kind: "username", value: trimmed.replace(/^@/, "") };
}

/* --- Account --------------------------------------------------------------- */

export interface XAccount {
  userId: string;
  username: string;
  name: string;
  description: string;
  avatarUrl: string | null;
  createdAt: string | null;
  followers: number;
  following: number;
  postCount: number;
  listedCount: number;
  /** X's own paid/legacy blue-check badge. NOT SocialOrbit Verified — see the
   *  comment on `UserObject.verified` above. Never write this to
   *  `isConnected` or `identityMatched`. */
  xVerifiedBadge: boolean;
  url: string;
}

function toAccount(user: z.infer<typeof UserObject>): XAccount {
  return {
    userId: user.id,
    username: user.username,
    name: user.name,
    description: user.description,
    avatarUrl: user.profile_image_url ?? null,
    createdAt: user.created_at ? new Date(user.created_at).toISOString() : null,
    followers: user.public_metrics.followers_count,
    following: user.public_metrics.following_count,
    postCount: user.public_metrics.tweet_count,
    listedCount: user.public_metrics.listed_count,
    xVerifiedBadge: user.verified ?? false,
    url: `https://x.com/${user.username}`,
  };
}

/** One `users/by/username` call, by @handle or numeric id via `/users/:id`. */
export async function fetchAccount(input: string): Promise<XAccount | null> {
  const { kind, value } = parseAccountInput(input);
  const path = kind === "id" ? `/users/${value}` : `/users/by/username/${value}`;
  const { data } = await call(path, { "user.fields": USER_FIELDS }, UserLookup);
  return data ? toAccount(data) : null;
}

/**
 * Up to 100 accounts for a single call — X's equivalent of YouTube's 50-per-
 * call `channels.list` batching. Only usernames batch this way; there is no
 * batched-by-id lookup used here since discovery yields ids, not handles, and
 * `/2/users` accepts either `ids` or `usernames` but not both at once, so this
 * function takes usernames to match how `fetchAccount` resolves input.
 */
export async function fetchAccounts(usernames: string[]): Promise<XAccount[]> {
  const accounts: XAccount[] = [];
  for (let i = 0; i < usernames.length; i += 100) {
    const { data } = await call(
      "/users",
      { usernames: usernames.slice(i, i + 100).join(","), "user.fields": USER_FIELDS },
      UsersBatch,
    );
    accounts.push(...data.map(toAccount));
  }
  return accounts;
}

/* --- Discovery -------------------------------------------------------------
 *
 * X's discovery-equivalent of YouTube's `search.list`. Cheaper relative to its
 * own rate-limit ceiling (60 requests/15min vs YouTube's 100-unit-per-call
 * cost model), but still the one endpoint worth calling sparingly here — same
 * strategy as YouTube: discover author ids cheaply via search, then hydrate
 * every account through the cheap batched lookup rather than repeating search.
 * ------------------------------------------------------------------------ */

export async function discoverAuthorIds(
  query: string,
  options: { limit?: number } = {},
): Promise<string[]> {
  const { data } = await call(
    "/tweets/search/recent",
    {
      query,
      max_results: String(Math.min(100, Math.max(10, options.limit ?? 50))),
    },
    SearchPage,
  );

  return [
    ...new Set(data.map((tweet) => tweet.author_id).filter((id): id is string => typeof id === "string")),
  ];
}

/* --- Content ---------------------------------------------------------------
 *
 * Recent posts with their public statistics — the content-fetching equivalent
 * of `fetchRecentVideos`. X paginates via `meta.next_token` rather than
 * YouTube's `nextPageToken`, but the shape of "keep paging until enough" is
 * the same.
 * ------------------------------------------------------------------------ */

export interface XPost {
  postId: string;
  text: string;
  url: string;
  publishedAt: string | null;
  likes: number;
  retweets: number;
  replies: number;
  quotes: number;
  /** Only present with elevated API access; a standard app-only token never
   *  receives it. Absent, not zero. */
  impressions: number | null;
  language: string | null;
}

export async function fetchRecentPosts(userId: string, limit = 25): Promise<XPost[]> {
  const posts: XPost[] = [];
  let pageToken: string | undefined;

  while (posts.length < limit) {
    const page = await call(
      `/users/${userId}/tweets`,
      {
        max_results: String(Math.min(100, Math.max(5, limit - posts.length))),
        "tweet.fields": TWEET_FIELDS,
        ...(pageToken ? { pagination_token: pageToken } : {}),
      },
      TweetPage,
    );

    for (const item of page.data) {
      const parsed = TweetObject.safeParse(item);
      if (parsed.success) posts.push(toPost(parsed.data));
    }

    pageToken = page.meta?.next_token;
    if (!pageToken) break;
  }

  return posts;
}

function toPost(tweet: z.infer<typeof TweetObject>): XPost {
  return {
    postId: tweet.id,
    text: tweet.text,
    url: `https://x.com/i/web/status/${tweet.id}`,
    publishedAt: tweet.created_at ? new Date(tweet.created_at).toISOString() : null,
    likes: tweet.public_metrics.like_count,
    retweets: tweet.public_metrics.retweet_count,
    replies: tweet.public_metrics.reply_count,
    quotes: tweet.public_metrics.quote_count,
    impressions: tweet.public_metrics.impression_count ?? null,
    language: tweet.lang ?? null,
  };
}

/* --- Comment quality — deliberately unimplemented --------------------------
 *
 * YouTube has `fetchTopComments`: top-level video comments, readable with an
 * API key and no OAuth, which the AI layer judges for quality (D16). X has no
 * equivalent reachable at this access tier — replies to a tweet require
 * either paid elevated access or walking `/tweets/search/recent` with an
 * `in_reply_to_tweet_id` filter per post, which is a materially different
 * (and rate-limit-expensive) shape, not a drop-in substitute. Building a
 * lookalike here would either silently degrade to nothing or invent an
 * approximation — both against D13. Comment quality stays unmeasurable for
 * X-sourced creators, the same honest-absence posture YouTube uses for
 * audience demographics.
 * ------------------------------------------------------------------------ */

/* --- Observation --------------------------------------------------------- */

export interface XObservation {
  account: XAccount;
  recentContent: XPost[];
  provenance: Provenance;
  /** Not a real "unit" cost the way YouTube's is — see the module comment.
   *  Recorded as a call count so probes and ingestion reports still have a
   *  number to show, but it does not draw down a shared daily budget. */
  quotaUnitsSpent: number;
}

/**
 * One collection pass: identity, account statistics and recent posts, stamped
 * with the provenance every SocialOrbit fact must carry (DPR §16.1).
 *
 * Confidence is 90, not 100: these are authoritative platform figures, but
 * read without OAuth, so nothing here is `verified` — only `observed`.
 */
export async function observeAccount(input: string, postLimit = 25): Promise<XObservation | null> {
  const account = await fetchAccount(input);
  if (!account) return null;

  const recentContent = await fetchRecentPosts(account.userId, postLimit);
  const pages = Math.max(1, Math.ceil(recentContent.length / 100));

  return {
    account,
    recentContent,
    provenance: {
      tier: "platform_api",
      kind: "observed",
      collectedAt: new Date().toISOString(),
      verifiedAt: null,
      sourceUrl: account.url,
      confidence: 90,
      ai: null,
    },
    quotaUnitsSpent: 1 + pages,
  };
}
