"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Textarea } from "@/components/ui/field";
import { ErrorState, Notice } from "@/components/ui/states";

/**
 * Ingests real X accounts into the influencer database. Sibling to
 * `ChannelIngest` — same explicit-operator-action reasoning (each account
 * spends a rate-limited call), different field names throughout, so kept
 * separate rather than parameterised.
 */

interface Outcome {
  input: string;
  ok: boolean;
  detail: string;
  influencerId?: string;
}

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "done"; results: Outcome[]; ingested: number; quotaUnitsSpent: number };

export function XIngest({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  const [accounts, setAccounts] = React.useState("");
  const [state, setState] = React.useState<State>({ status: "idle" });

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!accounts.trim()) return;
    setState({ status: "loading" });

    try {
      const response = await fetch("/api/internal/connectors/x/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accounts, posts: 50 }),
      });
      const body = await response.json();
      if (!response.ok) {
        setState({ status: "error", message: body?.error?.message ?? "Ingestion failed." });
        return;
      }
      setState({ status: "done", ...body });
      router.refresh();
    } catch {
      setState({ status: "error", message: "The ingestion request could not be sent." });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ingest real accounts — X</CardTitle>
        <span className="font-num text-sm text-ink-muted">spends a rate-limited call</span>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={submit} className="space-y-3">
          <Field
            label="Accounts"
            hint="One per line — @handle, bare handle, or x.com URL. Up to 10 at a time."
          >
            <Textarea
              value={accounts}
              onChange={(event) => setAccounts(event.target.value)}
              placeholder={"@X\n@verified\nhttps://x.com/handle"}
              rows={4}
              spellCheck={false}
              disabled={disabled}
            />
          </Field>
          <Button
            type="submit"
            variant="primary"
            loading={state.status === "loading"}
            disabled={disabled}
          >
            Ingest
          </Button>
        </form>

        {disabled && (
          <p className="text-base text-ink-muted">
            <code className="font-num text-sm">X_API_KEY</code> and{" "}
            <code className="font-num text-sm">X_API_SECRET</code> are not both set.
          </p>
        )}

        {state.status === "error" && (
          <ErrorState title="Ingestion failed" description={state.message} />
        )}

        {state.status === "done" && (
          <div className="space-y-3">
            <Notice tone="info" title={`${state.ingested} of ${state.results.length} accounts ingested`}>
              {state.quotaUnitsSpent} calls spent. Each creator carries observed statistics
              only — no demographics, no audience-quality signals, no comment-quality
              reading and no category classification, because a public-API read cannot
              reach any of those on X. Their health scores are computed from the
              components that could be measured, and their confidence scores are
              correspondingly lower.
            </Notice>
            <ul className="divide-y divide-line rounded-lg border border-line">
              {state.results.map((result) => (
                <li key={result.input} className="flex items-baseline gap-3 px-3 py-2">
                  <span
                    className={`mt-1.5 size-1.5 shrink-0 rounded-full ${
                      result.ok ? "bg-positive" : "bg-critical"
                    }`}
                    aria-hidden
                  />
                  <span className="font-num text-sm text-ink-muted">{result.input}</span>
                  <span className="min-w-0 flex-1 text-base text-ink">
                    {result.influencerId ? (
                      <a
                        href={`/influencers/${result.influencerId}`}
                        className="text-brand-ink underline underline-offset-4"
                      >
                        {result.detail}
                      </a>
                    ) : (
                      result.detail
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
