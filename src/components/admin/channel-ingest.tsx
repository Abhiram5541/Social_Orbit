"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Textarea } from "@/components/ui/field";
import { ErrorState, Notice } from "@/components/ui/states";

/**
 * Ingests real YouTube channels into the influencer database.
 *
 * Deliberately an explicit operator action rather than something a page render
 * triggers: each channel spends shared daily API quota, and a page that
 * silently burns quota on every visit is a page that stops working by
 * lunchtime.
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

export function ChannelIngest({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  const [channels, setChannels] = React.useState("");
  const [state, setState] = React.useState<State>({ status: "idle" });

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!channels.trim()) return;
    setState({ status: "loading" });

    try {
      const response = await fetch("/api/internal/connectors/youtube/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channels, videos: 50 }),
      });
      const body = await response.json();
      if (!response.ok) {
        setState({ status: "error", message: body?.error?.message ?? "Ingestion failed." });
        return;
      }
      setState({ status: "done", ...body });
      // The counts and queues on this page are server-rendered from the store
      // this write just changed.
      router.refresh();
    } catch {
      setState({ status: "error", message: "The ingestion request could not be sent." });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ingest real channels — YouTube</CardTitle>
        <span className="font-num text-[12px] text-ink-muted">spends API quota</span>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={submit} className="space-y-3">
          <Field
            label="Channels"
            hint="One per line — channel id, @handle or youtube.com URL. Up to 10 at a time."
          >
            <Textarea
              value={channels}
              onChange={(event) => setChannels(event.target.value)}
              placeholder={"@mkbhd\n@veritasium\nhttps://www.youtube.com/@kurzgesagt"}
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
          <p className="text-[13px] text-ink-muted">
            <code className="font-num text-[12px]">YOUTUBE_API_KEY</code> is not set.
          </p>
        )}

        {state.status === "error" && (
          <ErrorState title="Ingestion failed" description={state.message} />
        )}

        {state.status === "done" && (
          <div className="space-y-3">
            <Notice tone="info" title={`${state.ingested} of ${state.results.length} channels ingested`}>
              {state.quotaUnitsSpent} quota units spent. Each creator carries observed
              statistics only — no demographics, no audience-quality signals and no AI
              classification, because an API key cannot reach any of those. Their health
              scores are computed from the components that could be measured, and their
              confidence scores are correspondingly lower.
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
                  <span className="font-num text-[12px] text-ink-muted">{result.input}</span>
                  <span className="min-w-0 flex-1 text-[13px] text-ink">
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
