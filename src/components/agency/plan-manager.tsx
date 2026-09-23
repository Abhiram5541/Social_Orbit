"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { PLAN_CONFIG, type Plan } from "@/lib/contracts/auth";
import { formatDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Select, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/states";

/* ---------------------------------------------------------------------------
 * Changing plan, from inside the workspace.
 *
 * A downgrade is the customer's to make and applies at the end of the period
 * they have already got. An upgrade needs the commercial side agreed, and
 * SENSO has no payment processor — so this records the request and says so
 * plainly rather than showing a checkout that would not charge anything.
 * ------------------------------------------------------------------------ */

export interface PendingChange {
  id: string;
  toPlan: Plan;
  fromPlan: Plan;
  direction: "upgrade" | "downgrade";
  status: string;
  effectiveAt: string | null;
  requestedByName: string;
  note: string | null;
}

const RANK: Record<Plan, number> = { free: 0, growth: 1, enterprise: 2 };

export function PlanManager({
  plan,
  pending,
  canWrite,
}: {
  plan: Plan;
  pending: PendingChange | null;
  canWrite: boolean;
}) {
  const router = useRouter();
  const [target, setTarget] = React.useState<Plan | "">("");
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function post(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    const response = await fetch("/api/internal/billing", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: { message?: string } }
        | null;
      setError(payload?.error?.message ?? "Could not change the plan.");
      return;
    }
    setTarget("");
    setNote("");
    router.refresh();
  }

  if (pending) {
    const scheduled = pending.status === "scheduled";
    return (
      <div className="space-y-3">
        <Notice
          tone={scheduled ? "info" : "caution"}
          title={
            scheduled
              ? `Moving to ${PLAN_CONFIG[pending.toPlan].label} on ${formatDate(pending.effectiveAt ?? "")}`
              : `${PLAN_CONFIG[pending.toPlan].label} requested`
          }
        >
          {scheduled
            ? "You keep everything the current plan includes until then — a downgrade does not take back a period you already have."
            : "SENSO has been notified and will confirm the commercial side before the plan changes. Nothing has been charged."}
          {pending.note && <span className="mt-1 block text-ink-muted">{pending.note}</span>}
        </Notice>
        {canWrite && (
          <Button variant="ghost" onClick={() => post({ cancel: pending.id })} disabled={busy}>
            Cancel this change
          </Button>
        )}
      </div>
    );
  }

  const options = (Object.keys(PLAN_CONFIG) as Plan[]).filter((option) => option !== plan);
  const direction = target ? (RANK[target] > RANK[plan] ? "upgrade" : "downgrade") : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Change to" className="min-w-48">
          <Select
            value={target}
            onChange={(event) => setTarget(event.target.value as Plan | "")}
            disabled={!canWrite}
          >
            <option value="">Stay on {PLAN_CONFIG[plan].label}</option>
            {options.map((option) => (
              <option key={option} value={option}>
                {PLAN_CONFIG[option].label}
              </option>
            ))}
          </Select>
        </Field>
        {direction && (
          <Badge tone={direction === "upgrade" ? "brand" : "neutral"}>
            {direction === "upgrade" ? "Upgrade" : "Downgrade"}
          </Badge>
        )}
      </div>

      {direction === "upgrade" && (
        <>
          <Field label="Anything we should know" hint="Optional — seats needed, timing, who to invoice.">
            <Textarea rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
          </Field>
          <p className="text-base text-ink-muted">
            Requesting an upgrade notifies SENSO. Nothing is charged here — there is no
            payment processor in the product, and a checkout that took no money would be a
            worse lie than saying so.
          </p>
        </>
      )}
      {direction === "downgrade" && (
        <p className="text-base text-ink-muted">
          This applies at the end of the current billing period, and is refused now if more
          accounts are active than {PLAN_CONFIG[target as Plan].label} includes.
        </p>
      )}

      {error && (
        <Notice tone="critical" title="Not changed">
          {error}
        </Notice>
      )}

      <Button
        onClick={() => post({ plan: target, note: note.trim() || undefined })}
        disabled={!canWrite || !target || busy}
      >
        {busy ? "Working…" : direction === "downgrade" ? "Schedule the change" : "Request the upgrade"}
      </Button>
      {!canWrite && (
        <p className="text-sm text-ink-subtle">Only the account owner can change the plan.</p>
      )}
    </div>
  );
}
