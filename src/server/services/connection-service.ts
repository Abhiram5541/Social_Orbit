import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { sealToken, openToken, tokenCryptoConfigured } from "@/server/auth/token-crypto";
import { ConnectorUnavailable } from "@/server/connectors/youtube";
import {
  authorizationUrl,
  exchangeCode,
  refreshAccessToken,
  youtubeOAuthConfig,
} from "@/server/connectors/youtube/oauth";
import { readRecords, type RawOAuthGrant } from "@/server/data/records";
import { removeGrant, upsertGrant, upsertIngested } from "@/server/data/ingested-store";

/* ---------------------------------------------------------------------------
 * Account connection — the OAuth round trip.
 *
 * What this buys the product is the second source tier: a creator's own
 * analytics, and an identity match. Verified status comes from *this* and never
 * from public data, however authoritative that data looks (Arch §2).
 * ------------------------------------------------------------------------ */

/** Consent must complete in a reasonable window, or the state is stale. */
const STATE_TTL_MS = 15 * 60_000;

export function connectionConfigured(): boolean {
  return youtubeOAuthConfig() !== null && tokenCryptoConfigured();
}

/**
 * A signed, expiring `state` parameter.
 *
 * State exists to stop a third party feeding a victim's browser a callback for
 * an account they control. Signing it with the session secret means a value the
 * server did not issue cannot pass, and the timestamp keeps a leaked one from
 * being useful later.
 */
function stateSecret(): string {
  return process.env.AUTH_SECRET ?? "development-only-session-key-do-not-ship-32";
}

export function issueState(influencerId: string): string {
  const payload = `${influencerId}:${Date.now()}:${randomBytes(8).toString("base64url")}`;
  const signature = createHmac("sha256", stateSecret()).update(payload).digest("base64url");
  return `${Buffer.from(payload).toString("base64url")}.${signature}`;
}

export function verifyState(state: string): { influencerId: string } | null {
  const [encoded, signature] = state.split(".");
  if (!encoded || !signature) return null;

  const payload = Buffer.from(encoded, "base64url").toString("utf8");
  const expected = createHmac("sha256", stateSecret()).update(payload).digest("base64url");

  const given = Buffer.from(signature);
  const want = Buffer.from(expected);
  if (given.length !== want.length || !timingSafeEqual(given, want)) return null;

  const [influencerId, issuedAt] = payload.split(":");
  if (!influencerId || Date.now() - Number(issuedAt) > STATE_TTL_MS) return null;

  return { influencerId };
}

export function startConnection(influencerId: string): string {
  return authorizationUrl(issueState(influencerId));
}

export class ConnectionRefused extends Error {
  constructor(
    readonly code: "state_invalid" | "identity_mismatch" | "no_channel",
    message: string,
  ) {
    super(message);
    this.name = "ConnectionRefused";
  }
}

export interface ConnectionResult {
  influencerId: string;
  channelTitle: string;
  identityMatched: boolean;
}

/**
 * Completes the round trip: code for tokens, then confirms *which* channel
 * consented.
 *
 * The identity check is the point of the whole exercise. A creator signing in
 * with a Google account that owns a different channel has proved they control
 * that other channel, not this record — so the grant is refused rather than
 * quietly attached to whichever profile the flow started from. Verified status
 * that could be obtained by consenting from any account would be worthless.
 */
export async function completeConnection(
  code: string,
  state: string,
): Promise<ConnectionResult> {
  const verified = verifyState(state);
  if (!verified) {
    throw new ConnectionRefused(
      "state_invalid",
      "This connection link is invalid or has expired. Start the connection again.",
    );
  }

  const tokens = await exchangeCode(code);

  // Which channel does the consenting account actually own?
  const owned = await fetchOwnChannel(tokens.accessToken);
  if (!owned) {
    throw new ConnectionRefused(
      "no_channel",
      "That Google account does not own a YouTube channel.",
    );
  }

  const data = readRecords();
  const account = data.accounts.find(
    (item) => item.influencerId === verified.influencerId && item.isPrimary,
  );
  if (!account) {
    throw new ConnectionRefused("no_channel", "No tracked account for this creator.");
  }

  if (account.platformAccountId !== owned.channelId) {
    throw new ConnectionRefused(
      "identity_mismatch",
      `That account owns "${owned.title}", which is not the channel on this profile. ` +
        `Sign in with the Google account that owns it.`,
    );
  }

  const grant: RawOAuthGrant = {
    accountId: account.id,
    influencerId: verified.influencerId,
    platform: "youtube",
    platformAccountId: owned.channelId,
    sealedAccessToken: sealToken(tokens.accessToken),
    sealedRefreshToken: tokens.refreshToken ? sealToken(tokens.refreshToken) : null,
    expiresAt: tokens.expiresAt,
    scopes: tokens.scopes,
    grantedAt: new Date().toISOString(),
    needsReauth: false,
  };
  upsertGrant(grant);
  markConnected(verified.influencerId, account.id, true);

  return {
    influencerId: verified.influencerId,
    channelTitle: owned.title,
    // Identity matched by construction: the grant is refused above otherwise.
    identityMatched: true,
  };
}

/** Reads the channel the token's owner controls, via `mine=true`. */
async function fetchOwnChannel(
  accessToken: string,
): Promise<{ channelId: string; title: string } | null> {
  const response = await fetch(
    "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
    { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" },
  );

  if (!response.ok) {
    throw new ConnectorUnavailable(
      "youtube",
      response.status === 401 || response.status === 403 ? "forbidden" : "upstream_error",
      `Could not read the connected channel (HTTP ${response.status}).`,
    );
  }

  const body = (await response.json()) as {
    items?: { id: string; snippet: { title: string } }[];
  };
  const item = body.items?.[0];
  return item ? { channelId: item.id, title: item.snippet.title } : null;
}

/** Flips the stored account and creator onto the connected/verified path. */
function markConnected(influencerId: string, accountId: string, connected: boolean): void {
  const data = readRecords();
  const influencer = data.influencers.find((item) => item.id === influencerId);
  const accounts = data.accounts.filter((item) => item.influencerId === influencerId);
  const content = data.content.filter((item) => item.influencerId === influencerId);
  const snapshot = data.snapshots.find((item) => item.accountId === accountId);
  if (!influencer || accounts.length === 0 || !snapshot) return;

  upsertIngested([
    {
      influencer: { ...influencer, isConnected: connected, identityMatched: connected },
      accounts: accounts.map((item) =>
        item.id === accountId
          ? {
              ...item,
              isConnected: connected,
              connectedAt: connected ? new Date().toISOString() : null,
              needsReauth: false,
            }
          : item,
      ),
      snapshot,
      content,
    },
  ]);
}

export function disconnect(influencerId: string, accountId: string): void {
  removeGrant(accountId);
  markConnected(influencerId, accountId, false);
}

/**
 * A usable access token for an account, refreshing it if it has expired.
 *
 * Returns null when there is no grant or the creator revoked access — both are
 * ordinary states, and the caller falls back to what public data can answer
 * rather than failing the request.
 */
export async function accessTokenFor(accountId: string): Promise<string | null> {
  const grant = readRecords().grants.get(accountId);
  if (!grant || grant.needsReauth) return null;

  // A minute of headroom: a token that expires mid-request is a confusing 401.
  if (new Date(grant.expiresAt).getTime() - 60_000 > Date.now()) {
    return openToken(grant.sealedAccessToken);
  }

  if (!grant.sealedRefreshToken) {
    upsertGrant({ ...grant, needsReauth: true });
    return null;
  }

  try {
    const renewed = await refreshAccessToken(openToken(grant.sealedRefreshToken));
    upsertGrant({
      ...grant,
      sealedAccessToken: sealToken(renewed.accessToken),
      expiresAt: renewed.expiresAt,
      needsReauth: false,
    });
    return renewed.accessToken;
  } catch {
    // Revocation is the usual cause. Record it so the creator is asked to
    // reconnect rather than the platform retrying a dead credential forever.
    upsertGrant({ ...grant, needsReauth: true });
    return null;
  }
}
