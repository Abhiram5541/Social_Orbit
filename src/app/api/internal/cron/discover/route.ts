import { NextResponse, type NextRequest } from "next/server";
import { cronGate } from "@/server/auth/cron";
import { runDiscoveryJob } from "@/server/services/daily-jobs";

/**
 * Daily discovery job, for a scheduler that calls over HTTP (Vercel Cron).
 * Runs today's slice of the rotation in daily-jobs.ts; once per UTC day.
 */
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const refused = cronGate(request);
  if (refused) return refused;

  const report = await runDiscoveryJob();
  if (!report) return NextResponse.json({ ranAt: new Date().toISOString(), alreadyRanToday: true });

  return NextResponse.json({
    ranAt: new Date().toISOString(),
    discovered: report.discovered,
    added: report.ingested,
    quotaUnitsSpent: report.quotaUnitsSpent,
    stoppedEarly: report.stoppedEarly,
  });
}
