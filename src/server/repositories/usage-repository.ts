import { PLAN_CONFIG, type Plan } from "@/lib/contracts/auth";
import type { SearchQuota } from "@/lib/contracts/search";
import { appRows, persist } from "@/server/data/app-store";

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
  /** `${orgId}:${metric}` — the row key, so the store can address it. */
  id: string;
  count: number;
  periodStart: string;
}

const counters = () => appRows<Counter>("usage", () => []);

/**
 * Closed periods. A counter only ever holds the *current* month, so a period
 * that rolls over is archived on the way out — otherwise last month's usage
 * is gone and a statement can only ever describe today.
 */
export interface UsagePeriod {
  id: string;
  orgId: string;
  metric: UsageMetric;
  periodStart: string;
  count: number;
}

const history = () => appRows<UsagePeriod>("usage_history", () => []);

export function usageHistory(orgId: string): UsagePeriod[] {
  return history()
    .filter((row) => row.orgId === orgId)
    .sort((a, b) => b.periodStart.localeCompare(a.periodStart));
}

function key(orgId: string, metric: UsageMetric): string {
  return `${orgId}:${metric}`;
}

function find(id: string): Counter | undefined {
  return counters().find((counter) => counter.id === id);
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
  const record = find(key(orgId, metric));
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
  const id = key(orgId, metric);
  const existing = find(id);
  if (existing && existing.periodStart !== start.toISOString() && existing.count > 0) {
    const closed: UsagePeriod = {
      id: `${id}:${existing.periodStart}`,
      orgId,
      metric,
      periodStart: existing.periodStart,
      count: existing.count,
    };
    if (!history().some((row) => row.id === closed.id)) {
      history().push(closed);
      persist("usage_history", [closed]);
    }
  }
  const next: Counter =
    existing && existing.periodStart === start.toISOString()
      ? { id, count: existing.count + 1, periodStart: existing.periodStart }
      : { id, count: 1, periodStart: start.toISOString() };
  if (existing) Object.assign(existing, next);
  else counters().push(next);
  persist("usage", [next]);
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
  counters().length = 0;
}
