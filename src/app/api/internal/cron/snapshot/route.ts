import { NextResponse, type NextRequest } from "next/server";
import { cronGate } from "@/server/auth/cron";
import { runSnapshotJob } from "@/server/services/daily-jobs";

/* ---------------------------------------------------------------------------
 * Daily snapshot job, for a scheduler that calls over HTTP (Vercel Cron).
 *
 * A snapshot is an observation of a moment, and a growth trend is what you get
 * when enough of them accumulate on different days. The job itself lives in
 * daily-jobs.ts; this route only fits it inside a serverless time limit.
 * ------------------------------------------------------------------------ */

/** Vercel caps a Hobby function at 60s; the job's own budget stays under it. */
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const refused = cronGate(request);
  if (refused) return refused;

  // Comfortably inside maxDuration, leaving room for the final write. The job
  // only records itself done when every due account was reached, so a cron
  // that fires more than once a day keeps working through the rest.
  const report = await runSnapshotJob(new Date(), { budgetMs: 45_000, maxChannels: 200 });
  if (!report) return NextResponse.json({ ranAt: new Date().toISOString(), alreadyRanToday: true });

  return NextResponse.json({
    ranAt: new Date().toISOString(),
    read: report.ingested,
    quotaUnitsSpent: report.quotaUnitsSpent,
    remaining: report.remaining,
    oldestRemaining: report.oldestRemaining,
    stoppedEarly: report.stoppedEarly,
  });
}
