"use client";

import * as React from "react";
import type { ConnectorProbeResult } from "@/lib/contracts/connector";
import {
  formatCompact,
  formatDuration,
  formatFrequency,
  formatNumber,
  formatPercent,
  formatRelativeTime,
} from "@/lib/format";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";
import { ErrorState } from "@/components/ui/states";

/**
 * Live connector self-test.
 *
 * Reads one real channel through the YouTube Data API and shows both halves of
 * the pipeline: what the platform reported, and what the deterministic
 * analytics engine derived from it. The two are labelled separately on purpose
 * — an operator checking a connector needs to see which numbers came off the
 * wire and which SocialOrbit computed.
 *
 * It spends real daily quota, so it runs on submit and never on render.
 */

const ACTIVITY: Record<ConnectorProbeResult["derived"]["activityStatus"], BadgeTone> = {
  active: "positive",
  recently_active: "neutral",
  slowing: "caution",
  dormant: "critical",
};

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; result: ConnectorProbeResult };

export function ConnectorProbe({ disabled }: { disabled?: boolean }) {
  const [channel, setChannel] = React.useState("@mkbhd");
  const [state, setState] = React.useState<State>({ status: "idle" });

  async function run(event: React.FormEvent) {
    event.preventDefault();
    if (!channel.trim()) return;
    setState({ status: "loading" });

    try {
      const response = await fetch(
        `/api/internal/connectors/youtube/probe?channel=${encodeURIComponent(channel)}&videos=25`,
      );
      const body = await response.json();
      if (!response.ok) {
        setState({ status: "error", message: body?.error?.message ?? "The probe failed." });
        return;
      }
      setState({ status: "ready", result: body as ConnectorProbeResult });
    } catch {
      setState({ status: "error", message: "The probe request could not be sent." });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Live probe — YouTube</CardTitle>
        <span className="font-num text-[12px] text-ink-muted">spends API quota</span>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={run} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field
            label="Channel"
            hint="Channel id, @handle, or a youtube.com URL."
            className="flex-1"
          >
            <Input
              value={channel}
              onChange={(event) => setChannel(event.target.value)}
              placeholder="@mkbhd"
              autoComplete="off"
              spellCheck={false}
              disabled={disabled}
            />
          </Field>
          <Button
            type="submit"
            variant="primary"
            loading={state.status === "loading"}
            disabled={disabled}
            className="sm:mb-[26px]"
          >
            Run probe
          </Button>
        </form>

        {disabled && (
          <p className="text-[13px] text-ink-muted">
            <code className="font-num text-[12px]">YOUTUBE_API_KEY</code> is not set, so there is
            nothing to probe.
          </p>
        )}

        {state.status === "error" && (
          <ErrorState title="Probe failed" description={state.message} />
        )}

        {state.status === "ready" && <ProbeReadout result={state.result} />}
      </CardContent>
    </Card>
  );
}

function ProbeReadout({ result }: { result: ConnectorProbeResult }) {
  const { channel, derived, provenance } = result;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <a
          href={channel.url}
          target="_blank"
          rel="noreferrer noopener"
          className="text-[14px] font-semibold text-brand-ink underline underline-offset-4"
        >
          {channel.title}
        </a>
        <Badge tone="neutral">{channel.handle ?? channel.channelId}</Badge>
        <Badge tone={ACTIVITY[derived.activityStatus]} dot>
          {derived.activityStatus.replace("_", " ")}
        </Badge>
      </div>

      <Section
        title="Observed"
        note={`Platform API · read ${formatRelativeTime(provenance.collectedAt)} · ${result.sampleSize} recent uploads · ${result.quotaUnitsSpent} quota units`}
      >
        <Metric
          label="Subscribers"
          value={
            channel.subscribersHidden ? "Hidden by creator" : formatCompact(channel.subscribers)
          }
        />
        <Metric label="Total views" value={formatCompact(channel.totalViews)} />
        <Metric label="Videos" value={formatNumber(channel.videoCount)} />
        <Metric label="Country" value={channel.country ?? "Not reported"} />
      </Section>

      <Section
        title="Derived"
        note={`Computed by the analytics engine v${derived.analyticsVersion} from the observations above. Never read from the platform.`}
      >
        <Metric label="Median views" value={formatCompact(derived.medianViews)} />
        <Metric
          label="Engagement rate"
          value={formatPercent(derived.engagementRate)}
          hint="interactions ÷ views"
        />
        <Metric label="Views per subscriber" value={formatPercent(derived.viewsPerFollower)} />
        <Metric label="Upload cadence" value={formatFrequency(derived.uploadsPerWeek)} />
        <Metric
          label="Upload consistency"
          value={derived.uploadConsistency === null ? "—" : `${Math.round(derived.uploadConsistency)}/100`}
        />
        <Metric
          label="View consistency"
          value={derived.viewConsistency === null ? "—" : `${Math.round(derived.viewConsistency)}/100`}
        />
      </Section>

      <details className="rounded-lg border border-line">
        <summary className="cursor-pointer px-3 py-2 text-[13px] font-medium text-ink">
          Recent uploads ({result.recentContent.length})
        </summary>
        <ul className="divide-y divide-line border-t border-line">
          {result.recentContent.slice(0, 10).map((item) => (
            <li key={item.id} className="flex items-baseline justify-between gap-3 px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{item.title}</span>
              <span className="font-num tabular-nums text-[12px] text-ink-muted">
                {formatCompact(item.views)} views · {formatDuration(item.durationSeconds)}
              </span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="label-caps text-[10px] text-ink-muted">{title}</p>
      <p className="mt-0.5 text-[12px] leading-4 text-ink-muted">{note}</p>
      <dl className="mt-2 grid gap-x-4 gap-y-2 sm:grid-cols-2 xl:grid-cols-3">{children}</dl>
    </div>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-line pb-1.5">
      <dt className="text-[12px] text-ink-muted">
        {label}
        {hint && <span className="ml-1 text-ink-subtle">({hint})</span>}
      </dt>
      <dd className="font-num tabular-nums text-[13px] text-ink">{value}</dd>
    </div>
  );
}
