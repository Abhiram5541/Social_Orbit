import { z } from "zod";
import { ConnectorUnavailable } from "./youtube-connector";

/* ---------------------------------------------------------------------------
 * YouTube OAuth — the second source tier.
 *
 * Everything the API-key connector reads is public. This is what a creator
 * authorises: their own analytics, which is where audience demographics, watch
 * time and impressions live, and the identity match that makes SocialOrbit
 * Verified mean something (Arch §2).
 *
 * Two scopes and no more. `youtube.readonly` confirms which channel consented;
 * `yt-analytics.readonly` reads the figures. Neither can post, edit or delete,
 * and a consent screen that asks for less is one more creator will accept.
 * ------------------------------------------------------------------------ */

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

export const YOUTUBE_SCOPES = [
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/yt-analytics.readonly",
] as const;

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

/** Null rather than throwing, so connector health can report without a catch. */
export function youtubeOAuthConfig(): OAuthConfig | null {
  const clientId = process.env.YOUTUBE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.YOUTUBE_OAUTH_CLIENT_SECRET?.trim();
  const redirectUri = process.env.YOUTUBE_OAUTH_REDIRECT_URI?.trim();

  if (!clientId || !clientSecret || !redirectUri) return null;
  return { clientId, clientSecret, redirectUri };
}

function requireConfig(): OAuthConfig {
  const config = youtubeOAuthConfig();
  if (!config) {
    throw new ConnectorUnavailable(
      "youtube",
      "credentials_missing",
      "YOUTUBE_OAUTH_CLIENT_ID, _SECRET and _REDIRECT_URI must all be set to connect an account.",
    );
  }
  return config;
}

/**
 * Where to send the creator to consent.
 *
 * `access_type=offline` with `prompt=consent` is what returns a refresh token.
 * Google issues one only on the first consent otherwise, so a creator who
 * reconnects after a revocation would come back with an access token that
 * expires in an hour and no way to renew it.
 */
export function authorizationUrl(state: string): string {
  const config = requireConfig();
  const url = new URL(AUTH_ENDPOINT);

  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", YOUTUBE_SCOPES.join(" "));
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", state);

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
  /** Absent when Google reuses an existing grant. Keep the stored one. */
  refreshToken: string | null;
  expiresAt: string;
  scopes: string[];
}

async function tokenRequest(body: Record<string, string>): Promise<OAuthTokens> {
  let response: Response;
  try {
    response = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body).toString(),
    });
  } catch (cause) {
    throw new ConnectorUnavailable(
      "youtube",
      "upstream_error",
      `Google token endpoint unreachable: ${String(cause)}`,
    );
  }

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const parsed = TokenError.safeParse(payload);
    const detail = parsed.success
      ? `${parsed.data.error}${parsed.data.error_description ? `: ${parsed.data.error_description}` : ""}`
      : `HTTP ${response.status}`;

    // redirect_uri_mismatch is by far the most common first-run failure, and
    // the generic message sends people to the wrong place entirely.
    if (parsed.success && parsed.data.error === "redirect_uri_mismatch") {
      throw new ConnectorUnavailable(
        "youtube",
        "credentials_missing",
        `Google rejected the redirect URI. The value in YOUTUBE_OAUTH_REDIRECT_URI must appear ` +
          `verbatim under "Authorized redirect URIs" on the OAuth client. (${detail})`,
      );
    }

    throw new ConnectorUnavailable(
      "youtube",
      parsed.success && parsed.data.error === "invalid_client" ? "credentials_missing" : "forbidden",
      `Google refused the token exchange: ${detail}`,
    );
  }

  const parsed = TokenResponse.safeParse(payload);
  if (!parsed.success) {
    throw new ConnectorUnavailable(
      "youtube",
      "upstream_error",
      "Google returned an unexpected token response.",
    );
  }

  return {
    accessToken: parsed.data.access_token,
    refreshToken: parsed.data.refresh_token ?? null,
    expiresAt: new Date(Date.now() + parsed.data.expires_in * 1000).toISOString(),
    scopes: parsed.data.scope?.split(" ") ?? [...YOUTUBE_SCOPES],
  };
}

/** Exchanges the one-time code from the callback for tokens. */
export function exchangeCode(code: string): Promise<OAuthTokens> {
  const config = requireConfig();
  return tokenRequest({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    grant_type: "authorization_code",
  });
}

/**
 * Renews an expired access token.
 *
 * Google does not return a new refresh token here, so the caller keeps the one
 * it holds. A failure means the creator revoked access — which is a
 * `needsReauth` state, not an error to retry.
 */
export function refreshAccessToken(refreshToken: string): Promise<OAuthTokens> {
  const config = requireConfig();
  return tokenRequest({
    refresh_token: refreshToken,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    grant_type: "refresh_token",
  });
}
