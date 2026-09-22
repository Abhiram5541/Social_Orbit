"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Sparkles, ArrowRight } from "lucide-react";
import type { SearchQuery } from "@/lib/contracts/search";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/states";

interface AskResult {
  query: SearchQuery;
  criteria: { field: string; value: string; from: string; label: string }[];
  unparsed: string[];
}

const EXAMPLES = [
  "Find 20 technology creators in India with 50K–500K followers and strong engagement",
  "verified beauty creators on instagram sorted by engagement",
  "high quality food creators over 1 lakh followers",
];

/**
 * Ask in a sentence, see exactly what it became, then run it.
 *
 * The parsed criteria are shown before the search runs — on a metered plan
 * a query that quietly became different filters would spend an allowance on
 * the wrong question.
 */
export function AskPanel() {
  const router = useRouter();
  const [text, setText] = React.useState("");
  const [result, setResult] = React.useState<AskResult | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function ask(instruction: string, refine: boolean) {
    if (instruction.trim().length < 2) return;
    setBusy(true);
    setError(null);
    const response = await fetch("/api/internal/ask", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: instruction,
        previous: refine && result ? result.query : undefined,
      }),
    }).catch(() => null);
    setBusy(false);
    if (response?.ok) {
      setResult((await response.json()) as AskResult);
      setText("");
      return;
    }
    const failure = (await response?.json().catch(() => null)) as
      | { error?: { message?: string } }
      | null;
    setError(failure?.error?.message ?? "Could not read that. Try rephrasing.");
  }

  function run() {
    if (!result) return;
    const params = new URLSearchParams(
      Object.entries(result.query as unknown as Record<string, string>).filter(
        ([, value]) => value !== undefined && value !== "",
      ),
    );
    router.push(`/discovery?${params.toString()}`);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ask SENSO</CardTitle>
        <span className="text-sm text-ink-muted">
          Your words become filters you can check before they run
        </span>
      </CardHeader>

      <div className="space-y-3 px-4 py-4">
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            void ask(text, result !== null);
          }}
        >
          <Input
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={
              result
                ? "Refine — “under 1 lakh”, “remove beauty”, “show 10 more”"
                : "Find 20 technology creators in India with 50K–500K followers"
            }
            className="min-w-56 flex-1"
            aria-label="Ask SENSO"
          />
          <Button type="submit" variant="primary" loading={busy} className="gap-1.5">
            <Sparkles className="size-4" aria-hidden />
            {result ? "Refine" : "Ask"}
          </Button>
        </form>

        {error && <Notice tone="critical">{error}</Notice>}

        {!result && (
          <div className="flex flex-wrap gap-2">
            {EXAMPLES.map((example) => (
              <button
                key={example}
                type="button"
                className="press rounded-full bg-sunken px-3 py-1.5 text-left text-sm text-ink-muted hover:text-ink"
                onClick={() => void ask(example, false)}
              >
                {example}
              </button>
            ))}
          </div>
        )}

        {result && (
          <div className="space-y-3">
            <div>
              <p className="label-caps-sm mb-1.5 text-ink-subtle">Understood as</p>
              {result.criteria.length === 0 ? (
                <p className="text-sm text-ink-muted">
                  Nothing recognised. Try naming a category, a country, an audience size or
                  an engagement threshold.
                </p>
              ) : (
                <ul className="flex flex-wrap gap-1.5">
                  {result.criteria.map((criterion) => (
                    <li key={`${criterion.field}:${criterion.value}`}>
                      <Badge tone="brand">
                        {criterion.label}
                        <span className="ml-1 font-normal opacity-70">“{criterion.from}”</span>
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {result.unparsed.length > 0 && (
              <p className="text-sm text-ink-muted">
                Matched as keywords, because no filter covers them:{" "}
                <span className="font-num text-ink">{result.unparsed.join(", ")}</span>. Place
                names are matched this way — SENSO records a city as a mention, never as a
                location.
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="primary" onClick={run} className="gap-1.5">
                Run this search
                <ArrowRight className="size-4" aria-hidden />
              </Button>
              <Button variant="ghost" onClick={() => setResult(null)}>
                Start over
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
