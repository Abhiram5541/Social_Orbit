import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { errorResponse } from "./rbac";

/**
 * The cron routes are called by a scheduler, not a person, so they are
 * authenticated by a shared secret rather than a session. Unsecured, each
 * would be an endpoint any passer-by could use to burn a day's API quota —
 * which is also why an unset secret disables them instead of opening them.
 */
export function cronGate(request: NextRequest): Response | null {
  const expected = process.env.CRON_SECRET?.trim();
  if (!expected) {
    return errorResponse(
      "connector_unavailable",
      "CRON_SECRET is not set, so scheduled jobs are disabled.",
    );
  }

  // Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`.
  const header = request.headers.get("authorization") ?? "";
  const given = header.startsWith("Bearer ") ? header.slice(7) : header;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return errorResponse("unauthenticated", "Invalid cron credentials.");
  }
  return null;
}
