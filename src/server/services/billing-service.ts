import { PLAN_CONFIG, type Plan, type SessionUser } from "@/lib/contracts/auth";
import { ApiFailure, assertTenantAccess } from "@/server/auth/rbac";
import { appRows, persist } from "@/server/data/app-store";
import { findOrg, listUsers, updateOrg } from "@/server/repositories/user-repository";
import {
  currentPeriod,
  getUsage,
  usageHistory,
  type UsageMetric,
} from "@/server/repositories/usage-repository";
import { sendEmail } from "./notification-service";

/* ---------------------------------------------------------------------------
 * Plan management, self-serve.
 *
 * What is here: the entitlements a plan grants, what the organisation has
 * actually used against each of them, a seat and feature check that route
 * handlers call, a plan change an owner makes themselves, and a statement per
 * billing period.
 *
 * What is deliberately *not* here: prices and payment collection. SENSO has
 * no payment processor, and inventing a price list so the screen looks
 * complete would put a fabricated commercial fact on the one page a customer
 * reads most carefully. So a downgrade applies by itself — nothing is owed to
 * take less — and an upgrade is recorded, acknowledged and applied by SENSO
 * once the commercial side is agreed. The client still manages it from their
 * own workspace, which is what self-serve means here.
 *
 * ponytail: no processor. When one is added, `applyChange` is the seam — the
 * upgrade path becomes "charge, then apply" and nothing above this changes.
 * ------------------------------------------------------------------------ */

export const BILLING_VERSION = "billing-1.0.0";

export type Feature = keyof (typeof PLAN_CONFIG)["free"]["features"];

export interface Entitlement {
  key: string;
  label: string;
  used: number;
  /** null = unlimited. */
  limit: number | null;
  remaining: number | null;
  exceeded: boolean;
}

export interface PlanChange {
  id: string;
  orgId: string;
  fromPlan: Plan;
  toPlan: Plan;
  direction: "upgrade" | "downgrade";
  status: "pending" | "scheduled" | "applied" | "declined" | "cancelled";
  /** When a scheduled downgrade takes effect. Null for an upgrade request. */
  effectiveAt: string | null;
  requestedByName: string;
  requestedByEmail: string;
  note: string | null;
  decidedByName: string | null;
  decidedAt: string | null;
  createdAt: string;
}

const changes = () => appRows<PlanChange>("plan_changes", () => []);

const nextId = () => `plc_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const RANK: Record<Plan, number> = { free: 0, growth: 1, enterprise: 2 };

/* --- Entitlements ------------------------------------------------------- */

export async function entitlements(orgId: string, plan: Plan): Promise<Entitlement[]> {
  const config = PLAN_CONFIG[plan];
  const seats = (await listUsers(orgId)).filter((user) => user.status === "active").length;

  const row = (key: string, label: string, used: number, limit: number | null): Entitlement => ({
    key,
    label,
    used,
    limit,
    remaining: limit === null ? null : Math.max(0, limit - used),
    exceeded: limit !== null && used > limit,
  });

  return [
    row("searches", "Influencer searches", getUsage(orgId, "influencer_search"), config.searchesPerMonth),
    row("seats", "Seats", seats, config.seats),
    row(
      "api",
      "API requests",
      getUsage(orgId, "api_request"),
      config.features.api ? config.apiRequestsPerMonth : 0,
    ),
    row("exports", "Exports", getUsage(orgId, "export"), config.features.exports ? null : 0),
    row("reports", "Reports generated", getUsage(orgId, "report"), null),
  ];
}

/**
 * Throws unless the plan includes the feature. Called by the handlers that do
 * the thing, because a plan limit enforced only by a hidden button is not a
 * limit — it is a suggestion (CLAUDE.md §5).
 */
export function assertFeature(user: SessionUser, feature: Feature): void {
  // Platform staff operate every organisation; their own org's plan is not
  // what gates that.
  if (user.orgKind === "platform") return;
  if (PLAN_CONFIG[user.plan].features[feature]) return;
  const needed = (["growth", "enterprise"] as Plan[]).find((plan) => PLAN_CONFIG[plan].features[feature]);
  throw new ApiFailure(
    "forbidden",
    `The ${PLAN_CONFIG[user.plan].label} plan does not include this. ${
      needed ? `It is part of ${PLAN_CONFIG[needed].label}.` : ""
    }`.trim(),
  );
}

/* --- Changing plan ------------------------------------------------------ */

export function pendingChange(orgId: string): PlanChange | null {
  return (
    changes()
      .filter((change) => change.orgId === orgId)
      .filter((change) => change.status === "pending" || change.status === "scheduled")
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null
  );
}

export function listChanges(orgId?: string): PlanChange[] {
  return changes()
    .filter((change) => !orgId || change.orgId === orgId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function requestPlanChange(
  user: SessionUser,
  toPlan: Plan,
  note?: string,
): Promise<PlanChange> {
  const org = await findOrg(user.orgId);
  if (!org) throw new ApiFailure("not_found", "Organisation not found.");
  if (org.plan === toPlan) throw new ApiFailure("validation_failed", "That is already your plan.");
  if (pendingChange(user.orgId)) {
    throw new ApiFailure("conflict", "A plan change is already in progress. Cancel it first.");
  }

  const direction = RANK[toPlan] > RANK[org.plan] ? "upgrade" : "downgrade";

  if (direction === "downgrade") {
    // Checked now so the owner is told immediately, and again when it applies
    // — the organisation can grow past the smaller plan in the meantime.
    const blocking = (await entitlements(org.id, toPlan)).filter((item) => item.exceeded);
    if (blocking.some((item) => item.key === "seats")) {
      const seats = blocking.find((item) => item.key === "seats")!;
      throw new ApiFailure(
        "validation_failed",
        `${PLAN_CONFIG[toPlan].label} includes ${seats.limit} seats and ${seats.used} accounts are active. Suspend the extra accounts first.`,
      );
    }
  }

  const change: PlanChange = {
    id: nextId(),
    orgId: org.id,
    fromPlan: org.plan,
    toPlan,
    direction,
    // A downgrade is the client's to make, so it is scheduled rather than
    // requested — but at the end of the period they already have, not now.
    status: direction === "downgrade" ? "scheduled" : "pending",
    effectiveAt: direction === "downgrade" ? currentPeriod().end.toISOString() : null,
    requestedByName: user.name,
    requestedByEmail: user.email,
    note: note?.trim() || null,
    decidedByName: null,
    decidedAt: null,
    createdAt: new Date().toISOString(),
  };
  changes().push(change);
  persist("plan_changes", [change]);

  const to = process.env.EMAIL_REPORT_TO;
  if (to && direction === "upgrade") {
    void sendEmail({
      to,
      subject: `Plan upgrade requested: ${org.name} → ${PLAN_CONFIG[toPlan].label}`,
      html: `<p><strong>${org.name}</strong> asked to move from ${PLAN_CONFIG[org.plan].label} to ${PLAN_CONFIG[toPlan].label}.</p><p>Requested by ${user.name} (${user.email}).</p>${change.note ? `<p>${change.note}</p>` : ""}`,
    });
  }
  return change;
}

export function cancelPlanChange(user: SessionUser, id: string): PlanChange {
  const change = changes().find((entry) => entry.id === id);
  if (!change) throw new ApiFailure("not_found", "No such request.");
  assertTenantAccess(user, change.orgId);
  if (change.status !== "pending" && change.status !== "scheduled") {
    throw new ApiFailure("conflict", "That request has already been settled.");
  }
  change.status = "cancelled";
  change.decidedByName = user.name;
  change.decidedAt = new Date().toISOString();
  persist("plan_changes", [change]);
  return change;
}

/** SENSO's side of an upgrade: approve it once the commercial side is agreed. */
export async function decidePlanChange(
  staff: SessionUser,
  id: string,
  decision: "approve" | "decline",
): Promise<PlanChange> {
  if (staff.orgKind !== "platform") throw new ApiFailure("forbidden", "Platform staff only.");
  const change = changes().find((entry) => entry.id === id);
  if (!change) throw new ApiFailure("not_found", "No such request.");
  if (change.status !== "pending") throw new ApiFailure("conflict", "That request is not pending.");

  if (decision === "approve") await applyChange(change);
  else change.status = "declined";

  change.decidedByName = staff.name;
  change.decidedAt = new Date().toISOString();
  persist("plan_changes", [change]);
  return change;
}

async function applyChange(change: PlanChange): Promise<void> {
  await updateOrg(change.orgId, { plan: change.toPlan });
  change.status = "applied";
  change.effectiveAt = new Date().toISOString();
  persist("plan_changes", [change]);

  void sendEmail({
    to: change.requestedByEmail,
    subject: `Your plan is now ${PLAN_CONFIG[change.toPlan].label}`,
    html: `<p>${change.requestedByName}, your organisation is on the ${PLAN_CONFIG[change.toPlan].label} plan.</p><p>It applies to everyone on the account from their next request — no sign-out needed.</p>`,
  });
}

/** Applies scheduled downgrades that have come due. Called by the daily clock. */
export async function applyDuePlanChanges(now = new Date()): Promise<number> {
  let applied = 0;
  for (const change of changes()) {
    if (change.status !== "scheduled" || !change.effectiveAt) continue;
    if (change.effectiveAt > now.toISOString()) continue;

    // Re-checked at the moment it applies: the organisation may have grown
    // past the smaller plan since it was scheduled, and silently cutting
    // their seats off is worse than leaving the downgrade pending.
    const blocking = (await entitlements(change.orgId, change.toPlan)).find(
      (item) => item.key === "seats" && item.exceeded,
    );
    if (blocking) {
      change.note = `${change.note ? `${change.note} — ` : ""}Held on ${now.toISOString().slice(0, 10)}: ${blocking.used} seats in use, ${PLAN_CONFIG[change.toPlan].label} includes ${blocking.limit}.`;
      change.effectiveAt = currentPeriod(now).end.toISOString();
      persist("plan_changes", [change]);
      continue;
    }
    await applyChange(change);
    applied += 1;
  }
  return applied;
}

/* --- Statements --------------------------------------------------------- */

export interface Statement {
  periodStart: string;
  plan: Plan;
  lines: { metric: UsageMetric; label: string; count: number; limit: number | null }[];
  /** Whether this period is still open. */
  current: boolean;
}

const METRIC_LABEL: Record<UsageMetric, string> = {
  influencer_search: "Influencer searches",
  api_request: "API requests",
  export: "Exports",
  report: "Reports",
};

/**
 * Usage per billing period. Not an invoice: there is no price list, so this
 * states what was used, not what is owed.
 */
export async function statements(orgId: string, plan: Plan): Promise<Statement[]> {
  const { start } = currentPeriod();
  const config = PLAN_CONFIG[plan];
  const limit: Record<UsageMetric, number | null> = {
    influencer_search: config.searchesPerMonth,
    api_request: config.apiRequestsPerMonth,
    export: null,
    report: null,
  };

  const byPeriod = new Map<string, Statement>();
  const put = (periodStart: string, metric: UsageMetric, count: number) => {
    const statement =
      byPeriod.get(periodStart) ??
      byPeriod
        .set(periodStart, {
          periodStart,
          plan,
          lines: [],
          current: periodStart === start.toISOString(),
        })
        .get(periodStart)!;
    statement.lines.push({ metric, label: METRIC_LABEL[metric], count, limit: limit[metric] });
  };

  for (const row of usageHistory(orgId)) put(row.periodStart, row.metric, row.count);
  for (const metric of Object.keys(METRIC_LABEL) as UsageMetric[]) {
    const used = getUsage(orgId, metric);
    if (used > 0) put(start.toISOString(), metric, used);
  }

  return [...byPeriod.values()].sort((a, b) => b.periodStart.localeCompare(a.periodStart));
}
