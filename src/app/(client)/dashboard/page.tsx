import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Search,
  ShieldCheck,
} from "lucide-react";
import { CAMPAIGN_STATUS_LABEL } from "@/lib/contracts/campaign";
import { healthBand } from "@/lib/contracts/score";
import {
  formatCompact,
  formatDate,
  formatPercent,
  NO_VALUE,
  pluralise,
} from "@/lib/format";
import { requirePageSession } from "@/server/auth/rbac";
import { countInfluencers } from "@/server/repositories/influencer-repository";
import { workspaceIntelligence } from "@/server/services/workspace-intelligence";
import { PageBody, PageHeader } from "@/components/shell/app-shell";
import { LinkButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Instrument,
  InstrumentLabel,
  Panel,
  PanelBody,
  RowList,
} from "@/components/ui/panel";
import { Avatar } from "@/components/ui/avatar";
import { AreaCurve } from "@/components/charts/bento";
import { ColumnsToggle } from "@/components/charts/columns-toggle";
import { Greeting } from "@/components/intelligence/greeting";
import {
  FeedFooterLink,
  Insight,
  InsightFeed,
} from "@/components/intelligence/insight";
import { SensoMark } from "@/components/shell/logo";
import {
  CardHead,
  RoundLink,
  SplitFigure,
} from "@/components/intelligence/bento-card";

export const metadata: Metadata = { title: "Overview" };

const BAND_READING: Record<
  ReturnType<typeof healthBand>,
  { label: string; tone: "positive" | "brand" | "caution" | "critical" }
> = {
  excellent: { label: "Excellent", tone: "positive" },
  strong: { label: "Strong", tone: "positive" },
  fair: { label: "Fair", tone: "caution" },
  weak: { label: "Needs review", tone: "critical" },
};

export default async function DashboardPage() {
  const user = await requirePageSession("/dashboard");
  const { portfolio, campaigns, liveCampaigns, insights, shortlistCount } =
    workspaceIntelligence(user);
  const indexed = countInfluencers();

  const reading =
    portfolio.medianHealth === null
      ? null
      : BAND_READING[healthBand(portfolio.medianHealth)];

  const ranked = [...portfolio.creators].sort(
    (a, b) => (b.healthScore ?? -1) - (a.healthScore ?? -1),
  );
  // Cumulative audience as creators are added smallest-first: the shape says
  // how concentrated the roster's reach is. Not a time series, and labelled
  // as such — the database holds too few snapshot days to draw one honestly.
  const reachCurve = [...portfolio.creators]
    .map((creator) => creator.followers ?? 0)
    .sort((a, b) => a - b)
    .reduce<number[]>(
      (acc, value) => [...acc, (acc[acc.length - 1] ?? 0) + value],
      [0],
    );
  const scored = portfolio.creators.filter(
    (creator) => creator.healthScore !== null,
  ).length;

  return (
    <>
      <PageHeader
        title={<Greeting name={user.name} />}
        actions={
          <>
            <span className="inline-flex h-10 items-center gap-2 rounded-full bg-surface px-4 text-base font-medium text-ink">
              <CalendarDays className="size-4 text-ink-muted" aria-hidden />
              {formatDate(new Date().toISOString())}
            </span>
            <LinkButton
              href="/discovery"
              variant="secondary"
              className="gap-2 border-0 bg-surface"
            >
              <Search className="size-4" aria-hidden />
              Discover creators
            </LinkButton>
          </>
        }
        className="pt-4"
      />

      {portfolio.tracked === 0 ? (
        <FirstRun indexed={indexed} />
      ) : (
        <>
          <PageBody className="space-y-4">
            {/* Nested stacks rather than grid spans: the same composition, and
              nothing depends on a span class resolving in every engine. */}
            <div className="grid gap-4 xl:grid-cols-[minmax(0,2.95fr)_minmax(0,1.25fr)]">
              <div className="min-w-0 space-y-4">
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1.9fr)]">
                  {/* Left: the score, printed on a green card. ---------------- */}
                  <div className="flex min-w-0 flex-col gap-4">
                    <Panel>
                      <CardHead
                        title="Roster health"
                        subtitle="Median SENSO Health"
                        href="/shortlists"
                      />
                      <PanelBody className="pt-0">
                        <div className="relative overflow-hidden rounded-xl bg-brand p-5 text-white">
                          <span
                            aria-hidden
                            className="pointer-events-none absolute -right-10 -top-16 size-44 rounded-full bg-white/10"
                          />
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-2">
                              <SensoMark tile={false} className="size-6" />
                              <span className="font-display text-base font-bold">
                                SENSO
                              </span>
                            </span>
                            <span className="rounded-full bg-white/15 px-2.5 py-1 label-caps-sm text-white">
                              {reading?.label ?? "Unscored"}
                            </span>
                          </div>
                          <p className="mt-6 text-xs font-medium text-white/70">
                            Health
                          </p>
                          <p className="mt-1 flex items-baseline gap-1.5">
                            <span className="font-num text-hero font-bold leading-none tracking-tight">
                              {portfolio.medianHealth === null
                                ? NO_VALUE
                                : Math.round(portfolio.medianHealth)}
                            </span>
                            <span className="font-num text-lg font-semibold text-white/70">
                              /100
                            </span>
                          </p>
                          <div className="mt-6 flex items-center justify-between text-xs font-medium text-white/75">
                            <span className="font-num tracking-widest">
                              •••• median of {portfolio.tracked}
                            </span>
                            <span>{pluralise(scored, "scored")}</span>
                          </div>
                        </div>
                      </PanelBody>
                    </Panel>

                    <Panel>
                      <PanelBody className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm text-ink-muted">
                            Median engagement
                          </p>
                          <p className="mt-1 font-num text-stat-lg font-bold leading-none text-ink">
                            {formatPercent(portfolio.medianEngagement)}
                          </p>
                        </div>
                        <Badge tone="positive">observed</Badge>
                      </PanelBody>
                    </Panel>
                  </div>

                  {/* Middle: the column chart with its toggle. ---------------- */}
                  <Panel className="flex min-w-0 flex-col">
                    <CardHead
                      title="Health by creator"
                      subtitle="Stored scores, highest first"
                      icon={ShieldCheck}
                    />
                    <PanelBody className="flex-1 pt-0">
                      <ColumnsToggle
                        height={250}
                        options={[
                          {
                            label: "Health",
                            items: ranked.slice(0, 8).map((creator, index) => ({
                              id: creator.id,
                              label: creator.displayName.split(" ")[0],
                              value: creator.healthScore,
                              highlight: index === 0,
                              href: `/influencers/${creator.id}`,
                            })),
                          },
                          {
                            label: "Confidence",
                            items: ranked.slice(0, 8).map((creator, index) => ({
                              id: creator.id,
                              label: creator.displayName.split(" ")[0],
                              value: creator.confidence,
                              highlight: index === 0,
                              href: `/influencers/${creator.id}`,
                            })),
                          },
                        ]}
                      />
                    </PanelBody>
                  </Panel>
                </div>

                {/* Bottom of the main block: the roster table. -------------- */}
                <Panel className="min-w-0">
                  <CardHead
                    title="Roster"
                    subtitle="Tracked creators, ranked by health"
                    href="/shortlists"
                  />
                  <div className="scroll-x px-3 pb-3">
                    <table className="w-full min-w-[36rem] border-separate border-spacing-0 text-base">
                      <thead>
                        <tr className="text-left text-xs font-medium text-ink-subtle">
                          <th scope="col" className="px-3 pb-2 font-medium">
                            Creator
                          </th>
                          <th scope="col" className="px-3 pb-2 font-medium">
                            Followers
                          </th>
                          <th scope="col" className="px-3 pb-2 font-medium">
                            Engagement
                          </th>
                          <th scope="col" className="px-3 pb-2 font-medium">
                            Status
                          </th>
                          <th
                            scope="col"
                            className="px-3 pb-2 text-right font-medium"
                          >
                            Health
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {ranked.slice(0, 6).map((creator) => {
                          const band =
                            creator.healthScore === null
                              ? null
                              : healthBand(creator.healthScore);
                          return (
                            <tr
                              key={creator.id}
                              className="group [&>td]:py-2.5 even:[&>td]:bg-sunken/70 [&>td:first-child]:rounded-l-lg [&>td:last-child]:rounded-r-lg"
                            >
                              <td className="px-3">
                                <Link
                                  href={`/influencers/${creator.id}`}
                                  className="flex items-center gap-3 rounded-md"
                                >
                                  <Avatar
                                    name={creator.displayName}
                                    src={creator.avatarUrl}
                                    size="sm"
                                  />
                                  <span className="min-w-0">
                                    <span className="block truncate font-semibold text-ink group-hover:text-brand-ink">
                                      {creator.displayName}
                                    </span>
                                    <span className="block truncate text-xs text-ink-subtle">
                                      @{creator.primaryHandle}
                                    </span>
                                  </span>
                                </Link>
                              </td>
                              <td className="px-3 font-num text-ink">
                                {formatCompact(creator.followers)}
                              </td>
                              <td className="px-3 font-num text-ink">
                                {formatPercent(creator.engagementRate)}
                              </td>
                              <td className="px-3">
                                {band ? (
                                  <Badge tone={BAND_READING[band].tone} dot>
                                    {BAND_READING[band].label}
                                  </Badge>
                                ) : (
                                  <Badge>Not scored</Badge>
                                )}
                              </td>
                              <td className="px-3 text-right font-num font-bold text-ink">
                                {creator.healthScore === null
                                  ? NO_VALUE
                                  : Math.round(creator.healthScore)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </Panel>
              </div>

              {/* Right: audience, confidence, shortlists. -------------------- */}
              <div className="grid min-w-0 gap-4 md:grid-cols-3 xl:grid-cols-1">
                <Panel>
                  <CardHead
                    title="Combined audience"
                    subtitle="Sum of observed followers"
                    href="/discovery"
                  />
                  <PanelBody className="pt-0 text-center">
                    <p className="text-xs text-ink-subtle">Total audience</p>
                    <SplitFigure
                      value={formatCompact(portfolio.totalReach)}
                      className="mt-1"
                    />
                    <AreaCurve
                      values={reachCurve}
                      height={120}
                      className="mt-4"
                      ariaLabel="Cumulative audience across the roster, smallest creator first"
                    />
                    <p className="mt-1 text-2xs text-ink-subtle">
                      Cumulative, smallest creator first
                    </p>
                    <div className="mt-4 flex gap-2">
                      <LinkButton
                        href="/discovery"
                        variant="primary"
                        size="sm"
                        className="flex-1 gap-1.5"
                      >
                        Discover
                        <ArrowUpRight className="size-3.5" aria-hidden />
                      </LinkButton>
                      <LinkButton
                        href="/compare"
                        variant="secondary"
                        size="sm"
                        className="flex-1 gap-1.5 border-0 bg-sunken"
                      >
                        Compare
                        <ArrowDownRight className="size-3.5" aria-hidden />
                      </LinkButton>
                    </div>
                  </PanelBody>
                </Panel>

                <Panel>
                  <CardHead
                    title="Data confidence"
                    subtitle="Median across the roster"
                    icon={ShieldCheck}
                  />
                  <PanelBody className="pt-0">
                    <div className="flex flex-wrap items-center gap-3">
                      <SplitFigure
                        value={
                          portfolio.medianConfidence === null
                            ? NO_VALUE
                            : `${Math.round(portfolio.medianConfidence)}%`
                        }
                      />
                      <Badge
                        tone={
                          portfolio.preliminary > 0 ? "caution" : "positive"
                        }
                      >
                        {portfolio.preliminary > 0
                          ? `${portfolio.preliminary} preliminary`
                          : "all scored"}
                      </Badge>
                    </div>
                    <div className="mt-5 rounded-lg bg-sunken p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-base font-semibold text-ink">
                            Shortlists
                          </p>
                          <p className="text-xs text-ink-subtle">
                            {pluralise(shortlistCount, "list")} ·{" "}
                            {pluralise(portfolio.tracked, "creator")}
                          </p>
                        </div>
                        <RoundLink href="/shortlists" label="Open shortlists" />
                      </div>
                      <div className="mt-3 flex items-center">
                        <div className="flex -space-x-2.5">
                          {ranked.slice(0, 4).map((creator) => (
                            <Avatar
                              key={creator.id}
                              name={creator.displayName}
                              src={creator.avatarUrl}
                              size="md"
                              className="[&_img]:ring-2 [&_img]:ring-sunken [&_span]:ring-2 [&_span]:ring-sunken"
                            />
                          ))}
                        </div>
                        {portfolio.tracked > 4 && (
                          <span className="-ml-2.5 grid size-10 place-items-center rounded-full bg-brand font-num text-sm font-bold text-white ring-2 ring-sunken">
                            +{portfolio.tracked - 4}
                          </span>
                        )}
                      </div>
                    </div>
                  </PanelBody>
                </Panel>
              </div>
            </div>

            {/* Second screen: the signals and the campaigns. ------------ */}
            <div className="grid gap-4 xl:grid-cols-[minmax(0,2.95fr)_minmax(0,1.25fr)]">
              <Panel className="min-w-0">
                <CardHead
                  title="What's happening"
                  subtitle={
                    insights.length > 0
                      ? `${pluralise(insights.length, "signal")} across your roster`
                      : "No signals firing"
                  }
                />
                {insights.length === 0 ? (
                  <PanelBody className="pt-0">
                    <p className="text-base font-medium text-ink">
                      Nothing needs a decision
                    </p>
                    <p className="mt-1 max-w-md text-sm text-ink-muted">
                      SENSO is watching this roster for risk signals,
                      health falling below review threshold, dormancy, thin
                      confidence and stale observations. None are firing.
                    </p>
                  </PanelBody>
                ) : (
                  <>
                    <InsightFeed>
                      {insights.slice(0, 5).map((insight) => (
                        <Insight
                          key={insight.id}
                          kind={insight.kind}
                          headline={insight.headline}
                          evidence={insight.evidence}
                          href={insight.href}
                          actionLabel={insight.actionLabel}
                        />
                      ))}
                    </InsightFeed>
                    {insights.length > 5 && (
                      <FeedFooterLink href="/shortlists">
                        {insights.length - 5} more across your shortlists
                      </FeedFooterLink>
                    )}
                  </>
                )}
              </Panel>

              <Panel className="min-w-0">
                <CardHead
                  title="Campaigns"
                  subtitle={
                    campaigns.length > 0
                      ? `${pluralise(liveCampaigns.length, "live")} · ${campaigns.length} total`
                      : "None created yet"
                  }
                  href="/campaigns"
                />
                {campaigns.length === 0 ? (
                  <PanelBody className="pt-0">
                    <div className="flex flex-col items-start gap-3">
                      <Pipeline />
                      <p className="text-sm text-ink-muted">
                        Create a campaign to select creators, set a tracking
                        hashtag, and measure what each of them delivered.
                      </p>
                      <LinkButton
                        href="/campaigns/new"
                        variant="primary"
                        size="sm"
                      >
                        Create campaign
                      </LinkButton>
                    </div>
                  </PanelBody>
                ) : (
                  <RowList className="px-2 pb-2">
                    {campaigns.slice(0, 4).map((campaign) => {
                      const progress =
                        campaign.participantCount === 0
                          ? 0
                          : Math.round(
                              (campaign.confirmedCount /
                                campaign.participantCount) *
                                100,
                            );
                      return (
                        <li key={campaign.id}>
                          <Link
                            href={`/campaigns/${campaign.id}`}
                            className="block rounded-lg px-3 py-3 transition-colors hover:bg-sunken/70"
                          >
                            <div className="flex items-center justify-between gap-3">
                              <p className="min-w-0 truncate font-semibold text-ink">
                                {campaign.name}
                              </p>
                              <Badge
                                tone={
                                  campaign.status === "live"
                                    ? "positive"
                                    : campaign.status === "completed"
                                      ? "neutral"
                                      : "caution"
                                }
                                dot={campaign.status === "live"}
                              >
                                {CAMPAIGN_STATUS_LABEL[campaign.status]}
                              </Badge>
                            </div>
                            <p className="mt-0.5 truncate text-xs text-ink-subtle">
                              <span className="font-num">
                                #{campaign.hashtag}
                              </span>
                              <span aria-hidden> · </span>
                              {formatDate(campaign.startsOn)} –{" "}
                              {formatDate(campaign.endsOn)}
                            </p>
                            <div className="mt-2.5 flex items-center gap-3">
                              <span className="h-2 flex-1 overflow-hidden rounded-full bg-sunken-strong">
                                <span
                                  className="animate-extend block h-full rounded-full bg-brand"
                                  style={{ width: `${progress}%` }}
                                />
                              </span>
                              <span className="shrink-0 font-num text-xs text-ink-muted">
                                <span className="font-semibold text-ink">
                                  {campaign.confirmedCount}/
                                  {campaign.participantCount}
                                </span>{" "}
                                confirmed
                              </span>
                            </div>
                          </Link>
                        </li>
                      );
                    })}
                  </RowList>
                )}
              </Panel>
            </div>
          </PageBody>
        </>
      )}
    </>
  );
}

/**
 * First run.
 *
 * A fresh workspace has no roster, so the executive readout has nothing to
 * read. Rather than print an empty instrument, the screen shows what the
 * platform already holds and the four steps that turn it into a decision —
 * the pipeline is the empty state.
 */
function FirstRun({ indexed }: { indexed: number }) {
  const steps = [
    {
      title: "Discover",
      detail:
        "Search the indexed database by market, category, audience quality and campaign fit.",
    },
    {
      title: "Understand",
      detail:
        "Read a creator's health, risk and confidence, and where every figure came from.",
    },
    {
      title: "Shortlist",
      detail:
        "Save candidates, compare them side by side, and share the reasoning.",
    },
    {
      title: "Measure",
      detail:
        "Run a campaign against a tracking hashtag and score what each creator delivered.",
    },
  ];

  return (
    <>
      {/* An empty workspace still gets the screen's one instrument reading —
          here it is the size of the database the visitor is about to search,
          which is the only measured number a first-run session has. */}
      <Instrument className="py-9">
        <div className="grid items-start gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,23rem)]">
          <div className="min-w-0">
            <InstrumentLabel>Creators indexed and scored</InstrumentLabel>
            <p className="mt-3 font-num text-hero font-medium leading-none text-instrument-ink">
              {formatCompact(indexed)}
            </p>
            <p className="measure mt-5 text-base leading-relaxed text-instrument-muted">
              Every one carries a deterministic health score, a separate
              data-confidence reading and the provenance of each figure behind
              it. Start a search to build your first shortlist — nothing here is
              tracked until you save it.
            </p>
            <div className="mt-7 flex flex-wrap gap-2">
              <LinkButton href="/discovery" variant="accent" className="gap-2">
                <Search className="size-4" aria-hidden />
                Search creators
              </LinkButton>
              <LinkButton
                href="/help"
                variant="ghost"
                className="text-instrument-ink hover:bg-instrument-raised hover:text-instrument-ink"
              >
                How SENSO scores
              </LinkButton>
            </div>
          </div>
          <ol className="min-w-0 divide-y divide-instrument-line lg:border-l lg:border-instrument-line lg:pl-12">
            {steps.map((step, index) => (
              <li
                key={step.title}
                className="flex gap-3 py-3 first:pt-0 last:pb-0"
              >
                <span
                  aria-hidden
                  className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border border-instrument-line-strong font-num text-2xs font-semibold text-instrument-muted"
                >
                  {index + 1}
                </span>
                <span className="min-w-0">
                  <span className="block text-base font-medium text-instrument-ink">
                    {step.title}
                  </span>
                  <span className="block text-sm text-instrument-muted">
                    {step.detail}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </Instrument>
      <PageBody />
    </>
  );
}

/** The campaign flow, drawn rather than described. */
function Pipeline() {
  return (
    <div
      aria-hidden
      className="flex flex-wrap items-center justify-center gap-1.5 text-sm text-ink-muted"
    >
      {["Select creators", "Set hashtag", "Measure"].map((step, index) => (
        <span key={step} className="flex items-center gap-1.5">
          {index > 0 && <ArrowRight className="size-3 text-ink-subtle" />}
          <span className="rounded-md border border-line bg-sunken px-2 py-0.5">
            {step}
          </span>
        </span>
      ))}
    </div>
  );
}

// Quota and campaign figures are per-request and per-tenant; never statically cached.
export const dynamic = "force-dynamic";
