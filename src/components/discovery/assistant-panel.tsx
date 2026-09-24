"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageSquare, Send } from "lucide-react";
import { formatCompact, formatNumber } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/states";

/* ---------------------------------------------------------------------------
 * Ask a question, get an answer over SENSO's own rows.
 *
 * The figures on screen are rendered by this component from the search
 * result. The sentence above them is the model's, and it is shown only when
 * every figure in it was found in those rows — so a reader can take the prose
 * and the table as the same claim.
 * ------------------------------------------------------------------------ */

interface AssistantResult {
  question: string;
  query: Record<string, unknown>;
  criteria: { field: string; value: string; from: string; label: string }[];
  unparsed: string[];
  results: {
    id: string;
    displayName: string;
    primaryHandle: string;
    primaryPlatform: string;
    followers: number | null;
    healthScore: number | null;
    engagementRate: number | null;
    country: string | null;
    categories: string[];
    confidence: number | null;
    reasons: { field: string; detail: string }[];
  }[];
  total: number;
  semantic: boolean;
  matchedTerms: string[];
  answer: string | null;
  highlights: { influencerId: string; why: string }[];
  degraded: "no_ai" | "ai_unavailable" | "ungrounded" | null;
  model: string | null;
}

const DEGRADED_NOTE: Record<NonNullable<AssistantResult["degraded"]>, string> = {
  no_ai: "No AI provider is configured, so this ran on the deterministic grammar alone. The matches below are the real answer — only the written summary is missing.",
  ai_unavailable: "The AI provider could not be reached, so there is no written summary. The matches below were found by the deterministic filters and are unaffected.",
  ungrounded: "The written summary stated a figure that was not in these rows, so it was discarded rather than shown. The matches below are unaffected.",
};

const EXAMPLES = [
  "Who should I work with for a Telugu cooking campaign in Hyderabad?",
  "Find me technology creators in India between 50K and 500K followers with strong health",
  "Which beauty creators have the most engaged audiences?",
];

export function AssistantPanel() {
  const router = useRouter();
  const [text, setText] = React.useState("");
  const [result, setResult] = React.useState<AssistantResult | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function ask(question: string) {
    if (question.trim().length < 2) return;
    setBusy(true);
    setError(null);
    const response = await fetch("/api/internal/assistant", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: question, limit: 10 }),
    }).catch(() => null);
    setBusy(false);
    if (response?.ok) {
      setResult((await response.json()) as AssistantResult);
      setText("");
      router.refresh();
      return;
    }
    const failure = (await response?.json().catch(() => null)) as
      | { error?: { message?: string } }
      | null;
    setError(failure?.error?.message ?? "Could not answer that.");
  }

  const why = new Map(result?.highlights.map((entry) => [entry.influencerId, entry.why]) ?? []);

  return (
    <Card>
      <CardHeader className="flex items-center gap-2">
        <MessageSquare className="size-4 text-brand" aria-hidden />
        <CardTitle>Ask SENSO</CardTitle>
      </CardHeader>

      <div className="space-y-3 px-4 py-3">
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void ask(text);
          }}
        >
          <Input
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Ask about creators in your own words"
            aria-label="Ask about creators"
          />
          <Button type="submit" disabled={busy || text.trim().length < 2}>
            <Send className="size-3.5" aria-hidden />
            {busy ? "Thinking…" : "Ask"}
          </Button>
        </form>

        {!result && (
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((example) => (
              <Button key={example} size="sm" variant="ghost" onClick={() => void ask(example)}>
                {example}
              </Button>
            ))}
          </div>
        )}

        {error && (
          <Notice tone="critical" title="Not answered">
            {error}
          </Notice>
        )}

        {result && (
          <div className="space-y-3">
            {result.answer && (
              <div className="rounded-xl bg-sunken/60 px-4 py-3">
                <p className="text-base text-ink">{result.answer}</p>
                <p className="mt-2 text-sm text-ink-subtle">
                  Written by {result.model ?? "the assistant"} from the rows below. Every figure
                  here was checked against them; the scores and counts are SENSO&rsquo;s own.
                </p>
              </div>
            )}

            {result.degraded && (
              <Notice tone="info" title="Answered without a written summary">
                {DEGRADED_NOTE[result.degraded]}
              </Notice>
            )}

            {result.semantic && (
              <Notice tone="info" title="No creator matched those filters exactly">
                These are the closest by what the creators themselves write — bios, upload
                titles and captions — ranked on the terms{" "}
                <strong>{result.matchedTerms.join(", ")}</strong>. They are a reading of the
                corpus, not a filter match, so treat them as a starting point.
              </Notice>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <span className="label-caps text-ink-subtle">Read as</span>
              {result.criteria.map((criterion) => (
                <Badge key={`${criterion.field}:${criterion.value}`} tone="neutral">
                  {criterion.label}
                </Badge>
              ))}
              {result.criteria.length === 0 && (
                <span className="text-sm text-ink-subtle">no filters — the whole index</span>
              )}
              <span className="font-num ml-auto text-sm text-ink-muted">
                {formatNumber(result.total)} match{result.total === 1 ? "" : "es"}
              </span>
            </div>

            <ul className="divide-y divide-rule">
              {result.results.map((row) => (
                <li key={row.id} className="flex flex-wrap items-center gap-3 py-2.5">
                  <Avatar name={row.displayName} src={null} size="sm" />
                  <div className="min-w-0 flex-1 basis-48">
                    <Link
                      href={`/influencers/${row.id}`}
                      prefetch={false}
                      className="font-medium text-ink hover:text-brand"
                    >
                      {row.displayName}
                    </Link>
                    <p className="text-sm text-ink-muted">
                      @{row.primaryHandle} · {row.categories.join(", ") || "uncategorised"}
                      {row.country && ` · ${row.country}`}
                    </p>
                    {why.get(row.id) && (
                      <p className="mt-0.5 text-sm text-ink-muted">{why.get(row.id)}</p>
                    )}
                    {row.reasons.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {row.reasons.map((reason) => (
                          <span
                            key={`${reason.field}-${reason.detail}`}
                            className="rounded-full bg-brand-softer px-2 py-0.5 text-xs text-ink-muted"
                          >
                            {reason.detail}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="font-num text-sm text-ink">
                    {row.followers === null ? "—" : formatCompact(row.followers)}
                  </span>
                  <span className="font-num text-sm text-ink">
                    {row.healthScore === null ? "—" : Math.round(row.healthScore)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}
