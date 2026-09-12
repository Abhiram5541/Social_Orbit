import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Search } from "lucide-react";
import { CAMPAIGN_STATUS_LABEL } from "@/lib/contracts/campaign";
import { healthBand } from "@/lib/contracts/score";
import {
  formatCompact,
  formatDate,
  formatPercent,
  formatRelativeTime,
  NO_VALUE,
  pluralise,
} from "@/lib/format";
import { requirePageSession } from "@/server/auth/rbac";
import { countInfluencers } from "@/server/repositories/influencer-repository";
import { quotaFor } from "@/server/repositories/usage-repository";
import { listShortlists } from "@/server/repositories/workspace-repository";
import { workspaceIntelligence } from "@/server/services/workspace-intelligence";
import { PageBand, PageBody, PageHeader } from "@/components/shell/app-shell";
import { LinkButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Instrument,
  InstrumentLabel,
  Panel,
  PanelBody,
  PanelFoot,
  PanelHead,
  PanelTitle,
  RowList,
  Split,
} from "@/components/ui/panel";
import { Avatar } from "@/components/ui/avatar";
import { CompositionBar, DistributionRows, type DistributionTone } from "@/components/charts/distribution-bars";
import { ReachQualityPlot } from "@/components/charts/distribution";
import { Greeting } from "@/components/intelligence/greeting";
import { FeedFooterLink, Insight, InsightFeed } from "@/components/intelligence/insight";
import { QuotaMeter } from "@/components/intelligence/quota-meter";
import { ScorePill, ScoreRing } from "@/components/intelligence/score";
import { Metric, MetricStrip } from "@/components/intelligence/signal";

export const metadata: Metadata = { title: "Overview" };

const BAND_READING: Record<
  ReturnType<typeof healthBand>,
  { label: string; tone: "positive" | "brand" | "caution" | "critical" }
> = {
  excellent: { label: "Excellent", tone: "positive" },
  strong: { label: "Strong", tone: "brand" },
  fair: { label: "Fair", tone: "caution" },
  weak: { label: "Needs review", tone: "critical" },
};

export default async function DashboardPage() {
  const user = await requirePageSession("/dashboard");
  const quota = quotaFor(user.orgId, user.plan);
  const { portfolio, campaigns, liveCampaigns, insights, shortlistCount } =
    workspaceIntelligence(user);
  const shortlists = listShortlists(user);
  const indexed = countInfluencers();

  const reading =
    portfolio.medianHealth === null
      ? null
      : BAND_READING[healthBand(portfolio.medianHealth)];

  return (
    <>
      <PageHeader
        eyebrow={user.orgName}
        title={<Greeting name={user.name} />}
        description={
          portfolio.tracked > 0
            ? `Creator intelligence across ${pluralise(portfolio.tracked, "tracked creator")}, ${pluralise(liveCampaigns.length, "live campaign")} and ${pluralise(shortlistCount, "shortlist")}.`
            : "Your creator intelligence workspace. Nothing is tracked yet."
        }
        actions={
          <LinkButton href="/discovery" variant="primary" className="gap-2">
            <Search className="size-4" aria-hidden />
            Discover creators
          </LinkButton>
        }
      />

      {portfolio.tracked === 0 ? (
        <FirstRun indexed={indexed} />
      ) : (
        <>
          {/* The screen's one loud moment: the roster's median health, read
              off the instrument rather than printed on the page. Everything
              below it is quiet by comparison, which is the only way a reader
              can tell what this screen is for in one glance. */}
          <Instrument className="py-7">
            <div className="grid items-center gap-x-10 gap-y-8 lg:grid-cols-[auto_minmax(0,1fr)_minmax(0,22rem)]">
              <div className="flex items-center gap-6">
                <ScoreRing
                  value={portfolio.medianHealth}
                  size={132}
                  tone="instrument"
                  label="Median SocialOrbit Health across your roster"
                />
                <div className="min-w-0">
                  <InstrumentLabel>Roster health</InstrumentLabel>
                  <p className="mt-1.5 font-display text-lg font-bold text-instrument-ink">
                    {reading?.label ?? "Not yet measurable"}
                  </p>
                  <p className="mt-0.5 text-sm text-instrument-muted">
                    Median SocialOrbit Health
                  </p>
                </div>
              </div>

              <p className="measure max-w-md text-base leading-relaxed text-instrument-muted">
                Half the creators you track score above{" "}
                <span className="font-num font-medium text-instrument-ink">
                  {portfolio.medianHealth === null
                    ? NO_VALUE
                    : Math.round(portfolio.medianHealth)}
                </span>
                .{" "}
                {portfolio.flagged > 0
                  ? `${portfolio.flagged} of them carry a measured audience-risk signal, and risk does not average — a single disqualifying signal sets the floor.`
                  : portfolio.risk.unknown === portfolio.tracked
                    ? "No audience-quality signal was measurable for any of them: that needs authorised access, and is reported as unknown rather than as low risk."
                    : "No creator on the roster carries a medium or high audience-risk signal."}
              </p>

              <div className="min-w-0 space-y-5 lg:border-l lg:border-instrument-line lg:pl-10">
                <div>
                  <InstrumentLabel className="mb-2.5">Health distribution</InstrumentLabel>
                  <DistributionRows
                    onInstrument
                    rows={portfolio.healthBands.map((band) => ({
                      label: band.label,
                      sublabel: band.range,
                      value: band.count,
                      tone: band.tone as DistributionTone,
                    }))}
                    total={portfolio.tracked}
                  />
                </div>
                <div>
                  <InstrumentLabel className="mb-2.5">Audience risk</InstrumentLabel>
                  <CompositionBar
                    onInstrument
                    segments={[
                      { label: "Low", value: portfolio.risk.low, tone: "positive" },
                      { label: "Medium", value: portfolio.risk.medium, tone: "caution" },
                      { label: "High", value: portfolio.risk.high, tone: "critical" },
                      {
                        label: "Not measurable",
                        value: portfolio.risk.unknown,
                        tone: "neutral",
                      },
                    ]}
                  />
                </div>
              </div>
            </div>
          </Instrument>

          <PageBand inset={false}>
            <MetricStrip>
              <Metric
                label="Tracked creators"
                value={formatCompact(portfolio.tracked)}
                tone="lead"
                footnote={`across ${pluralise(shortlistCount, "shortlist")}`}
              />
              <Metric
                label="Combined audience"
                value={formatCompact(portfolio.totalReach)}
                footnote="sum of observed followers"
              />
              <Metric
                label="Median engagement"
                value={formatPercent(portfolio.medianEngagement)}
                footnote="observed, per creator"
              />
              <Metric
                label="Data confidence"
                value={
                  portfolio.medianConfidence === null
                    ? NO_VALUE
                    : `${Math.round(portfolio.medianConfidence)}%`
                }
                footnote={
                  portfolio.preliminary > 0
                    ? `${portfolio.preliminary} preliminary`
                    : "median across roster"
                }
              />
              <Metric
                label="Identity verified"
                value={`${portfolio.verified}/${portfolio.tracked}`}
                tone={portfolio.verified === 0 ? "muted" : "default"}
                footnote="OAuth-confirmed"
              />
              <Metric
                label="Live campaigns"
                value={formatCompact(liveCampaigns.length)}
                footnote={
                  campaigns.length > 0 ? `${campaigns.length} total` : "none created yet"
                }
              />
            </MetricStrip>
          </PageBand>

          <PageBody className="space-y-5">
            <Split cols="lead" className="overflow-hidden rounded-xl border border-line bg-surface">
              <div className="min-w-0">
                <PanelHead>
                  <PanelTitle>What&apos;s happening</PanelTitle>
                  <span className="text-sm text-ink-muted">
                    {insights.length > 0
                      ? `${pluralise(insights.length, "signal")} across your roster`
                      : "No signals firing"}
                  </span>
                </PanelHead>
                {insights.length === 0 ? (
                  <PanelBody>
                    <p className="text-base font-medium text-ink">Nothing needs a decision</p>
                    <p className="mt-1 max-w-md text-sm text-ink-muted">
                      SocialOrbit is watching this roster for risk signals, health
                      falling below review threshold, dormancy, thin confidence and
                      stale observations. None are firing.
                    </p>
                  </PanelBody>
                ) : (
                  <>
                    <InsightFeed>
                      {insights.slice(0, 6).map((insight) => (
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
                    {insights.length > 6 && (
                      <FeedFooterLink href="/shortlists">
                        {insights.length - 6} more across your shortlists
                      </FeedFooterLink>
                    )}
                  </>
                )}
              </div>

              <div className="flex min-w-0 flex-col">
                <PanelHead>
                  <PanelTitle as="h3">Roster</PanelTitle>
                  <Link
                    href="/shortlists"
                    className="rounded text-sm font-medium text-brand-ink hover:underline"
                  >
                    All shortlists
                  </Link>
                </PanelHead>
                {shortlists.length === 0 ? (
                  <PanelBody>
                    <p className="text-sm text-ink-muted">
                      Save creators from discovery to build a roster.
                    </p>
                  </PanelBody>
                ) : (
                  // Capped: the roster column sets the height of the split,
                  // and an unbounded list of shortlists left the feed beside
                  // it standing in a void. The head links to the full set.
                  <RowList>
                    {shortlists.slice(0, 5).map((shortlist) => (
                      <li key={shortlist.id}>
                        <Link
                          href={`/shortlists/${shortlist.id}`}
                          className="flex items-center justify-between gap-3 px-4 py-2.5 transition-colors hover:bg-sunken/70"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-base font-medium text-ink">
                              {shortlist.name}
                            </span>
                            <span className="block text-sm text-ink-muted">
                              {pluralise(shortlist.itemCount, "creator")}
                              <span aria-hidden> · </span>
                              {formatRelativeTime(shortlist.updatedAt)}
                            </span>
                          </span>
                          <ArrowUpRight
                            className="size-4 shrink-0 text-ink-subtle"
                            aria-hidden
                          />
                        </Link>
                      </li>
                    ))}
                  </RowList>
                )}
                {shortlists.length > 5 && (
                  <FeedFooterLink href="/shortlists">
                    {shortlists.length - 5} more {shortlists.length - 5 === 1 ? "shortlist" : "shortlists"}
                  </FeedFooterLink>
                )}
                <PanelFoot className="mt-auto">
                  {quota.limit === null ? (
                    <span>
                      <span className="font-num text-ink">{quota.used}</span> searches this
                      month · unlimited on your plan
                    </span>
                  ) : (
                    <QuotaMeter
                      variant="labelled"
                      label="Searches this month"
                      spent={quota.used}
                      limit={quota.limit}
                    />
                  )}
                </PanelFoot>
              </div>
            </Split>

            <Panel>
              <PanelHead>
                <div>
                  <PanelTitle>Reach against engagement quality</PanelTitle>
                  <p className="mt-0.5 text-sm text-ink-muted">
                    Every creator you track, plotted by observed audience size and
                    observed engagement rate. Colour is the SocialOrbit Health band.
                  </p>
                </div>
              </PanelHead>
              <PanelBody>
                <ReachQualityPlot
                  height={220}
                  ariaLabel="Tracked creators plotted by follower count against engagement rate"
                  points={portfolio.creators
                    .filter(
                      (creator) =>
                        creator.followers !== null && creator.engagementRate !== null,
                    )
                    .map((creator) => ({
                      id: creator.id,
                      name: creator.displayName,
                      x: creator.followers as number,
                      y: creator.engagementRate as number,
                      tone: (creator.healthScore === null
                        ? "neutral"
                        : ({
                            excellent: "positive",
                            strong: "brand",
                            fair: "caution",
                            weak: "critical",
                          }[healthBand(creator.healthScore)] as DistributionTone)),
                      detail:
                        creator.healthScore === null
                          ? "Not scored"
                          : `Health ${Math.round(creator.healthScore)} · confidence ${Math.round(creator.confidence)}%`,
                    }))}
                />
              </PanelBody>
              <PanelFoot>
                <span>
                  Audience is on a log scale — creator sizes span four orders of
                  magnitude, and a linear axis collapses everyone below a million into
                  the origin.
                </span>
              </PanelFoot>
            </Panel>

            <Panel>
              <PanelHead>
                <PanelTitle>Campaigns</PanelTitle>
                <Link
                  href="/campaigns"
                  className="rounded text-sm font-medium text-brand-ink hover:underline"
                >
                  View all
                </Link>
              </PanelHead>
              {campaigns.length === 0 ? (
                <PanelBody className="py-8">
                  <div className="mx-auto flex max-w-md flex-col items-center gap-3 text-center">
                    <Pipeline />
                    <div className="space-y-1">
                      <p className="text-base font-medium text-ink">No campaigns yet</p>
                      <p className="text-sm text-ink-muted">
                        Create a campaign to select creators, set a tracking hashtag, and
                        measure what each of them delivered.
                      </p>
                    </div>
                    <LinkButton href="/campaigns/new" variant="primary" size="sm">
                      Create campaign
                    </LinkButton>
                  </div>
                </PanelBody>
              ) : (
                <RowList>
                  {campaigns.slice(0, 5).map((campaign) => (
                    <li key={campaign.id}>
                      <Link
                        href={`/campaigns/${campaign.id}`}
                        className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 transition-colors hover:bg-sunken/70"
                      >
                        {/* Full width on a phone so the figures wrap to their
                            own line: at 390px the name and a three-column dl
                            fighting for one row squeezed the hashtag into an
                            ellipsis. */}
                        <div className="w-full min-w-0 sm:w-auto sm:flex-1">
                          <p className="flex flex-wrap items-center gap-2 font-medium text-ink">
                            {campaign.name}
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
                          </p>
                          <p className="mt-0.5 truncate text-sm text-ink-muted">
                            <span className="font-num">#{campaign.hashtag}</span>
                            <span aria-hidden> · </span>
                            {formatDate(campaign.startsOn)} – {formatDate(campaign.endsOn)}
                          </p>
                        </div>
                        <dl className="flex flex-wrap gap-x-6 gap-y-1 sm:shrink-0 sm:text-right">
                          <div>
                            <dt className="label-caps-sm text-ink-subtle">Creators</dt>
                            <dd className="font-num text-ink">
                              {campaign.confirmedCount}/{campaign.participantCount}
                            </dd>
                          </div>
                          <div>
                            <dt className="label-caps-sm text-ink-subtle">Posts</dt>
                            <dd className="font-num text-ink">
                              {formatCompact(campaign.attributedPosts)}
                            </dd>
                          </div>
                          <div>
                            <dt className="label-caps-sm text-ink-subtle">Reach</dt>
                            <dd className="font-num text-ink">
                              {formatCompact(campaign.totalReach)}
                            </dd>
                          </div>
                        </dl>
                      </Link>
                    </li>
                  ))}
                </RowList>
              )}
            </Panel>

            {portfolio.creators.length > 0 && (
              <Panel>
                <PanelHead>
                  <PanelTitle>Roster detail</PanelTitle>
                  <span className="text-sm text-ink-muted">
                    Ranked by SocialOrbit Health
                  </span>
                </PanelHead>
                <RowList>
                  {[...portfolio.creators]
                    .sort((a, b) => (b.healthScore ?? -1) - (a.healthScore ?? -1))
                    .map((creator) => (
                      <li key={creator.id}>
                        <Link
                          href={`/influencers/${creator.id}`}
                          className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-sunken/70"
                        >
                          <Avatar
                            name={creator.displayName}
                            src={creator.avatarUrl}
                            size="sm"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-base font-medium text-ink">
                              {creator.displayName}
                            </span>
                            <span className="block truncate text-sm text-ink-muted">
                              @{creator.primaryHandle}
                              <span aria-hidden> · </span>
                              {formatCompact(creator.followers)} followers
                            </span>
                          </span>
                          <span className="hidden shrink-0 text-right sm:block">
                            <span className="label-caps-sm block text-ink-subtle">
                              Engagement
                            </span>
                            <span className="font-num text-base text-ink">
                              {formatPercent(creator.engagementRate)}
                            </span>
                          </span>
                          <span className="hidden shrink-0 text-right md:block">
                            <span className="label-caps-sm block text-ink-subtle">
                              Confidence
                            </span>
                            <span className="font-num text-base text-ink">
                              {Math.round(creator.confidence)}%
                            </span>
                          </span>
                          <span className="shrink-0 text-right">
                            <span className="label-caps-sm block text-ink-subtle">
                              Health
                            </span>
                            <ScorePill value={creator.healthScore} label="Health" />
                          </span>
                        </Link>
                      </li>
                    ))}
                </RowList>
              </Panel>
            )}
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
    { title: "Discover", detail: "Search the indexed database by market, category, audience quality and campaign fit." },
    { title: "Understand", detail: "Read a creator's health, risk and confidence, and where every figure came from." },
    { title: "Shortlist", detail: "Save candidates, compare them side by side, and share the reasoning." },
    { title: "Measure", detail: "Run a campaign against a tracking hashtag and score what each creator delivered." },
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
              Every one carries a deterministic health score, a separate data-confidence
              reading and the provenance of each figure behind it. Start a search to build
              your first shortlist — nothing here is tracked until you save it.
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
                How SocialOrbit scores
              </LinkButton>
            </div>
          </div>
          <ol className="min-w-0 divide-y divide-instrument-line lg:border-l lg:border-instrument-line lg:pl-12">
            {steps.map((step, index) => (
              <li key={step.title} className="flex gap-3 py-3 first:pt-0 last:pb-0">
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
                  <span className="block text-sm text-instrument-muted">{step.detail}</span>
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
          <span className="rounded-md border border-line bg-sunken px-2 py-0.5">{step}</span>
        </span>
      ))}
    </div>
  );
}

// Quota and campaign figures are per-request and per-tenant; never statically cached.
export const dynamic = "force-dynamic";
