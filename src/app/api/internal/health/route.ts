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
  return NextResponse.json(
    { ok, creators, uptimeSeconds: Math.round(process.uptime()) },
    { status: ok ? 200 : 503, headers: { "cache-control": "no-store" } },
  );
}
