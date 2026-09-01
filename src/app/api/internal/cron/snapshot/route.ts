import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { errorResponse } from "@/server/auth/rbac";
import { refreshStale } from "@/server/services/harvest-service";

/* ---------------------------------------------------------------------------
 * Daily snapshot job.
 *
 * A snapshot is an observation of a moment, and a growth trend is what you get
 * when enough of them accumulate on different days. Nobody is going to click
 * refresh on 627 creators every morning, so this is the thing that makes the
 * growth-pattern component reachable at all.
 *
 * Authenticated by a shared secret rather than a session: the caller is a
 * scheduler, not a person. Unsecured, it would be an endpoint any passer-by
 * could use to burn a day's API quota.
 * ------------------------------------------------------------------------ */

/** Vercel caps a Hobby function at 60s; the job's own budget stays under it. */
export const maxDuration = 60;

function authorised(request: NextRequest): boolean {
  const expected = process.env.CRON_SECRET?.trim();
  if (!expected) return false;

  // Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`.
  const header = request.headers.get("authorization") ?? "";
  const given = header.startsWith("Bearer ") ? header.slice(7) : header;

  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET?.trim()) {
    // Refusing beats running unauthenticated: this endpoint spends quota.
    return errorResponse(
      "connector_unavailable",
      "CRON_SECRET is not set, so the scheduled snapshot job is disabled.",
    );
  }
  if (!authorised(request)) {
    return errorResponse("unauthenticated", "Invalid cron credentials.");
  }

  const report = await refreshStale({
    // Comfortably inside maxDuration, leaving room for the final write.
    budgetMs: 45_000,
    maxChannels: 200,
  });

  return NextResponse.json({
    ranAt: new Date().toISOString(),
    read: report.ingested,
    quotaUnitsSpent: report.quotaUnitsSpent,
    remaining: report.remaining,
    oldestRemaining: report.oldestRemaining,
    stoppedEarly: report.stoppedEarly,
  });
}
