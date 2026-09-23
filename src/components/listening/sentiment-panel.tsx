"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { MessagesSquare } from "lucide-react";
import { SENTIMENT_LABEL, type SentimentRecord } from "@/lib/contracts/sentiment";
import { formatNumber, formatRelativeTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, Notice } from "@/components/ui/states";

/* ---------------------------------------------------------------------------
 * Audience sentiment for one subject.
 *
 * The sample size sits beside the headline share, because a positive share
 * over forty comments and one over four hundred are different claims and only
 * one of them belongs in a deck.
 * ------------------------------------------------------------------------ */

const TONE: Record<string, "positive" | "neutral" | "critical" | "caution"> = {
  positive: "positive",
  neutral: "neutral",
  negative: "critical",
  spam: "caution",
};

export function SentimentPanel({
  record,
  blocked,
  subject,
  canRun,
}: {
  record: SentimentRecord | null;
  blocked: string | null;
  subject: { kind: "creator" | "campaign"; id: string };
  canRun: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    const response = await fetch("/api/internal/sentiment", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        subject.kind === "campaign" ? { campaignId: subject.id } : { influencerId: subject.id },
      ),
    }).catch(() => null);
    setBusy(false);
    if (!response?.ok) {
      const body = (await response?.json().catch(() => null)) as { error?: { message?: string } } | null;
      setError(body?.error?.message ?? "Could not read comments.");
      return;
    }
    router.refresh();
  }

  return (
    <Card>
      <CardHeader className="flex items-center justify-between gap-3">
        <CardTitle>Audience sentiment</CardTitle>
        {canRun && !blocked && (
          <Button size="sm" variant="secondary" onClick={run} disabled={busy}>
            {busy ? "Reading comments…" : record ? "Read again" : "Read the comments"}
          </Button>
        )}
      </CardHeader>

      {blocked && (
        <CardContent>
          <Notice tone="info" title="Not measured">
            {blocked} Nothing is shown rather than a neutral score — &ldquo;we did not measure
            this&rdquo; and &ldquo;the audience feels nothing&rdquo; are different statements.
          </Notice>
        </CardContent>
      )}

      {error && (
        <CardContent>
          <Notice tone="critical" title="Not read">
            {error}
          </Notice>
        </CardContent>
      )}

      {!record && !blocked && (
        <EmptyState
          icon={MessagesSquare}
          title="No reading yet"
          description="Reads the comments the platform published on recent posts, labels each one, and counts the labels here. It spends platform quota, so it runs when you ask for it."
        />
      )}

      {record && (
        <>
          <div className="grid gap-px bg-rule sm:grid-cols-3">
            <div className="bg-surface px-4 py-3">
              <p className="text-sm text-ink-muted">Positive, of comments with an opinion</p>
              <p className="font-num text-3xl text-ink">
                {record.positiveShare === null ? "—" : `${record.positiveShare}%`}
              </p>
            </div>
            <div className="bg-surface px-4 py-3">
              <p className="text-sm text-ink-muted">Comments read</p>
              <p className="font-num text-3xl text-ink">{formatNumber(record.sampleSize)}</p>
              <p className="text-sm text-ink-subtle">
                across {record.postsSampled} post{record.postsSampled === 1 ? "" : "s"}
              </p>
            </div>
            <div className="bg-surface px-4 py-3">
              <p className="text-sm text-ink-muted">Breakdown</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {(["positive", "neutral", "negative", "spam"] as const).map((label) => (
                  <Badge key={label} tone={TONE[label]}>
                    {SENTIMENT_LABEL[label]} {record.counts[label]}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          {record.topics.length > 0 && (
            <div className="border-t border-line px-4 py-3">
              <p className="label-caps text-ink-subtle">What they talk about</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {record.topics.map((topic) => (
                  <Badge key={topic.topic} tone="neutral">
                    {topic.topic} · {topic.count}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {record.examples.length > 0 && (
            <ul className="divide-y divide-rule border-t border-line">
              {record.examples.map((example, index) => (
                <li key={`${index}-${example.text.slice(0, 12)}`} className="flex gap-3 px-4 py-2.5">
                  <Badge tone={TONE[example.label]}>{SENTIMENT_LABEL[example.label]}</Badge>
                  <p className="min-w-0 flex-1 text-sm text-ink-muted">{example.text}</p>
                </li>
              ))}
            </ul>
          )}

          <CardContent className="border-t border-line">
            <p className="text-sm text-ink-subtle">
              Each comment was labelled individually by {record.model} (prompt{" "}
              {record.promptVersion}, schema {record.schemaVersion}); the counts and the share
              above are arithmetic over those labels, not figures the model reported. Read{" "}
              {formatRelativeTime(record.generatedAt)}. Comments are not the audience — they
              skew toward the people who comment.
            </p>
          </CardContent>
        </>
      )}
    </Card>
  );
}
