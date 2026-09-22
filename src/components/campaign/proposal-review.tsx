"use client";

import * as React from "react";
import { Check, X } from "lucide-react";
import {
  DECISION_LABEL,
  type Proposal,
  type ProposalDecision,
} from "@/lib/contracts/campaign-workflow";
import { formatCompact, formatCurrency, formatDate, NO_VALUE } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Notice } from "@/components/ui/states";
import { ScorePill } from "@/components/intelligence/score";

/**
 * Approve or reject each creator, with a comment. Decisions post one at a
 * time and the panel re-reads the server's answer, so two people reviewing
 * the same link cannot silently overwrite each other's decisions.
 */
export function ProposalReview({ token, initial }: { token: string; initial: Proposal }) {
  const [proposal, setProposal] = React.useState(initial);
  const [busy, setBusy] = React.useState<string | null>(null);
  const [comments, setComments] = React.useState<Record<string, string>>({});
  const [error, setError] = React.useState<string | null>(null);

  const decided = proposal.lines.filter((line) => line.decision !== "pending").length;
  const approved = proposal.lines.filter((line) => line.decision === "approved").length;

  async function decide(influencerId: string, decision: "approved" | "rejected") {
    setBusy(influencerId);
    setError(null);
    const response = await fetch(`/api/public/proposal/${token}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ influencerId, decision, comment: comments[influencerId] ?? "" }),
    }).catch(() => null);
    setBusy(null);
    if (response?.ok) {
      setProposal((await response.json()) as Proposal);
      return;
    }
    setError("Could not save that decision. Try again.");
  }

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <p className="label-caps text-brand-ink">Campaign proposal · v{proposal.version}</p>
        <h1 className="display-sm text-ink">{proposal.campaignName}</h1>
        <p className="text-base text-ink-muted">
          {decided} of {proposal.lines.length} decided · {approved} approved
          {proposal.expiresOn && ` · open until ${formatDate(proposal.expiresOn)}`}
        </p>
      </header>

      {proposal.note && <Notice tone="info">{proposal.note}</Notice>}
      {error && <Notice tone="critical">{error}</Notice>}
      {proposal.completedAt && (
        <Notice tone="positive" title="Every creator has been decided">
          Your decisions are saved. You can still change any of them from this page.
        </Notice>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Proposed creators</CardTitle>
          <span className="text-sm text-ink-muted">
            Scores are SENSO&apos;s own measurements, not the agency&apos;s
          </span>
        </CardHeader>
        <ul className="divide-y divide-rule">
          {proposal.lines.map((line) => (
            <li key={line.influencerId} className="px-4 py-3">
              <div className="flex flex-wrap items-center gap-3">
                <Avatar name={line.displayName} src={line.avatarUrl} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink">{line.displayName}</p>
                  <p className="truncate font-num text-sm text-ink-muted">
                    @{line.primaryHandle} · {formatCompact(line.followers)} followers
                  </p>
                </div>
                <div className="text-right">
                  <p className="label-caps-sm text-ink-subtle">Health</p>
                  <ScorePill value={line.healthScore} label="SENSO Health" />
                </div>
                <div className="text-right">
                  <p className="label-caps-sm text-ink-subtle">Rate</p>
                  <p className="font-num text-base text-ink">
                    {line.agreedRate === null
                      ? NO_VALUE
                      : formatCurrency(line.agreedRate, line.currency, { compact: true })}
                  </p>
                </div>
                <StatusBadge decision={line.decision} />
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input
                  className="h-9 min-w-56 flex-1 rounded-full border border-line-strong bg-surface px-3 text-[14px] text-ink placeholder:text-ink-subtle focus:border-brand focus:outline-none"
                  placeholder="Comment (optional)"
                  defaultValue={line.comment ?? ""}
                  onChange={(event) =>
                    setComments((current) => ({ ...current, [line.influencerId]: event.target.value }))
                  }
                />
                <Button
                  size="sm"
                  variant={line.decision === "approved" ? "primary" : "secondary"}
                  loading={busy === line.influencerId}
                  onClick={() => decide(line.influencerId, "approved")}
                  className="gap-1.5"
                >
                  <Check className="size-4" aria-hidden />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant={line.decision === "rejected" ? "danger" : "secondary"}
                  loading={busy === line.influencerId}
                  onClick={() => decide(line.influencerId, "rejected")}
                  className="gap-1.5"
                >
                  <X className="size-4" aria-hidden />
                  Reject
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

function StatusBadge({ decision }: { decision: ProposalDecision }) {
  return (
    <Badge
      tone={decision === "approved" ? "positive" : decision === "rejected" ? "critical" : "neutral"}
    >
      {DECISION_LABEL[decision]}
    </Badge>
  );
}
