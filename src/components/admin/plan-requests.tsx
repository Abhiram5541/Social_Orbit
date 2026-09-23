"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { PLAN_CONFIG, type Plan } from "@/lib/contracts/auth";
import { formatRelativeTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

/* Upgrade requests wait here because SENSO has no payment processor: the
 * commercial side is agreed off-platform and approving is what applies it. */
export interface PlanRequest {
  id: string;
  orgName: string;
  fromPlan: Plan;
  toPlan: Plan;
  requestedByName: string;
  requestedByEmail: string;
  note: string | null;
  createdAt: string;
}

export function PlanRequests({ requests }: { requests: PlanRequest[] }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState<string | null>(null);

  async function decide(id: string, decision: "approve" | "decline") {
    setBusy(id);
    await fetch(`/api/internal/admin/plan-changes/${id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision }),
    });
    setBusy(null);
    router.refresh();
  }

  if (requests.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Plan requests</CardTitle>
      </CardHeader>
      <ul className="divide-y divide-rule">
        {requests.map((request) => (
          <li key={request.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1 basis-64">
              <p className="font-medium text-ink">
                {request.orgName}: {PLAN_CONFIG[request.fromPlan].label} →{" "}
                {PLAN_CONFIG[request.toPlan].label}
              </p>
              <p className="text-sm text-ink-muted">
                {request.requestedByName} ({request.requestedByEmail}) ·{" "}
                {formatRelativeTime(request.createdAt)}
              </p>
              {request.note && <p className="mt-1 text-sm text-ink-muted">{request.note}</p>}
            </div>
            <Button size="sm" disabled={busy === request.id} onClick={() => decide(request.id, "approve")}>
              Approve
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={busy === request.id}
              onClick={() => decide(request.id, "decline")}
            >
              Decline
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
