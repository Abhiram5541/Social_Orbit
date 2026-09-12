import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { ConnectorUnavailable } from "./x-connector";

/* ---------------------------------------------------------------------------
 * X OAuth2 (PKCE) — the second source tier.
 *
 * Everything the app-only connector reads is public. This is what a creator
 * authorises: their own account, and the identity match that makes SocialOrbit
 * Verified mean something (Arch §2). X's own "verified" blue-check flag is a
 * different, weaker claim and must never stand in for this.
 *
 * `X_OAUTH_CLIENT_ID` / `X_OAUTH_CLIENT_SECRET` are both empty today —
 * sign-in-with-X is not available yet. `xOAuthConfig()` returns null in that
 * state (same pattern as `youtubeOAuthConfig()`), so every route built on this
 * module correctly reports `ConnectorUnavailable("credentials_missing")` until
 * credentials are added. Nothing below is a stub: it activates unchanged the
 * moment the two env vars are set.
 * ------------------------------------------------------------------------ */

const AUTH_ENDPOINT = "https://twitter.com/i/oauth2/authorize";
const TOKEN_ENDPOINT = "https://api.twitter.com/2/oauth2/token";

/** Minimal read scopes. `offline.access` is what returns a refresh token —
 *  without it X issues an access token only, which is a two-hour reconnect
 *  loop for every creator. */
export const X_SCOPES = ["tweet.read", "users.read", "offline.access"] as const;

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

/** Null rather than throwing, so connector health can report without a catch. */
export function xOAuthConfig(): OAuthConfig | null {
  const clientId = process.env.X_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.X_OAUTH_CLIENT_SECRET?.trim();
  const redirectUri = process.env.X_OAUTH_REDIRECT_URI?.trim();

  if (!clientId || !clientSecret || !redirectUri) return null;
  return { clientId, clientSecret, redirectUri };
}

function requireConfig(): OAuthConfig {
  const config = xOAuthConfig();
  if (!config) {
    throw new ConnectorUnavailable(
      "x",
      "credentials_missing",
      "X_OAUTH_CLIENT_ID, _CLIENT_SECRET and _REDIRECT_URI must all be set to connect an account.",
    );
  }
  return config;
}

/* --- PKCE -------------------------------------------------------------------
 *
 * X's OAuth2 authorization-code flow requires PKCE even for a confidential
 * client (one holding a client secret). The verifier must be stored against
 * the same `state` the callback returns, so the caller — `connection-service`
 * equivalent for X — is responsible for persisting `{ state, codeVerifier }`
 * for the round trip; this module only generates and challenges the pair.
 * ------------------------------------------------------------------------ */

export interface PkcePair {
  codeVerifier: string;
  codeChallenge: string;
}

/** RFC 7636: 43–128 char unreserved-character string. 96 bytes of randomness,
 *  base64url-encoded, comfortably lands in range without padding. */
export function generatePkce(): PkcePair {
  const codeVerifier = randomBytes(96).toString("base64url");
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
  return { codeVerifier, codeChallenge };
}

/**
 * Where to send the creator to consent.
 *
 * `code_challenge_method=S256` is the only method X accepts server-side (the
 * `plain` method exists in the spec but is meant for clients that cannot
 * compute SHA-256, which this server can).
 */
export function authorizationUrl(state: string, codeChallenge: string): string {
  const config = requireConfig();
  const url = new URL(AUTH_ENDPOINT);

  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("scope", X_SCOPES.join(" "));
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");

  return url.toString();
}

const TokenResponse = z.object({
  access_token: z.string(),
  expires_in: z.number(),
  refresh_token: z.string().optional(),
  scope: z.string().optional(),
  token_type: z.string().optional(),
});

const TokenError = z.object({
  error: z.string(),
  error_description: z.string().optional(),
});

export interface OAuthTokens {
  accessToken: string;
  /** Absent unless `offline.access` was granted. Keep the stored one. */
  refreshToken: string | null;
  expiresAt: string;
  scopes: string[];
}

/**
 * X's confidential-client token requests authenticate with HTTP Basic
 * (client_id:client_secret) *and* still require the PKCE `code_verifier` on
 * the authorization_code grant — the two are independent protections and X
 * requires both, unlike Google which relies on the client secret alone.
 */
async function tokenRequest(body: Record<string, string>): Promise<OAuthTokens> {
  const config = requireConfig();
  const basic = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");

  let response: Response;
  try {
    response = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(body).toString(),
    });
  } catch (cause) {
    throw new ConnectorUnavailable("x", "upstream_error", `X token endpoint unreachable: ${String(cause)}`);
  }

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const parsed = TokenError.safeParse(payload);
    const detail = parsed.success
      ? `${parsed.data.error}${parsed.data.error_description ? `: ${parsed.data.error_description}` : ""}`
      : `HTTP ${response.status}`;

    if (parsed.success && parsed.data.error === "invalid_request" && detail.includes("redirect_uri")) {
      throw new ConnectorUnavailable(
        "x",
        "credentials_missing",
        `X rejected the redirect URI. The value in X_OAUTH_REDIRECT_URI must match the callback ` +
          `URI registered on the X developer app exactly. (${detail})`,
      );
    }

    throw new ConnectorUnavailable(
      "x",
      parsed.success && parsed.data.error === "invalid_client" ? "credentials_missing" : "forbidden",
      `X refused the token exchange: ${detail}`,
    );
  }

  const parsed = TokenResponse.safeParse(payload);
  if (!parsed.success) {
    throw new ConnectorUnavailable("x", "upstream_error", "X returned an unexpected token response.");
  }

  return {
    accessToken: parsed.data.access_token,
    refreshToken: parsed.data.refresh_token ?? null,
    expiresAt: new Date(Date.now() + parsed.data.expires_in * 1000).toISOString(),
    scopes: parsed.data.scope?.split(" ") ?? [...X_SCOPES],
  };
}

/** Exchanges the one-time code from the callback for tokens. Requires the
 *  `codeVerifier` generated alongside the `state` used to build the
 *  authorization URL for this same round trip. */
export function exchangeCode(code: string, codeVerifier: string): Promise<OAuthTokens> {
  const config = requireConfig();
  return tokenRequest({
    code,
    grant_type: "authorization_code",
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    code_verifier: codeVerifier,
  });
}

/**
 * Renews an expired access token.
 *
 * X rotates the refresh token on every use — unlike Google, the caller must
 * store the *new* `refreshToken` this returns, not just the new access token,
 * or the next renewal will fail with an already-used refresh token.
 */
export function refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
  const config = requireConfig();
  return tokenRequest({
    refresh_token: refreshToken,
    grant_type: "refresh_token",
    client_id: config.clientId,
  });
}
