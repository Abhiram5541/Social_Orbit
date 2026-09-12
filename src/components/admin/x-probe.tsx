"use client";

import * as React from "react";
import type { XConnectorProbeResult } from "@/lib/contracts/connector";
import {
  formatCompact,
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
 * Live connector self-test for X — the same shape as `ConnectorProbe`, over
 * X's account and post fields. Kept as a sibling rather than a generalised
 * component: the two platforms' probe results share no field names
 * (`subscribers` vs `followers`, `channelId` vs `userId`, view-based vs
 * follower-based engagement), so a shared component would need a translation
 * layer bigger than this file.
 */

const ACTIVITY: Record<XConnectorProbeResult["derived"]["activityStatus"], BadgeTone> = {
  active: "positive",
  recently_active: "neutral",
  slowing: "caution",
  dormant: "critical",
};

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; result: XConnectorProbeResult };

export function XProbe({ disabled }: { disabled?: boolean }) {
  const [account, setAccount] = React.useState("@X");
  const [state, setState] = React.useState<State>({ status: "idle" });

  async function run(event: React.FormEvent) {
    event.preventDefault();
    if (!account.trim()) return;
    setState({ status: "loading" });

    try {
      const response = await fetch(
        `/api/internal/connectors/x/probe?account=${encodeURIComponent(account)}&posts=25`,
      );
      const body = await response.json();
      if (!response.ok) {
        setState({ status: "error", message: body?.error?.message ?? "The probe failed." });
        return;
      }
      setState({ status: "ready", result: body as XConnectorProbeResult });
    } catch {
      setState({ status: "error", message: "The probe request could not be sent." });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Live probe — X</CardTitle>
        <span className="font-num text-sm text-ink-muted">spends a rate-limited call</span>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={run}>
          <Field label="Account" hint="@handle, bare handle, or an x.com URL." inline>
            <Input
              value={account}
              onChange={(event) => setAccount(event.target.value)}
              placeholder="@X"
              autoComplete="off"
              spellCheck={false}
              disabled={disabled}
            />
            <Button
              type="submit"
              variant="primary"
              loading={state.status === "loading"}
              disabled={disabled}
            >
              Run probe
            </Button>
          </Field>
        </form>

        {disabled && (
          <p className="text-base text-ink-muted">
            <code className="font-num text-sm">X_API_KEY</code> and{" "}
            <code className="font-num text-sm">X_API_SECRET</code> are not both set, so there is
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

function ProbeReadout({ result }: { result: XConnectorProbeResult }) {
  const { account, derived, provenance } = result;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <a
          href={account.url}
          target="_blank"
          rel="noreferrer noopener"
          className="font-semibold text-brand-ink underline underline-offset-4"
        >
          {account.name}
        </a>
        <Badge tone="neutral">@{account.username}</Badge>
        {account.xVerifiedBadge && (
          <Badge tone="neutral" title="X's own badge — not SocialOrbit Verified">
            X badge
          </Badge>
        )}
        <Badge tone={ACTIVITY[derived.activityStatus]} dot>
          {derived.activityStatus.replace("_", " ")}
        </Badge>
      </div>

      <Section
        title="Observed"
        note={`Platform API · read ${formatRelativeTime(provenance.collectedAt)} · ${result.sampleSize} recent posts · ${result.quotaUnitsSpent} calls`}
      >
        <Metric label="Followers" value={formatCompact(account.followers)} />
        <Metric label="Following" value={formatCompact(account.following)} />
        <Metric label="Posts" value={formatNumber(account.postCount)} />
        <Metric label="Listed" value={formatCompact(account.listedCount)} />
      </Section>

      <Section
        title="Derived"
        note={`Computed by the analytics engine v${derived.analyticsVersion} from the observations above. Never read from the platform.`}
      >
        <Metric label="Median engagement" value={formatCompact(derived.medianEngagement)} />
        <Metric
          label="Engagement rate"
          value={formatPercent(derived.engagementRate)}
          hint="interactions ÷ followers"
        />
        <Metric label="Post cadence" value={formatFrequency(derived.postsPerWeek)} />
        <Metric
          label="Upload consistency"
          value={derived.uploadConsistency === null ? "—" : `${Math.round(derived.uploadConsistency)}/100`}
        />
      </Section>

      <details className="rounded-lg border border-line">
        <summary className="cursor-pointer px-3 py-2 text-base font-medium text-ink transition-colors hover:bg-sunken">
          Recent posts ({result.recentContent.length})
        </summary>
        <ul className="divide-y divide-line border-t border-line">
          {result.recentContent.slice(0, 10).map((item) => (
            <li key={item.id} className="flex items-baseline justify-between gap-3 px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-base text-ink">{item.title}</span>
              <span className="font-num text-sm text-ink-muted">
                {formatCompact(item.likes)} likes · {formatCompact(item.shares)} retweets
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
      <p className="label-caps-sm text-ink-muted">{title}</p>
      <p className="mt-0.5 text-sm leading-4 text-ink-muted">{note}</p>
      <dl className="mt-2 grid gap-x-4 gap-y-2 sm:grid-cols-2 xl:grid-cols-3">{children}</dl>
    </div>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-line pb-1.5">
      <dt className="text-sm text-ink-muted">
        {label}
        {hint && <span className="ml-1 text-ink-subtle">({hint})</span>}
      </dt>
      <dd className="font-num text-base text-ink">{value}</dd>
    </div>
  );
}
