import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { sealToken, openToken, tokenCryptoConfigured } from "@/server/auth/token-crypto";
import { ConnectorUnavailable } from "@/server/connectors/x";
import {
  authorizationUrl,
  exchangeCode,
  generatePkce,
  refreshAccessToken,
  xOAuthConfig,
} from "@/server/connectors/x/oauth";
import { readRecords, type RawOAuthGrant } from "@/server/data/records";
import { removeGrant, upsertGrant, upsertIngested } from "@/server/data/ingested-store";

/* ---------------------------------------------------------------------------
 * X account connection — the OAuth2 (PKCE) round trip.
 *
 * Sibling to `connection-service.ts` rather than a generalisation of it: X's
 * flow carries a PKCE `code_verifier` that YouTube's does not, which has to
 * survive the redirect to X's consent screen and back. There is no
 * server-side session store for that in this codebase (CLAUDE.md D2's
 * `globalThis` store is for the influencer database, not a per-request
 * secret), so it travels inside the same HMAC-signed `state` value that
 * already protects the influencer id — the signature already prevents
 * tampering with anything the payload carries, so adding a second field
 * costs nothing new to trust.
 * ------------------------------------------------------------------------ */

const STATE_TTL_MS = 15 * 60_000;

export function xConnectionConfigured(): boolean {
  return xOAuthConfig() !== null && tokenCryptoConfigured();
}

function stateSecret(): string {
  return process.env.AUTH_SECRET ?? "development-only-session-key-do-not-ship-32";
}

function issueState(influencerId: string, codeVerifier: string): string {
  const payload = `${influencerId}:${codeVerifier}:${Date.now()}:${randomBytes(8).toString("base64url")}`;
  const signature = createHmac("sha256", stateSecret()).update(payload).digest("base64url");
  return `${Buffer.from(payload).toString("base64url")}.${signature}`;
}

function verifyState(state: string): { influencerId: string; codeVerifier: string } | null {
  const [encoded, signature] = state.split(".");
  if (!encoded || !signature) return null;

  const payload = Buffer.from(encoded, "base64url").toString("utf8");
  const expected = createHmac("sha256", stateSecret()).update(payload).digest("base64url");

  const given = Buffer.from(signature);
  const want = Buffer.from(expected);
  if (given.length !== want.length || !timingSafeEqual(given, want)) return null;

  const [influencerId, codeVerifier, issuedAt] = payload.split(":");
  if (!influencerId || !codeVerifier || Date.now() - Number(issuedAt) > STATE_TTL_MS) return null;

  return { influencerId, codeVerifier };
}

/** Where to send the creator, with a freshly generated PKCE pair embedded in
 *  the signed state so the callback can complete the exchange stateless. */
export function startXConnection(influencerId: string): string {
  const { codeVerifier, codeChallenge } = generatePkce();
  return authorizationUrl(issueState(influencerId, codeVerifier), codeChallenge);
}

export class XConnectionRefused extends Error {
  constructor(
    readonly code: "state_invalid" | "identity_mismatch" | "no_account",
    message: string,
  ) {
    super(message);
    this.name = "XConnectionRefused";
  }
}

export interface XConnectionResult {
  influencerId: string;
  accountName: string;
  identityMatched: boolean;
}

/**
 * Completes the round trip: code for tokens, then confirms *which* account
 * consented. Same identity-match discipline as the YouTube flow (Arch §2): a
 * creator authenticating as a different X account has proved they control
 * that other account, not this record, so the grant is refused rather than
 * silently attached to whichever profile the flow started from.
 */
export async function completeXConnection(code: string, state: string): Promise<XConnectionResult> {
  const verified = verifyState(state);
  if (!verified) {
    throw new XConnectionRefused(
      "state_invalid",
      "This connection link is invalid or has expired. Start the connection again.",
    );
  }

  const tokens = await exchangeCode(code, verified.codeVerifier);

  const owned = await fetchOwnAccount(tokens.accessToken);
  if (!owned) {
    throw new XConnectionRefused("no_account", "That X account could not be read.");
  }

  const data = readRecords();
  const account = data.accounts.find(
    (item) => item.influencerId === verified.influencerId && item.isPrimary,
  );
  if (!account) {
    throw new XConnectionRefused("no_account", "No tracked account for this creator.");
  }

  if (account.platformAccountId !== owned.userId) {
    throw new XConnectionRefused(
      "identity_mismatch",
      `That account is "@${owned.username}", which is not the account on this profile. ` +
        `Sign in with the X account that owns it.`,
    );
  }

  const grant: RawOAuthGrant = {
    accountId: account.id,
    influencerId: verified.influencerId,
    platform: "x",
    platformAccountId: owned.userId,
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
    accountName: owned.username,
    identityMatched: true,
  };
}

/** Reads the account the token's owner controls, via `/2/users/me`. */
async function fetchOwnAccount(
  accessToken: string,
): Promise<{ userId: string; username: string } | null> {
  const response = await fetch("https://api.twitter.com/2/users/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new ConnectorUnavailable(
      "x",
      response.status === 401 || response.status === 403 ? "forbidden" : "upstream_error",
      `Could not read the connected account (HTTP ${response.status}).`,
    );
  }

  const body = (await response.json()) as { data?: { id: string; username: string } };
  return body.data ? { userId: body.data.id, username: body.data.username } : null;
}

/** Flips the stored account and creator onto the connected/verified path.
 *  Identical in shape to `connection-service.ts`'s `markConnected` — it is not
 *  reused directly because it is not exported, and exporting one function to
 *  save six lines here is a smaller win than it looks like once the two
 *  call sites' platform-specific error types are accounted for. */
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

export function disconnectX(influencerId: string, accountId: string): void {
  removeGrant(accountId);
  markConnected(influencerId, accountId, false);
}

/**
 * A usable access token for an account, refreshing it if it has expired.
 *
 * X rotates the refresh token on every use (unlike Google), so the renewed
 * grant stores the *new* refresh token, not the one that was just spent.
 */
export async function xAccessTokenFor(accountId: string): Promise<string | null> {
  const grant = readRecords().grants.get(accountId);
  if (!grant || grant.needsReauth) return null;

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
      sealedRefreshToken: renewed.refreshToken ? sealToken(renewed.refreshToken) : grant.sealedRefreshToken,
      expiresAt: renewed.expiresAt,
      needsReauth: false,
    });
    return renewed.accessToken;
  } catch {
    upsertGrant({ ...grant, needsReauth: true });
    return null;
  }
}
