import type { Metadata } from "next";
import Link from "next/link";
import { Blocks } from "lucide-react";
import { CATEGORY_LABEL, PLATFORM_LABEL } from "@/lib/contracts/common";
import { formatCompact, formatRelativeTime, plural, pluralise } from "@/lib/format";
import { median } from "@/server/analytics/metrics";
import { allSummaries } from "@/server/repositories/influencer-repository";
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
import { PageBand, PageBody, PageHeader } from "@/components/shell/app-shell";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import {
  Instrument,
  Panel,
  PanelBody,
  PanelFoot,
  PanelHead,
  PanelTitle,
  RowList,
  Split,
} from "@/components/ui/panel";
import { Notice } from "@/components/ui/states";
import { DistributionRows } from "@/components/charts/distribution-bars";
import { STATE } from "@/components/admin/status-language";
import { FeedFooterLink, Insight, InsightFeed } from "@/components/intelligence/insight";
import { HeroSignal, Metric, MetricStrip } from "@/components/intelligence/signal";

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
    (connector) =>
      connector.state === "credentials_missing" || connector.state === "degraded",
  );
  const liveConnectors = connectors.filter((connector) => connector.state === "live");
  const needsHuman =
    verification.length + conflicts.length + lowConfidence.length + reauth.length;

  /*
   * The pipeline, stage by stage. This is the platform's own health reading:
   * a record only becomes decision-grade after it has been discovered,
   * enriched, scored and — where the creator opted in — verified. Showing the
   * stages as a funnel says where the database actually is, which a count of
   * rows never could.
   */
  const pipeline = [
    { label: "Indexed", value: stats.totalInfluencers, tone: "neutral" as const },
    { label: "Published", value: stats.published, tone: "neutral" as const },
    {
      label: "Scored",
      value: stats.totalInfluencers - stats.lowConfidenceProfiles,
      tone: "brand" as const,
    },
    { label: "Identity verified", value: stats.verified, tone: "positive" as const },
  ];

  /*
   * Median data confidence, not "share published".
   *
   * Published-over-indexed is 100% by construction — a record is published as
   * soon as it is ingested — so it was a headline that could never move. The
   * platform's own quality reading is confidence: completeness, historical
   * depth and source authority, less staleness and conflicts. That is the
   * number an operator is actually accountable for.
   */
  const medianConfidence = median(allSummaries().map((summary) => summary.confidence));

  // One prioritised feed rather than four identical boxes. Severity order is
  // the operator's actual order of work: a contradiction is a wrong number, a
  // dead token stops collection, and thin confidence is only unproven.
  const attention = [
    conflicts.length > 0 && {
      id: "conflicts",
      kind: "critical" as const,
      headline: `${conflicts.length} ${plural(conflicts.length, "profile")} ${conflicts.length === 1 ? "has" : "have"} sources that disagree`,
      evidence:
        "Confidence stays reduced until a reviewer resolves them. SENSO never silently picks a winner.",
      href: "/admin/anomalies",
      actionLabel: "Resolve",
    },
    reauth.length > 0 && {
      id: "reauth",
      kind: "critical" as const,
      headline: `${reauth.length} connected ${plural(reauth.length, "account")} need${reauth.length === 1 ? "s" : ""} reauthorisation`,
      evidence:
        "The stored token no longer works. First-party analytics stop refreshing until the creator re-consents.",
      href: "/admin/ingestion",
      actionLabel: "Open",
    },
    blockedConnectors.length > 0 && {
      id: "connectors",
      kind: "caution" as const,
      headline: `${blockedConnectors.length} ${plural(blockedConnectors.length, "connector")} cannot run`,
      evidence: blockedConnectors
        .map(
          (connector) =>
            `${PLATFORM_LABEL[connector.platform]} is missing ${connector.missing.join(", ")}`,
        )
        .join("; "),
      href: "/admin/connectors",
      actionLabel: "Configure",
    },
    verification.length > 0 && {
      id: "verification",
      kind: "caution" as const,
      headline: `${verification.length} ${plural(verification.length, "creator")} awaiting identity match`,
      evidence:
        "OAuth consent completed. Verified status is issued only after the connected identity matches the claimed profile.",
      href: "/admin/verification",
      actionLabel: "Review",
    },
    stats.staleProfiles > 0 && {
      id: "stale",
      kind: "neutral" as const,
      headline: `${stats.staleProfiles} ${plural(stats.staleProfiles, "profile")} past the refresh window`,
      evidence:
        "Served from the last successful sync and labelled stale wherever they appear.",
      href: "/admin/ingestion",
      actionLabel: "Ingestion",
    },
    lowConfidence.length > 0 && {
      id: "confidence",
      kind: "neutral" as const,
      headline: `${lowConfidence.length} ${plural(lowConfidence.length, "profile")} below the publish confidence threshold`,
      evidence:
        "Not enough history, completeness or source authority to publish these numbers without a warning.",
      href: "/admin/anomalies",
      actionLabel: "Investigate",
    },
  ].filter((item): item is Exclude<typeof item, false> => Boolean(item));

  return (
    <>
      <PageHeader
        eyebrow="SENSO platform"
        title="Platform overview"
        description="Database coverage, connector health and the queues that need a human."
        actions={
          blockedConnectors.length > 0 && can(user, "admin:connectors") ? (
            <LinkButton href="/admin/connectors" className="gap-2">
              <Blocks className="size-4" aria-hidden />
              Configure connectors
            </LinkButton>
          ) : undefined
        }
      />

      <Instrument className="py-8">
        <HeroSignal tone="instrument"
          eyebrow="Database confidence · median across every indexed profile"
          value={medianConfidence}
          display={
            medianConfidence === null ? undefined : medianConfidence.toFixed(1)
          }
          suffix="%"
          band={needsHuman > 0 ? `${pluralise(needsHuman, "item")} need a human` : "Queues clear"}
          bandTone={needsHuman > 0 ? "caution" : "positive"}
          explanation={
            <>
              <span className="font-num font-semibold text-instrument-ink">
                {formatCompact(stats.totalInfluencers)}
              </span>{" "}
              creators are indexed from{" "}
              <span className="font-num font-semibold text-instrument-ink">{liveConnectors.length}</span> live{" "}
              {plural(liveConnectors.length, "adapter")}, holding{" "}
              <span className="font-num font-semibold text-instrument-ink">
                {formatCompact(stats.totalContent)}
              </span>{" "}
              indexed items and{" "}
              <span className="font-num font-semibold text-instrument-ink">
                {formatCompact(stats.totalSnapshots)}
              </span>{" "}
              historical snapshots that are never overwritten. Confidence is capped for an
              unconnected creator: identity verification and first-party analytics are
              creator-initiated, so the funnel below narrows on consent rather than on loss.
            </>
          }
          aside={
            <div>
              <p className="label-caps-sm mb-2 text-instrument-muted">Pipeline stages</p>
              <DistributionRows
                onInstrument
                rows={pipeline.map((stage) => ({
                  label: stage.label,
                  value: stage.value,
                  tone: stage.tone,
                }))}
                total={stats.totalInfluencers}
                showZero
              />
            </div>
          }
        />
      </Instrument>

      <PageBand inset={false}>
        <MetricStrip>
          <Metric
            label="Creators indexed"
            value={formatCompact(stats.totalInfluencers)}
            tone="lead"
            footnote={`${stats.published} published`}
          />
          <Metric
            label="Social accounts"
            value={formatCompact(stats.totalAccounts)}
            footnote="resolved and tracked"
          />
          <Metric
            label="Content indexed"
            value={formatCompact(stats.totalContent)}
            footnote="items read from platforms"
          />
          <Metric
            label="Snapshots held"
            value={formatCompact(stats.totalSnapshots)}
            footnote="historical, never overwritten"
          />
          <Metric
            label="Identity verified"
            value={formatCompact(stats.verified)}
            tone={stats.verified === 0 ? "muted" : "default"}
            footnote={`${stats.connectionPending} pending`}
          />
          <Metric
            label="Stale profiles"
            value={formatCompact(stats.staleProfiles)}
            footnote="over 48h since refresh"
          />
        </MetricStrip>
      </PageBand>

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
            Ingestion for those platforms is paused; existing profiles are served from the
            last successful sync and marked stale.
          </Notice>
        )}

        <Split cols="lead" className="overflow-hidden rounded-xl bg-surface card-shadow">
          <div className="min-w-0">
            <PanelHead>
              <PanelTitle>What needs a human</PanelTitle>
              <span className="text-sm text-ink-muted">
                {needsHuman > 0
                  ? `${pluralise(needsHuman, "item")} across every queue`
                  : "Every queue is clear"}
              </span>
            </PanelHead>
            {attention.length === 0 ? (
              <PanelBody className="py-8">
                <p className="text-base font-medium text-ink">Nothing is waiting</p>
                <p className="mt-1 max-w-md text-sm text-ink-muted">
                  No source conflicts, no expired tokens, no connector blocked on
                  credentials, and no profile past its refresh window.
                </p>
              </PanelBody>
            ) : (
              <>
                <InsightFeed>
                  {attention.map((item) => (
                    <Insight
                      key={item.id}
                      kind={item.kind}
                      headline={item.headline}
                      evidence={item.evidence}
                      href={item.href}
                      actionLabel={item.actionLabel}
                    />
                  ))}
                </InsightFeed>
                <FeedFooterLink href="/admin/anomalies">
                  Open the anomaly workspace
                </FeedFooterLink>
              </>
            )}
          </div>

          <div className="flex min-w-0 flex-col">
            <PanelHead>
              <PanelTitle as="h3">AI providers</PanelTitle>
              <span className="font-num text-sm text-ink-muted">
                {providers.filter((provider) => provider.configured).length}/
                {providers.length}
              </span>
            </PanelHead>
            <RowList>
              {providers.map((provider) => (
                <li key={provider.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
                    <span className="min-w-0 truncate text-base font-semibold text-ink">
                      {provider.label}
                    </span>
                    <Badge tone={provider.configured ? "positive" : "caution"} dot>
                      {provider.configured ? "Configured" : "Not configured"}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-sm leading-5 text-ink-muted">{provider.role}</p>
                  <p className="mt-1 break-all font-num text-xs text-ink-subtle">
                    {provider.configured
                      ? (provider.model ?? "default model")
                      : `needs ${provider.requires.join(", ")}`}
                  </p>
                </li>
              ))}
            </RowList>
            <PanelFoot className="mt-auto">
              Providers classify and explain. They never produce follower counts,
              engagement, demographics or any figure the platform has not observed.
            </PanelFoot>
          </div>
        </Split>

        <Panel>
          <PanelHead>
            <PanelTitle>Connector health</PanelTitle>
            <Link
              href="/admin/connectors"
              className="rounded text-sm font-medium text-brand-ink hover:underline"
            >
              Configure
            </Link>
          </PanelHead>
          <RowList>
            {connectors.map((connector) => {
              const state = STATE[connector.state];
              return (
                <li
                  key={connector.platform}
                  data-connector={connector.platform}
                  // A fixed row rhythm. Different status words render a
                  // fraction of a pixel apart, and a status list whose rows
                  // are each a hair taller than the last is the small kind of
                  // wrongness that reads as unfinished.
                  className="flex min-h-14 flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5"
                >
                  <span className="flex min-w-40 flex-1 items-center gap-2.5">
                    <span className="text-base font-semibold text-ink">
                      {PLATFORM_LABEL[connector.platform]}
                    </span>
                    <Badge tone={state.tone} dot>
                      {state.label}
                    </Badge>
                  </span>
                  <dl className="grid grid-cols-3 gap-x-6 gap-y-1 sm:w-[24rem] sm:shrink-0 sm:text-right">
                    <div>
                      <dt className="label-caps-sm text-ink-subtle">Accounts</dt>
                      <dd className="font-num text-base text-ink">
                        {formatCompact(connector.accountsTracked)}
                      </dd>
                    </div>
                    <div>
                      <dt className="label-caps-sm text-ink-subtle">Last sync</dt>
                      <dd className="text-base text-ink">
                        {connector.lastSuccessfulSync
                          ? formatRelativeTime(connector.lastSuccessfulSync)
                          : "never"}
                      </dd>
                    </div>
                    <div>
                      <dt className="label-caps-sm text-ink-subtle">Credentials</dt>
                      <dd
                        className={
                          connector.missing.length === 0
                            ? "text-base text-positive"
                            : "text-base text-caution"
                        }
                      >
                        {connector.missing.length === 0
                          ? "complete"
                          : `${connector.missing.length} missing`}
                      </dd>
                    </div>
                  </dl>
                </li>
              );
            })}
          </RowList>
          <PanelFoot>
            The detail behind each adapter — what it reads, what it needs and why it is
            blocked — is on the connectors page.
          </PanelFoot>
        </Panel>

        <Split cols="even" className="overflow-hidden rounded-xl bg-surface card-shadow">
          <div className="min-w-0">
            <PanelHead>
              <PanelTitle as="h3">Coverage by category</PanelTitle>
              <span className="text-sm text-ink-muted">top 8</span>
            </PanelHead>
            <PanelBody>
              <DistributionRows
                rows={stats.byCategory.slice(0, 8).map((row) => ({
                  // A creator whose platform topics map to no category (D14)
                  // is a real group too, and it was rendering as an unkeyed
                  // row with no label.
                  label:
                    CATEGORY_LABEL[row.category as keyof typeof CATEGORY_LABEL] ??
                    row.category ??
                    "No category observed",
                  value: row.count,
                }))}
                total={stats.totalInfluencers}
              />
            </PanelBody>
          </div>
          <div className="min-w-0">
            <PanelHead>
              <PanelTitle as="h3">Coverage by market</PanelTitle>
              <span className="text-sm text-ink-muted">top 8</span>
            </PanelHead>
            <PanelBody>
              <DistributionRows
                rows={stats.byCountry.slice(0, 8).map((row) => ({
                  // A creator whose platform publishes no country is a real
                  // category, and it was rendering as a bar with no label.
                  label: row.country || "Market not published",
                  value: row.count,
                }))}
                total={stats.totalInfluencers}
              />
            </PanelBody>
          </div>
        </Split>

        {can(user, "admin:audit") && (
          <Panel>
            <PanelHead>
              <PanelTitle>Recent activity</PanelTitle>
              <Link
                href="/admin/audit"
                className="rounded text-sm font-medium text-brand-ink hover:underline"
              >
                Full audit log
              </Link>
            </PanelHead>
            <RowList>
              {auditLog(6).map((entry) => (
                <li
                  key={entry.id}
                  className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-4 py-2"
                >
                  {/* The same chip the audit page uses — one treatment for an
                      action code. Brand ink stays for links; this is not one. */}
                  <code className="rounded bg-sunken px-1.5 py-0.5 font-num text-sm text-ink">
                    {entry.action}
                  </code>
                  <span className="text-base text-ink">{entry.detail}</span>
                  <span className="ml-auto text-sm text-ink-muted">
                    {entry.actor}
                    <span aria-hidden> · </span>
                    {formatRelativeTime(entry.at)}
                  </span>
                </li>
              ))}
            </RowList>
          </Panel>
        )}
      </PageBody>
    </>
  );
}
