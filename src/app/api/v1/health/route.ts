import { NextResponse } from "next/server";

/**
 * GET /v1/health — DPR §17.1
 *
 * Unauthenticated on purpose: a health check that requires a credential is
 * useless to a load balancer. It reports liveness only, never counts or
 * configuration, so it leaks nothing about the deployment.
 */
export function GET() {
  return NextResponse.json(
    { status: "ok", version: "1", time: new Date().toISOString() },
    { headers: { "cache-control": "no-store" } },
  );
}
