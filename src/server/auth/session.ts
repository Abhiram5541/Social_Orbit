import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { SessionUser } from "@/lib/contracts/auth";

/* ---------------------------------------------------------------------------
 * Sessions.
 *
 * A signed, httpOnly cookie carrying the session id plus the identity fields
 * every request needs. Signing is HMAC-SHA256 over the payload, so a client
 * cannot promote itself by editing the cookie — the signature check happens
 * before the payload is trusted for anything.
 *
 * When PostgreSQL lands, the session id becomes a row so sessions can be
 * revoked server-side; the cookie format does not change.
 * ------------------------------------------------------------------------ */

export const SESSION_COOKIE = "so_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function secret(): string {
  const configured = process.env.AUTH_SECRET;
  if (configured && configured.length >= 32) return configured;

  if (process.env.NODE_ENV === "production") {
    // Refusing to boot is the correct behaviour: a predictable signing key in
    // production means anyone can mint a super_admin session.
    throw new Error(
      "AUTH_SECRET must be set to at least 32 characters in production. Refusing to sign sessions with a development key.",
    );
  }
  return "development-only-session-key-do-not-ship-32";
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

interface SessionPayload {
  sid: string;
  user: SessionUser;
  issuedAt: number;
  expiresAt: number;
}

export function encodeSession(user: SessionUser): { value: string; expiresAt: Date } {
  const now = Date.now();
  const expiresAt = now + MAX_AGE_SECONDS * 1000;
  const payload: SessionPayload = {
    sid: randomBytes(18).toString("base64url"),
    user,
    issuedAt: now,
    expiresAt,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return { value: `${encoded}.${sign(encoded)}`, expiresAt: new Date(expiresAt) };
}

export function decodeSession(cookieValue: string | undefined): SessionUser | null {
  if (!cookieValue) return null;

  const separator = cookieValue.lastIndexOf(".");
  if (separator <= 0) return null;

  const encoded = cookieValue.slice(0, separator);
  const signature = cookieValue.slice(separator + 1);

  const expected = Buffer.from(sign(encoded));
  const provided = Buffer.from(signature);
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString()) as SessionPayload;
    if (!payload.expiresAt || payload.expiresAt < Date.now()) return null;
    // The cookie is signed, but its *shape* is still validated — a stale cookie
    // from an older deployment must not flow into the app as a valid identity.
    const parsed = SessionUser.safeParse(payload.user);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** The session for the current request, or null. Safe in RSCs and handlers. */
export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  return decodeSession(store.get(SESSION_COOKIE)?.value);
}

export async function setSessionCookie(user: SessionUser): Promise<void> {
  const { value, expiresAt } = encodeSession(user);
  const store = await cookies();
  store.set(SESSION_COOKIE, value, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}
