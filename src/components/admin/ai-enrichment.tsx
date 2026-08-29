"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { ErrorState, Notice } from "@/components/ui/states";

/**
 * Runs AI classification over stored creators.
 *
 * An explicit operator action, in batches: each creator costs a model call and
 * a few comment reads, so a page that enriched on render would spend tokens
 * every time someone opened it.
 */

interface Outcome {
  influencerId: string;
  displayName: string;
  ok: boolean;
  detail: string;
  commentsRead?: number;
}

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "done"; enriched: number; results: Outcome[]; totalTokens: number; stoppedEarly: string | null };

export function AiEnrichment({ disabled, pending }: { disabled?: boolean; pending: number }) {
  const router = useRouter();
  const [limit, setLimit] = React.useState("25");
  const [state, setState] = React.useState<State>({ status: "idle" });

  async function run(event: React.FormEvent) {
    event.preventDefault();
    setState({ status: "loading" });

    try {
      const response = await fetch("/api/internal/ai/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: Number(limit) || 25 }),
      });
      const body = await response.json();
      if (!response.ok) {
        setState({ status: "error", message: body?.error?.message ?? "Enrichment failed." });
        return;
      }
      setState({ status: "done", ...body });
      router.refresh();
    } catch {
      setState({ status: "error", message: "The enrichment request could not be sent." });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Run enrichment</CardTitle>
        <span className="font-num text-[12px] text-ink-muted">spends OpenAI tokens</span>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-[13px] leading-5 text-ink-muted">
          Classifies category, creator type, commercial intent, brand safety and comment
          quality from stored observations and real comments read from the platform. Comment
          quality and brand safety are two of the nine health components — until this runs
          they are unmeasurable and the engine renormalises without them. It never produces
          a follower count, an engagement figure or an audience breakdown.
        </p>

        <form onSubmit={run} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field
            label="Creators per run"
            hint={`${pending} still unclassified. Runs in id order, skipping those already done.`}
            className="sm:w-56"
          >
            <Input
              type="number"
              min={1}
              max={100}
              value={limit}
              onChange={(event) => setLimit(event.target.value)}
              disabled={disabled}
            />
          </Field>
          <Button
            type="submit"
            variant="primary"
            loading={state.status === "loading"}
            disabled={disabled || pending === 0}
            className="sm:mb-[26px]"
          >
            Enrich
          </Button>
        </form>

        {disabled && (
          <p className="text-[13px] text-ink-muted">
            <code className="font-num text-[12px]">OPENAI_API_KEY</code> is not set, so
            enrichment cannot run.
          </p>
        )}

        {state.status === "error" && (
          <ErrorState title="Enrichment failed" description={state.message} />
        )}

        {state.status === "done" && (
          <div className="space-y-3">
            <Notice
              tone={state.stoppedEarly ? "caution" : "info"}
              title={`${state.enriched} creators classified`}
            >
              {state.totalTokens.toLocaleString()} tokens spent.
              {state.stoppedEarly ? ` Stopped early: ${state.stoppedEarly}` : ""}
            </Notice>
            <ul className="divide-y divide-line rounded-lg border border-line">
              {state.results.map((result) => (
                <li key={result.influencerId} className="flex items-baseline gap-3 px-3 py-2">
                  <span
                    className={`mt-1.5 size-1.5 shrink-0 rounded-full ${
                      result.ok ? "bg-positive" : "bg-critical"
                    }`}
                    aria-hidden
                  />
                  <a
                    href={`/influencers/${result.influencerId}`}
                    className="shrink-0 text-[13px] text-brand-ink underline underline-offset-4"
                  >
                    {result.displayName}
                  </a>
                  <span className="min-w-0 flex-1 text-[13px] text-ink-muted">
                    {result.detail}
                  </span>
                  {result.commentsRead !== undefined && (
                    <span className="shrink-0 font-num text-[11px] text-ink-subtle">
                      {result.commentsRead} comments
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
