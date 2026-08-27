import type { Metadata } from "next";
import Link from "next/link";
import { Activity, BadgeCheck, Blocks, Database, Sparkles, TriangleAlert } from "lucide-react";
import { PLATFORM_LABEL } from "@/lib/contracts/common";
import { formatCompact, formatRelativeTime } from "@/lib/format";
import { requirePageSession } from "@/server/auth/rbac";
import { can } from "@/server/auth/rbac";
import {
  aiProviderStatuses,
  auditLog,
  conflictQueue,
  connectorStatuses,
  databaseStats,
  lowConfidenceQueue,
  reauthQueue,
  verificationQueue,
} from "@/server/repositories/ops-repository";
import { PageBody, PageHeader } from "@/components/shell/app-shell";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, Eyebrow } from "@/components/ui/card";
import { Notice } from "@/components/ui/states";
import { StatRow, StatTile } from "@/components/intelligence/stat";
import { ConnectorGrid } from "@/components/admin/connector-grid";
import { QueueList } from "@/components/admin/queue-list";

export const metadata: Metadata = { title: "Platform overview" };
export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  const user = await requirePageSession("/admin");
  const stats = databaseStats();
  const connectors = connectorStatuses();
  const providers = aiProviderStatuses();

  const verification = verificationQueue();
  const conflicts = conflictQueue();
  const lowConfidence = lowConfidenceQueue();
  const reauth = reauthQueue();

  const blockedConnectors = connectors.filter(
    (connector) => connector.state === "credentials_missing" || connector.state === "degraded",
  );

  return (
    <>
      <PageHeader
        title={`Good morning, ${user.name.split(" ")[0]}.`}
        description="Database coverage, connector health and the queues that need a human."
      />

      <PageBody className="space-y-5">
        {blockedConnectors.length > 0 && (
          <Notice
            tone="caution"
            icon={Blocks}
            title="Some connectors cannot run"
            action={
              can(user, "admin:connectors") ? (
                <LinkButton href="/admin/connectors" size="sm">
                  Configure
                </LinkButton>
              ) : undefined
            }
          >
            {blockedConnectors
              .map((connector) => `${PLATFORM_LABEL[connector.platform]} is missing ${connector.missing.join(", ")}`)
              .join("; ")}
            . Ingestion for those platforms is paused; existing profiles are served from the
            last successful sync and marked stale.
          </Notice>
        )}

        <StatRow>
          <StatTile label="Influencers" value={formatCompact(stats.totalInfluencers)} footnote={`${stats.published} published`} emphasis />
          <StatTile label="Verified" value={formatCompact(stats.verified)} footnote={`${stats.connectionPending} pending`} />
          <StatTile label="Social accounts" value={formatCompact(stats.totalAccounts)} />
          <StatTile label="Content indexed" value={formatCompact(stats.totalContent)} />
          <StatTile label="Snapshots held" value={formatCompact(stats.totalSnapshots)} footnote="historical, never overwritten" />
          <StatTile label="Stale profiles" value={formatCompact(stats.staleProfiles)} footnote="over 48h since refresh" />
        </StatRow>

        <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Connector health</CardTitle>
              <Link href="/admin/connectors" className="rounded text-[13px] font-medium text-brand-ink hover:underline">
                Configure
              </Link>
            </CardHeader>
            <CardContent>
              <ConnectorGrid connectors={connectors} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>AI providers</CardTitle>
              <Badge tone="inferred">
                <Sparkles className="size-3" aria-hidden />
                Enrichment layer
              </Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              {providers.map((provider) => (
                <div key={provider.id} className="min-w-0 rounded-lg border border-line p-3">
                  {/* Same rule as the connector cards: the badge wraps instead
                      of pushing past the card edge. */}
                  <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
                    <span className="min-w-0 truncate text-[14px] font-semibold text-ink">
                      {provider.label}
                    </span>
                    <Badge tone={provider.configured ? "positive" : "caution"} dot>
                      {provider.configured ? "Configured" : "Not configured"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-[12px] leading-5 text-ink-muted">{provider.role}</p>
                  <p className="mt-1.5 break-all font-num text-[11px] text-ink-subtle">
                    {provider.configured
                      ? (provider.model ?? "default model")
                      : `needs ${provider.requires.join(", ")}`}
                  </p>
                </div>
              ))}
              <p className="text-[12px] text-ink-muted">
                Providers classify and explain. They never produce follower counts,
                engagement, demographics or any figure the platform has not observed.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
          <QueueList
            title="Awaiting verification"
            icon={BadgeCheck}
            items={verification}
            href="/admin/verification"
          />
          <QueueList
            title="OAuth reauthorisation"
            icon={TriangleAlert}
            items={reauth}
            href="/admin/ingestion"
          />
          <QueueList
            title="Source conflicts"
            icon={Database}
            items={conflicts}
            href="/admin/ai"
          />
          <QueueList
            title="Preliminary confidence"
            icon={Activity}
            items={lowConfidence}
            href="/admin/analytics"
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Coverage by category</CardTitle>
            </CardHeader>
            <CardContent>
              <Distribution rows={stats.byCategory.slice(0, 8).map((row) => ({ label: row.category, value: row.count }))} total={stats.totalInfluencers} />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Coverage by market</CardTitle>
            </CardHeader>
            <CardContent>
              <Distribution rows={stats.byCountry.slice(0, 8).map((row) => ({ label: row.country, value: row.count }))} total={stats.totalInfluencers} />
            </CardContent>
          </Card>
        </div>

        {can(user, "admin:audit") && (
          <Card>
            <CardHeader>
              <CardTitle>Recent activity</CardTitle>
              <Link href="/admin/audit" className="rounded text-[13px] font-medium text-brand-ink hover:underline">
                Full audit log
              </Link>
            </CardHeader>
            <ul className="divide-y divide-line">
              {auditLog(6).map((entry) => (
                <li key={entry.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-4 py-2">
                  <span className="font-num text-[12px] text-brand-ink">{entry.action}</span>
                  <span className="text-[13px] text-ink">{entry.detail}</span>
                  <span className="ml-auto text-[12px] text-ink-muted">
                    {entry.actor} · {formatRelativeTime(entry.at)}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </PageBody>
    </>
  );
}

function Distribution({
  rows,
  total,
}: {
  rows: { label: string; value: number }[];
  total: number;
}) {
  const max = Math.max(...rows.map((row) => row.value), 1);
  return (
    <div className="space-y-2">
      {rows.map((row) => (
        <div key={row.label} className="space-y-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-[13px] capitalize text-ink">{row.label}</span>
            <span className="shrink-0 font-num text-[12px] tabular-nums text-ink-muted">
              {row.value} · {((row.value / total) * 100).toFixed(1)}%
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-series-1" style={{ width: `${(row.value / max) * 100}%` }} />
          </div>
        </div>
      ))}
      <Eyebrow className="block pt-1">of {total} indexed creators</Eyebrow>
    </div>
  );
}
