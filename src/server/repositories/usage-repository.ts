import { PLAN_CONFIG, type Plan } from "@/lib/contracts/auth";
import type { SearchQuota } from "@/lib/contracts/search";
import { shared } from "@/server/data/process-store";

/* ---------------------------------------------------------------------------
 * Usage metering — Architecture doc §3.
 *
 * The free-plan search allowance is a server-side counter keyed by
 * organisation and billing period. It is deliberately not derived from
 * anything the client sends: a request cannot spend someone else's allowance,
 * and clearing browser storage does not reset it.
 *
 * Counters live in process memory under the development driver, which means
 * they reset on restart. The Postgres implementation replaces the Map with an
 * upsert against a `usage_counters` table on (org_id, metric, period_start).
 * ------------------------------------------------------------------------ */

export type UsageMetric = "influencer_search" | "api_request" | "export" | "report";

interface Counter {
  count: number;
  periodStart: string;
}

const counters = shared("usage-counters", () => new Map<string, Counter>());

function key(orgId: string, metric: UsageMetric): string {
  return `${orgId}:${metric}`;
}

/** Calendar-month billing period. Returned in UTC so it is unambiguous. */
export function currentPeriod(now: Date = new Date()): { start: Date; end: Date } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start, end };
}

export function getUsage(
  orgId: string,
  metric: UsageMetric,
  now: Date = new Date(),
): number {
  const { start } = currentPeriod(now);
  const record = counters.get(key(orgId, metric));
  // A counter from a previous period is stale, not zero-by-accident.
  if (!record || record.periodStart !== start.toISOString()) return 0;
  return record.count;
}

export function incrementUsage(
  orgId: string,
  metric: UsageMetric,
  now: Date = new Date(),
): number {
  const { start } = currentPeriod(now);
  const existing = counters.get(key(orgId, metric));
  const next: Counter =
    existing && existing.periodStart === start.toISOString()
      ? { count: existing.count + 1, periodStart: existing.periodStart }
      : { count: 1, periodStart: start.toISOString() };
  counters.set(key(orgId, metric), next);
  return next.count;
}

export function quotaFor(
  orgId: string,
  plan: Plan,
  now: Date = new Date(),
): SearchQuota {
  const { start, end } = currentPeriod(now);
  const limit = PLAN_CONFIG[plan].searchesPerMonth;
  const used = getUsage(orgId, "influencer_search", now);

  return {
    limit,
    used,
    remaining: limit === null ? null : Math.max(0, limit - used),
    periodStart: start.toISOString(),
    resetsAt: end.toISOString(),
    plan,
  };
}

export function hasQuota(quota: SearchQuota): boolean {
  return quota.remaining === null || quota.remaining > 0;
}

/** Test seam so quota behaviour can be exercised without a restart. */
export function __resetUsage(): void {
  counters.clear();
}
