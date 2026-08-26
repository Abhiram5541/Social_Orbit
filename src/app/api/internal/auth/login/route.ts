import { NextResponse, type NextRequest } from "next/server";
import { LoginInput, ROLE_WORKSPACE } from "@/lib/contracts/auth";
import { WORKSPACE_HOME } from "@/lib/navigation";
import { errorResponse, handler } from "@/server/auth/rbac";
import { setSessionCookie } from "@/server/auth/session";
import { authenticate } from "@/server/repositories/user-repository";
import { checkRateLimit } from "@/server/services/rate-limit";

/**
 * Attempts allowed per address per minute. Configurable because an automated
 * test suite drives every sign-in from one loopback address and would trip a
 * production threshold within seconds. The default is the production value —
 * raising it is an explicit, per-environment decision.
 */
const ATTEMPTS_PER_MINUTE = Number(process.env.AUTH_RATE_LIMIT_PER_MINUTE ?? 10);

export async function POST(request: NextRequest) {
  return handler(async () => {
    // Credential endpoints are rate limited by client address: without this,
    // the login form is a password oracle.
    const limit = checkRateLimit(`login:${clientKey(request)}`, {
      max: ATTEMPTS_PER_MINUTE,
      windowMs: 60_000,
    });
    if (!limit.allowed) {
      return errorResponse(
        "rate_limited",
        `Too many sign-in attempts. Try again in ${Math.ceil(limit.retryAfterMs / 1000)} seconds.`,
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = LoginInput.safeParse(body);
    if (!parsed.success) {
      return errorResponse("validation_failed", "Check the details and try again.", {
        details: fieldErrors(parsed.error),
      });
    }

    const result = await authenticate(parsed.data.email, parsed.data.password);
    if (!result.ok) {
      // One message for both wrong-password and unknown-email. Distinguishing
      // them would let anyone enumerate which accounts exist.
      return errorResponse("unauthenticated", "Email or password is incorrect.");
    }

    await setSessionCookie(result.user);

    return NextResponse.json({
      user: result.user,
      redirectTo: WORKSPACE_HOME[ROLE_WORKSPACE[result.user.role]],
    });
  });
}

function clientKey(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

function fieldErrors(error: { issues: { path: PropertyKey[]; message: string }[] }) {
  const details: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    (details[key] ??= []).push(issue.message);
  }
  return details;
}
