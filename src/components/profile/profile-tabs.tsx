"use client";

import * as React from "react";
import { Lock, Sparkles, TriangleAlert } from "lucide-react";
import type { InfluencerProfile } from "@/lib/contracts/influencer";
import type { Provenance } from "@/lib/contracts/common";
import {
  formatCompact,
  formatCurrencyRange,
  formatDuration,
  formatFrequency,
  formatNumber,
  formatPercent,
  formatRelativeTime,
  NO_VALUE,
} from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { AiPanel, Card, CardContent, CardHeader, CardTitle, Eyebrow } from "@/components/ui/card";
import { BuildingHistory, EmptyState, Notice } from "@/components/ui/states";
import { Tabs, TabPanel } from "@/components/ui/tabs";
import { Table, TableWrap, Tbody, Td, Th, Thead, Tr } from "@/components/ui/table";
import { DataRow, StatRow, StatTile } from "@/components/intelligence/stat";
import { ProvenanceMark } from "@/components/intelligence/provenance";
import { ScoreBar } from "@/components/intelligence/score";
import { CategoryBars, TrendChart } from "@/components/charts/trend-chart";

/* ---------------------------------------------------------------------------
 * Profile detail — DPR §9, §20.
 *
 * The tab strip is the only client state here; each panel is presentational.
 * Every metric that is not a direct platform measurement carries its
 * provenance mark, and anything the platform has not observed renders as an
 * em dash rather than a zero.
 * ------------------------------------------------------------------------ */

const TABS = [
  { value: "overview", label: "Overview" },
  { value: "growth", label: "Growth" },
  { value: "audience", label: "Audience" },
  { value: "content", label: "Content" },
  { value: "authenticity", label: "Authenticity" },
  { value: "benchmarks", label: "Benchmarks" },
] as const;

export function ProfileTabs({ profile }: { profile: InfluencerProfile }) {
  const [tab, setTab] = React.useState<string>("overview");

  const collected = profile.lastRefreshedAt ?? profile.createdAt;
  const observed: Provenance = {
    tier: profile.verification === "verified" ? "oauth_authorized" : "platform_api",
    kind: profile.verification === "verified" ? "verified" : "observed",
    collectedAt: collected,
    verifiedAt: null,
    sourceUrl: profile.socialAccounts[0]?.url ?? null,
    confidence: profile.confidence,
    ai: null,
  };
  const derived: Provenance = { ...observed, kind: "derived", verifiedAt: null };
  const estimated: Provenance = { ...observed, kind: "estimated", confidence: 45 };

  return (
    <div className="space-y-4">
      <Tabs items={[...TABS]} value={tab} onValueChange={setTab} label="Profile sections" />

      <TabPanel value="overview" active={tab === "overview"} className="space-y-4">
        <StatRow>
          <StatTile
            label="Followers"
            value={formatCompact(profile.glance.followers)}
            provenance={observed}
            emphasis
          />
          <StatTile
            label="Total views"
            value={formatCompact(profile.glance.totalViews)}
            provenance={observed}
          />
          <StatTile
            label="Median views"
            value={formatCompact(profile.glance.medianViews)}
            provenance={derived}
            hint="Median of recent content. Preferred over the mean because view counts are heavily skewed by outliers."
          />
          <StatTile
            label="Engagement"
            value={formatPercent(profile.glance.engagementRate)}
            provenance={derived}
            hint={
              profile.primaryPlatform === "youtube"
                ? "Interactions over views, the denominator YouTube reports."
                : "Interactions over followers. Instagram reach is only available on connected professional accounts."
            }
          />
          <StatTile
            label="Content indexed"
            value={formatCompact(profile.glance.contentCount)}
            provenance={observed}
          />
          <StatTile
            label="Upload freq."
            value={formatFrequency(profile.glance.uploadFrequency)}
            provenance={derived}
          />
          <StatTile
            label="Avg. length"
            value={formatDuration(profile.glance.averageContentLength)}
            provenance={observed}
          />
          <StatTile
            label="Est. reach/mo"
            value={formatCompact(profile.glance.estimatedMonthlyReach)}
            provenance={estimated}
            hint="A model estimate from median views and publishing cadence — not a measurement."
          />
        </StatRow>

        <div className="grid gap-4 lg:grid-cols-2">
          <HistoryCard
            title="Follower history"
            series={profile.followerHistory}
            valueKey="followers"
            valueLabel="followers"
          />
          <HistoryCard
            title="Total views"
            series={profile.followerHistory}
            valueKey="views"
            valueLabel="views"
          />
        </div>

        {profile.ai && (
          <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
            <Card>
              <CardHeader>
                <CardTitle>Profile intelligence</CardTitle>
                <Badge tone="inferred">
                  <Sparkles className="size-3" aria-hidden />
                  AI classified
                </Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-[13px] leading-5 text-ink">{profile.ai.summary}</p>
                <AiPanel className="space-y-2">
                  <Eyebrow className="text-inferred">Creator type</Eyebrow>
                  <p className="text-[13px] leading-5 text-ink">{profile.ai.creatorType}</p>
                  {profile.ai.audienceIntent && (
                    <>
                      <Eyebrow className="text-inferred">Audience intent</Eyebrow>
                      <p className="text-[13px] leading-5 text-ink">{profile.ai.audienceIntent}</p>
                    </>
                  )}
                </AiPanel>
                <div className="grid gap-4 sm:grid-cols-2">
                  <ListBlock title="Strengths" items={profile.ai.strengths} />
                  <ListBlock title="Risks" items={profile.ai.risks} tone="caution" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Commercial signals</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <ScoreBar label="Commercial intent" value={profile.ai.commercialIntent} />
                <ScoreBar label="Brand safety" value={profile.ai.brandSafetyScore} />
                <div>
                  <Eyebrow>Content themes</Eyebrow>
                  <ul className="mt-1.5 flex flex-wrap gap-1.5">
                    {profile.ai.contentThemes.map((theme) => (
                      <li key={theme}>
                        <Badge tone="inferred">{theme}</Badge>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <Eyebrow>Recommended industries</Eyebrow>
                  <ul className="mt-1.5 flex flex-wrap gap-1.5">
                    {profile.ai.recommendedIndustries.map((industry) => (
                      <li key={industry}>
                        <Badge tone="neutral">{industry}</Badge>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <Eyebrow>Sponsorship signals</Eyebrow>
                  <ul className="mt-1.5 space-y-1">
                    {profile.ai.sponsorshipSignals.map((signal) => (
                      <li key={signal} className="text-[12px] text-ink-muted">
                        {signal}
                      </li>
                    ))}
                  </ul>
                </div>
                {profile.glance.estimatedMonthlyEarnings && (
                  <div className="border-t border-line pt-3">
                    <div className="flex items-center justify-between gap-2">
                      <Eyebrow>Est. monthly earnings</Eyebrow>
                      <ProvenanceMark provenance={estimated} />
                    </div>
                    <p className="mt-1 font-mono text-[15px] tabular-nums text-ink">
                      {formatCurrencyRange(
                        profile.glance.estimatedMonthlyEarnings.low,
                        profile.glance.estimatedMonthlyEarnings.high,
                        profile.glance.estimatedMonthlyEarnings.currency,
                      )}
                    </p>
                    <p className="mt-0.5 text-[11px] text-ink-muted">
                      Modelled range, not a rate card. SocialOrbit does not hold this
                      creator&apos;s asking rate.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </TabPanel>

      <TabPanel value="growth" active={tab === "growth"} className="space-y-4">
        <StatRow>
          <StatTile
            label="Followers gained (7d)"
            value={formatNumber(profile.glance.followersGained7d)}
            provenance={derived}
            hint="Current snapshot minus the nearest snapshot at or before seven days ago."
          />
          <StatTile
            label="Views gained (7d)"
            value={formatNumber(profile.glance.viewsGained7d)}
            provenance={derived}
          />
          <StatTile
            label="Snapshots held"
            value={formatNumber(profile.followerHistory.points.length)}
            footnote={`since ${formatRelativeTime(profile.followerHistory.firstObservedAt)}`}
          />
          <StatTile
            label="Growth pattern"
            value={
              profile.health.components.find((c) => c.key === "growthPattern")?.available
                ? Math.round(
                    profile.health.components.find((c) => c.key === "growthPattern")!.value,
                  )
                : NO_VALUE
            }
            provenance={derived}
            hint="Rewards steady accumulation; penalises the step changes typical of purchased audience."
          />
        </StatRow>

        <HistoryCard
          title="Follower history"
          series={profile.followerHistory}
          valueKey="followers"
          valueLabel="followers"
          height={260}
        />
      </TabPanel>

      <TabPanel value="audience" active={tab === "audience"} className="space-y-4">
        {!profile.audience.available ? (
          <Card>
            <EmptyState
              icon={Lock}
              title="Audience demographics are not available"
              description={profile.audience.reason}
            />
          </Card>
        ) : (
          <>
            <Notice tone="info" icon={Sparkles} title="First-party data">
              These figures come from the creator&apos;s connected professional account, not
              from estimation. Collected{" "}
              {formatRelativeTime(profile.audience.provenance?.collectedAt ?? null)}.
            </Notice>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <ShareCard title="Top countries" rows={profile.audience.countries.map((c) => ({ label: c.name, share: c.share }))} />
              <ShareCard title="Languages" rows={profile.audience.languages.map((l) => ({ label: l.name, share: l.share }))} />
              <ShareCard title="Age" rows={profile.audience.ageBands.map((a) => ({ label: a.band, share: a.share }))} />
              <ShareCard title="Gender" rows={profile.audience.gender.map((g) => ({ label: g.label, share: g.share }))} />
            </div>
          </>
        )}
      </TabPanel>

      <TabPanel value="content" active={tab === "content"} className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Top performing content</CardTitle>
            <span className="text-[12px] text-ink-muted">
              Performance index is views as a multiple of this creator&apos;s own median
            </span>
          </CardHeader>
          {profile.topContent.length === 0 ? (
            <EmptyState
              title="No content indexed yet"
              description="Content appears here after the first successful ingestion run."
            />
          ) : (
            <>
              <CardContent className="pb-0">
                <CategoryBars
                  data={profile.topContent.slice(0, 6).map((item, index) => ({
                    label: `#${index + 1}`,
                    value: item.views ?? 0,
                  }))}
                  valueLabel="views"
                  ariaLabel="Views of the six best performing recent posts"
                  height={150}
                />
              </CardContent>
              <ContentTable items={profile.topContent} />
            </>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent content</CardTitle>
          </CardHeader>
          <ContentTable items={profile.recentContent} />
        </Card>
      </TabPanel>

      <TabPanel value="authenticity" active={tab === "authenticity"} className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
          <Card>
            <CardHeader>
              <CardTitle>Audience quality signals</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <ScoreBar label="Estimated bot risk (lower is safer)" value={profile.riskSignals.botRisk} />
              <ScoreBar label="Inactive audience (lower is safer)" value={profile.riskSignals.inactiveAudience} />
              <ScoreBar label="View anomaly score" value={profile.riskSignals.viewAnomaly} />
              <p className="border-t border-line pt-3 text-[12px] text-ink-muted">
                These are 0–100 risk <em>signals</em> derived from measurable indicators.
                SocialOrbit deliberately does not publish a &ldquo;% fake followers&rdquo;
                figure — no available data source supports that claim.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Evidence</CardTitle>
              <Badge tone="neutral" className="font-mono">
                risk-1.0.0
              </Badge>
            </CardHeader>
            <ul className="divide-y divide-line">
              {profile.riskSignals.evidence.map((item) => (
                <li key={item.signal} className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <p className="text-[13px] font-medium text-ink">{item.signal}</p>
                    <Badge tone={item.weight === "primary" ? "brand" : "neutral"}>
                      {item.weight}
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-[12px] leading-5 text-ink-muted">
                    {item.observation}
                  </p>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        {profile.ai && profile.ai.evidence.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>AI classification evidence</CardTitle>
              <Badge tone="inferred">
                {profile.ai.provider} {profile.ai.model}
              </Badge>
            </CardHeader>
            <TableWrap label="AI evidence">
              <Table>
                <Thead>
                  <Tr>
                    <Th>Claim</Th>
                    <Th>Source</Th>
                    <Th numeric>Confidence</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {profile.ai.evidence.map((item) => (
                    <Tr key={item.claim}>
                      <Td>{item.claim}</Td>
                      <Td>
                        {item.sourceUrl ? (
                          <a
                            href={item.sourceUrl}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="rounded text-brand-ink hover:underline"
                          >
                            {new URL(item.sourceUrl).hostname}
                          </a>
                        ) : (
                          NO_VALUE
                        )}
                      </Td>
                      <Td numeric>{Math.round(item.confidence * 100)}%</Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </TableWrap>
          </Card>
        )}
      </TabPanel>

      <TabPanel value="benchmarks" active={tab === "benchmarks"} className="space-y-4">
        {!profile.benchmarks ? (
          <Card>
            <EmptyState
              icon={TriangleAlert}
              title="No cohort to benchmark against"
              description="Benchmarks compare a creator with others in the same category and follower band. There are not enough indexed creators in this cohort yet."
            />
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>
                {profile.benchmarks.category} · {profile.benchmarks.followerBand}
              </CardTitle>
              <span className="text-[12px] text-ink-muted">
                Cohort of {profile.benchmarks.cohortSize} creators
              </span>
            </CardHeader>
            <TableWrap label="Category benchmarks">
              <Table>
                <Thead>
                  <Tr>
                    <Th>Metric</Th>
                    <Th numeric>This creator</Th>
                    <Th numeric>Category median</Th>
                    <Th numeric>Top 25%</Th>
                    <Th numeric>Top 10%</Th>
                    <Th numeric>Percentile</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {profile.benchmarks.metrics.map((metric) => (
                    <Tr key={metric.key}>
                      <Td>{metric.label}</Td>
                      <Td numeric className="font-medium">
                        {formatCompact(metric.value)}
                      </Td>
                      <Td numeric>{formatCompact(metric.categoryMedian)}</Td>
                      <Td numeric>{formatCompact(metric.top25)}</Td>
                      <Td numeric>{formatCompact(metric.top10)}</Td>
                      <Td numeric>
                        <span
                          className={
                            metric.percentile >= 75
                              ? "text-positive"
                              : metric.percentile >= 40
                                ? "text-ink"
                                : "text-caution"
                          }
                        >
                          {Math.round(metric.percentile)}
                        </span>
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </TableWrap>
          </Card>
        )}
      </TabPanel>
    </div>
  );
}

/* --- Building blocks ---------------------------------------------------- */

function HistoryCard({
  title,
  series,
  valueKey,
  valueLabel,
  height = 180,
}: {
  title: string;
  series: InfluencerProfile["followerHistory"];
  valueKey: "followers" | "views";
  valueLabel: string;
  height?: number;
}) {
  const data = series.points.map((point) => ({ date: point.date, value: point[valueKey] }));
  const measurable = data.filter((point) => point.value !== null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {series.sufficient && measurable.length > 1 && (
          <span className="font-mono text-[12px] tabular-nums text-ink-muted">
            {formatCompact(measurable[0].value)} → {formatCompact(measurable[measurable.length - 1].value)}
          </span>
        )}
      </CardHeader>
      <CardContent>
        {!series.sufficient || measurable.length < 2 ? (
          <BuildingHistory
            observed={measurable.length}
            required={series.minimumPoints}
          />
        ) : (
          <TrendChart
            data={data}
            valueLabel={valueLabel}
            height={height}
            ariaLabel={`${title}: ${valueLabel} over time`}
          />
        )}
      </CardContent>
    </Card>
  );
}

function ContentTable({ items }: { items: InfluencerProfile["topContent"] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        title="No content in this window"
        description="Nothing has been indexed for the selected period."
      />
    );
  }

  return (
    <TableWrap label="Content performance">
      <Table>
        <Thead>
          <Tr>
            <Th>Title</Th>
            <Th>Published</Th>
            <Th numeric>Views</Th>
            <Th numeric>Likes</Th>
            <Th numeric>Comments</Th>
            <Th numeric>Engagement</Th>
            <Th numeric>Index</Th>
          </Tr>
        </Thead>
        <Tbody>
          {items.map((item) => (
            <Tr key={item.id}>
              <Td className="max-w-72">
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="block truncate rounded font-medium text-ink hover:text-brand-ink hover:underline"
                  title={item.title}
                >
                  {item.title}
                </a>
                {item.isSponsored && (
                  <Badge tone="neutral" className="mt-0.5">
                    Sponsored
                  </Badge>
                )}
              </Td>
              <Td className="whitespace-nowrap text-ink-muted">
                {formatRelativeTime(item.publishedAt)}
              </Td>
              <Td numeric>{formatCompact(item.views)}</Td>
              <Td numeric>{formatCompact(item.likes)}</Td>
              <Td numeric>{formatCompact(item.comments)}</Td>
              <Td numeric>{formatPercent(item.engagementRate)}</Td>
              <Td numeric>
                <span
                  className={
                    item.performanceIndex === null
                      ? "text-ink-subtle"
                      : item.performanceIndex >= 1.5
                        ? "text-positive"
                        : item.performanceIndex < 0.5
                          ? "text-caution"
                          : "text-ink"
                  }
                >
                  {item.performanceIndex === null ? NO_VALUE : `${item.performanceIndex.toFixed(2)}×`}
                </span>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </TableWrap>
  );
}

function ShareCard({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; share: number }[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[14px]">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map((row) => (
          <div key={row.label} className="space-y-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-[12px] text-ink">{row.label}</span>
              <span className="shrink-0 font-mono text-[12px] tabular-nums text-ink-muted">
                {row.share.toFixed(1)}%
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full bg-series-1"
                style={{ width: `${Math.min(100, row.share)}%` }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ListBlock({
  title,
  items,
  tone = "neutral",
}: {
  title: string;
  items: string[];
  tone?: "neutral" | "caution";
}) {
  return (
    <div>
      <Eyebrow>{title}</Eyebrow>
      <ul className="mt-1.5 space-y-1.5">
        {items.map((item) => (
          <li key={item} className="flex gap-2 text-[12px] leading-5 text-ink-muted">
            <span
              className={`mt-1.5 size-1 shrink-0 rounded-full ${
                tone === "caution" ? "bg-caution" : "bg-positive"
              }`}
              aria-hidden
            />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Rendered under the profile: the composition of what the reader just read. */
export function ProvenanceFooter({ profile }: { profile: InfluencerProfile }) {
  return (
    <div className="grid gap-2 border-t border-line pt-3 text-[12px] text-ink-muted sm:grid-cols-2">
      <DataRow label="Score version" value={profile.health.scoreVersion} />
      <DataRow label="Formula version" value={profile.health.formulaVersion} />
      <DataRow
        label="Confidence"
        value={`${Math.round(profile.confidenceDetail.score)}% (${profile.confidenceDetail.band})`}
      />
      <DataRow label="Last refresh" value={formatRelativeTime(profile.lastRefreshedAt)} />
    </div>
  );
}
