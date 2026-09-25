import { NextResponse } from "next/server";
import { readRecords } from "@/server/data/records";

/**
 * Liveness for the VPS healthcheck and any uptime monitor. Unauthenticated
 * and cheap: it says the process answers and the database is loaded, which
 * is the pair that a crashed boot or a lost Postgres connection would break.
 * The creator count is already public on the landing page.
 */
export const dynamic = "force-dynamic";

export function GET() {
  const creators = readRecords().influencers.length;
  const ok = creators > 0;
  // The database is resident, so memory is the capacity gauge (D42); the
  // healthcheck warns before the heap limit does.
  const usage = process.memoryUsage();
  const memoryMb = Math.round(usage.rss / 1048576);
  // RSS is what the box sees, but it holds freed pages for a while after a
  // scoring pass, so it reads high long after the data has shrunk. The heap
  // is what the record set actually costs, and it is the number to watch when
  // judging whether a change to what is resident did anything.
  const heapMb = Math.round(usage.heapUsed / 1048576);
  const heapLimitMb = Math.round(
    (process.availableMemory?.() ?? 0) / 1048576,
  );
  return NextResponse.json(
    {
      ok,
      creators,
      memoryMb,
      heapMb,
      heapHeadroomMb: heapLimitMb || undefined,
      slimContent: process.env.SENSO_SLIM_CONTENT === "true",
      uptimeSeconds: Math.round(process.uptime()),
    },
    { status: ok ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
