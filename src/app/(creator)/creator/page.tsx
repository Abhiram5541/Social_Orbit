import type { Metadata } from "next";
import Link from "next/link";
import { Link2, TriangleAlert } from "lucide-react";
import { PLATFORM_LABEL } from "@/lib/contracts/common";
import {
  formatCompact,
  formatDate,
  formatPercent,
  formatRelativeTime,
  NO_VALUE,
  pluralise,
} from "@/lib/format";
import { requireOwnProfile } from "@/server/auth/creator";
import { PageBody, PageHeader } from "@/components/shell/app-shell";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, Notice } from "@/components/ui/states";
import { StatRow, StatTile } from "@/components/intelligence/stat";
import { Insight, InsightFeed } from "@/components/intelligence/insight";
import { Panel, PanelFoot, PanelHead, PanelTitle, RowList } from "@/components/ui/panel";
import { HEALTH_BAND_LABEL, ScoreRing } from "@/components/intelligence/score";

export const metadata: Metadata = { title: "Creator overview" };
export const dynamic = "force-dynamic";

export default async function CreatorOverviewPage() {
  const { profile } = await requireOwnProfile("/creator");

  const connected = profile.socialAccounts.filter((account) => account.isConnected);
  const needsReauth = profile.socialAccounts.filter((account) => account.needsReauth);

  // Profile completion is measured from what is actually filled in, so the
  // number moves when the creator does something.
  const checks = [
    { done: Boolean(profile.bio), label: "Add a bio" },
    { done: connected.length > 0, label: "Connect a platform" },
    { done: profile.verification === "verified", label: "Complete verification" },
    { done: profile.audience.available, label: "Authorise audience insights" },
    { done: profile.categories.length > 0, label: "Confirm your categories" },
  ];
  const completion = Math.round((checks.filter((check) => check.done).length / checks.length) * 100);

  // Same publication rule as the full HealthPanel: a score is shown only when
  // enough of the formula was measurable to publish one.
  const scored = profile.health.sufficient;
  const confidence = profile.confidenceDetail;
  const confidenceBarTone =
    confidence.band === "preliminary"
      ? "bg-critical"
      : confidence.band === "moderate"
        ? "bg-caution"
        : "bg-brand-glow";

  /*
   * What a creator can act on, phrased as findings rather than as a checklist.
   * Every row is a condition that is true right now — the page is silent when
   * none of them are, which is itself a real state and reads as one.
   */
  const guidance = [
    profile.verification !== "verified" && {
      id: "verify",
      kind: "brand" as const,
      headline: "Your identity is not verified yet",
      evidence:
        "Verified creators carry a badge wherever brands see them. It requires connecting an account over OAuth — it is never granted from public data.",
      href: "/creator/verification",
      actionLabel: "Get verified",
    },
    !profile.audience.available && {
      id: "audience",
      kind: "caution" as const,
      headline: "Brands cannot see who your audience is",
      evidence:
        "Audience demographics come only from a creator-authorised professional account. SENSO does not estimate them from public data, so the section stays empty until you authorise it.",
      href: "/creator/connections",
      actionLabel: "Authorise",
    },
    !profile.health.sufficient && {
      id: "unscored",
      kind: "caution" as const,
      headline: "Too little was measurable to publish a health score",
      evidence:
        "A score is published only once enough of the nine components could be measured. Connecting an account is what unlocks the rest.",
      href: "/creator/connections",
      actionLabel: "Connect",
    },
    confidence.band === "preliminary" && {
      id: "confidence",
      kind: "caution" as const,
      headline: "Your data confidence is preliminary",
      evidence:
        "Brands see a warning beside your figures until there is enough history and source authority behind them. Confidence rises as snapshots accumulate.",
    },
    !profile.bio && {
      id: "bio",
      kind: "neutral" as const,
      headline: "Your profile has no bio",
      evidence: "The bio is the first thing a brand reads on your dossier.",
      href: "/creator/profile",
      actionLabel: "Edit profile",
    },
  ].filter((item): item is Exclude<typeof item, false> => Boolean(item));

  const topContent = [...profile.recentContent]
    .filter((item) => item.views !== null)
    .sort((a, b) => (b.views ?? 0) - (a.views ?? 0))
    .slice(0, 5);

  return (
    <>
      <PageHeader
        eyebrow="Creator portal"
        title="Overview"
        description="This is what brands see when they open your SENSO profile."
        actions={
          <LinkButton href={`/influencers/${profile.id}`} className="gap-1.5">
            Preview public profile
          </LinkButton>
        }
      />

      <PageBody className="rise-stagger space-y-4">
        {needsReauth.length > 0 && (
          <Notice
            tone="critical"
            icon={TriangleAlert}
            title="A connection needs reauthorising"
            action={
              <LinkButton href="/creator/connections" variant="primary" size="sm">
                Reconnect
              </LinkButton>
            }
          >
            {needsReauth.map((account) => PLATFORM_LABEL[account.platform]).join(", ")} can no
            longer refresh. Your authorized metrics are frozen at the last successful sync
            until you reconnect.
          </Notice>
        )}

        {/* Verification is no longer a banner: the same finding now leads the
            "What brands will notice" feed lower down, with its evidence and
            its action attached. Two copies of one message made the top of the
            page a stack of notices. The reauthorisation banner above stays —
            that one stops data flowing, and it is not advice. */}

        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          {/* The creator's own readout leads, on the same instrument ground a
              brand sees — the checklist beside it is housekeeping, not the
              headline. */}
          <section className="relative overflow-hidden rounded-2xl bg-instrument text-instrument-ink shadow-instrument before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-white/8">
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-instrument-line px-4 py-2.5">
              <h2 className="label-caps text-instrument-muted">Your SENSO Health</h2>
              <span className="font-num text-xs text-instrument-muted">
                {profile.health.formulaVersion}
              </span>
            </header>
            <div className="flex flex-wrap items-center gap-5 p-5">
              <ScoreRing value={scored ? profile.health.value : null} size={124} tone="instrument" />
              <div className="min-w-40 flex-1 space-y-2">
                <p className="font-display text-stat font-bold leading-tight">
                  {scored ? HEALTH_BAND_LABEL[profile.health.band] : "Not scored"}
                </p>
                <p className="text-sm text-instrument-muted">
                  Computed from nine weighted components by a published formula. Nothing here
                  is a subjective rating — every input is a measurement we can show you.
                </p>
              </div>
            </div>
            {/* Confidence sits on its own rule, mirroring HealthPanel — it
                answers a different question and must not read as part of the
                value. */}
            <div className="border-t border-instrument-line px-5 py-3">
              <div className="max-w-xs space-y-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="label-caps text-instrument-muted">Data confidence</span>
                  <span className="font-num text-base font-semibold">
                    {Math.round(confidence.score)}%
                  </span>
                </div>
                <div className="h-1 overflow-hidden rounded-sm bg-instrument-line">
                  <div
                    className={`animate-extend h-full rounded-sm ${confidenceBarTone}`}
                    style={{ width: `${Math.min(100, confidence.score)}%` }}
                  />
                </div>
                <p className="text-xs text-instrument-muted">{confidence.band} confidence</p>
              </div>
            </div>
          </section>

          <Card>
            <CardHeader>
              <CardTitle>Profile completion</CardTitle>
              <span className="font-num text-base text-ink">{completion}%</span>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="h-1.5 overflow-hidden rounded-full bg-line">
                <div className="h-full rounded-full bg-positive" style={{ width: `${completion}%` }} />
              </div>
              <ul className="space-y-1.5">
                {checks.map((check) => (
                  <li key={check.label} className="flex items-center gap-2 text-base">
                    <span
                      className={`size-1.5 rounded-full ${check.done ? "bg-positive" : "bg-line-strong"}`}
                      aria-hidden
                    />
                    <span className={check.done ? "text-ink-muted line-through" : "text-ink"}>
                      {check.label}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        <StatRow>
          <StatTile label="Followers" value={formatCompact(profile.glance.followers)} emphasis />
          <StatTile label="Median views" value={formatCompact(profile.glance.medianViews)} />
          <StatTile label="Engagement" value={formatPercent(profile.glance.engagementRate)} />
          <StatTile label="Content indexed" value={formatCompact(profile.glance.contentCount)} />
          <StatTile
            label="Last refresh"
            value={formatRelativeTime(profile.lastRefreshedAt)}
            footnote="scheduled sync"
          />
        </StatRow>

        <Card>
          <CardHeader>
            <CardTitle>Connected accounts</CardTitle>
            <Link href="/creator/connections" className="rounded text-base font-medium text-brand-ink hover:underline">
              Manage
            </Link>
          </CardHeader>
          {profile.socialAccounts.length === 0 ? (
            <EmptyState
              icon={Link2}
              title="No accounts connected"
              description="Connecting an account is what populates your profile and starts the verification path."
              action={
                <LinkButton href="/creator/connections" variant="primary" size="sm">
                  Connect an account
                </LinkButton>
              }
            />
          ) : (
            <ul className="divide-y divide-line">
              {profile.socialAccounts.map((account) => (
                <li key={account.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                  <Link2 className="size-4 shrink-0 text-ink-subtle" aria-hidden />
                  <span className="min-w-40 flex-1">
                    <span className="block font-medium text-ink">
                      {PLATFORM_LABEL[account.platform]}
                    </span>
                    <span className="block font-num text-sm text-ink-muted">
                      {account.handle}
                    </span>
                  </span>
                  {/* Fixed cells so figures and badges stack in true columns. */}
                  <span className="w-20 shrink-0 text-right font-num text-base text-ink">
                    {formatCompact(account.followers)}
                  </span>
                  <span className="flex w-32 shrink-0 justify-end">
                    <Badge
                      tone={
                        account.needsReauth ? "critical" : account.isConnected ? "positive" : "neutral"
                      }
                      dot
                    >
                      {account.needsReauth
                        ? "Reauthorise"
                        : account.isConnected
                          ? "Connected"
                          : "Not connected"}
                    </Badge>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <div className="grid items-start gap-4 lg:grid-cols-[1fr_1.2fr]">
          <Panel>
            <PanelHead>
              <PanelTitle>What brands will notice</PanelTitle>
              <span className="text-sm text-ink-muted">
                {guidance.length > 0
                  ? pluralise(guidance.length, "item")
                  : "Nothing outstanding"}
              </span>
            </PanelHead>
            {guidance.length === 0 ? (
              <div className="p-4">
                <p className="text-base font-medium text-ink">Your profile is complete</p>
                <p className="mt-1 text-sm text-ink-muted">
                  Verified, connected, authorised and scored. Nothing on your side is
                  holding a figure back.
                </p>
              </div>
            ) : (
              <InsightFeed>
                {guidance.map((item) => (
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
            )}
          </Panel>

          <Panel>
            <PanelHead>
              <PanelTitle>Your best-performing content</PanelTitle>
              <span className="text-sm text-ink-muted">
                By observed views, across what SENSO has indexed
              </span>
            </PanelHead>
            {topContent.length === 0 ? (
              <div className="p-4">
                <p className="text-base font-medium text-ink">Nothing indexed yet</p>
                <p className="mt-1 text-sm text-ink-muted">
                  Content appears here once a connected platform has been read.
                </p>
              </div>
            ) : (
              <>
                <RowList>
                  {topContent.map((item) => (
                    <li
                      key={item.id}
                      className="flex items-center gap-3 px-4 py-2.5"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-base font-medium text-ink">
                          {item.title}
                        </span>
                        <span className="block text-sm text-ink-muted">
                          {PLATFORM_LABEL[item.platform]}
                          <span aria-hidden> · </span>
                          {formatDate(item.publishedAt)}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <span className="label-caps-sm block text-ink-subtle">Views</span>
                        <span className="font-num text-base text-ink">
                          {formatCompact(item.views)}
                        </span>
                      </span>
                      <span className="hidden shrink-0 text-right sm:block">
                        <span className="label-caps-sm block text-ink-subtle">
                          Vs median
                        </span>
                        <span className="font-num text-base text-ink">
                          {item.performanceIndex === null
                            ? NO_VALUE
                            : `${item.performanceIndex.toFixed(1)}×`}
                        </span>
                      </span>
                    </li>
                  ))}
                </RowList>
                <PanelFoot>
                  &ldquo;Vs median&rdquo; compares each post against your own median views,
                  not against other creators — a 2.0× means it reached twice your usual
                  audience.
                </PanelFoot>
              </>
            )}
          </Panel>
        </div>
      </PageBody>
    </>
  );
}
