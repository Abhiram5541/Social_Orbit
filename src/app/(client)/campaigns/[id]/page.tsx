import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ClipboardList, ExternalLink, Hash } from "lucide-react";
import {
  CAMPAIGN_STATUS_LABEL,
  DELIVERABLE_FORMAT_LABEL,
  FULFILMENT_LABEL,
  type CampaignDetail,
  type CampaignParticipant,
} from "@/lib/contracts/campaign";
import { PLATFORM_LABEL } from "@/lib/contracts/common";
import {
  formatCompact,
  formatCurrency,
  formatDate,
  formatPercent,
  formatRelativeTime,
  pluralise,
  NO_VALUE,
} from "@/lib/format";
import { can, requirePagePermission } from "@/server/auth/rbac";
import { campaignSentiment, sentimentBlockedReason } from "@/server/services/sentiment-service";
import { getCampaign } from "@/server/repositories/workspace-repository";
import { Download } from "lucide-react";
import { PageBody, PageHeader } from "@/components/shell/app-shell";
import { LinkButton } from "@/components/ui/button";
import { PrintButton } from "@/components/ui/print-button";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InfoHint } from "@/components/ui/overlay";
import { EmptyState } from "@/components/ui/states";
import { Table, TableWrap, Tbody, Td, Th, Thead, Tr } from "@/components/ui/table";
import { ScorePill, ScoreRing } from "@/components/intelligence/score";
import { SentimentPanel } from "@/components/listening/sentiment-panel";
import { StatRow, StatTile } from "@/components/intelligence/stat";
import { CategoryBars } from "@/components/charts/trend-chart";
import {
  CAMPAIGN_STATUS_TONE,
  PARTICIPANT_STATUS_LABEL,
  PARTICIPANT_TONE,
} from "@/components/campaign/status";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  await params;
  return { title: "Campaign" };
}

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requirePagePermission("campaign:read", `/campaigns/${id}`);

  const campaign = getCampaign(user, id);
  if (!campaign) notFound();

  const delivered = campaign.participants.filter(
    (participant) => participant.performance.attributedPosts > 0,
  );
  const engagements =
    campaign.totalEngagements === null ? null : campaign.totalEngagements;
  const costPerEngagement =
    engagements && engagements > 0 && campaign.spentAmount
      ? campaign.spentAmount / engagements
      : null;

  // The calibration label reads the stored formulaVersion off the records —
  // never a constant, which would become a lie on the first formula bump. If
  // versions ever mix across participants, the label states the range.
  const versions = [
    ...new Set(campaign.participants.map((p) => p.performance.formulaVersion)),
  ].sort();
  const versionLabel =
    versions.length === 0
      ? null
      : versions.length === 1
        ? versions[0]
        : `${versions[0]} – ${versions[versions.length - 1]}`;

  // Absent is not zero (D13): a creator whose score or reach was never
  // computed gets no bar, not a measured-looking zero-height one.
  const scored = delivered.filter((p) => p.performance.campaignScore !== null);
  const unscored = delivered.length - scored.length;
  // Views, not reach: these platform APIs publish a view count and no reach
  // figure, so the column names what was actually observed.
  const viewsMeasured = delivered.filter((p) => p.performance.views !== null);

  return (
    <>
      <PageHeader
        title={campaign.name}
        breadcrumbs={[{ label: "Campaigns", href: "/campaigns" }, { label: campaign.name }]}
        description={campaign.brief ?? undefined}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={CAMPAIGN_STATUS_TONE[campaign.status]} dot={campaign.status === "live"}>
              {CAMPAIGN_STATUS_LABEL[campaign.status]}
            </Badge>
            <LinkButton
              href={`/api/internal/campaigns/${campaign.id}/export`}
              variant="ghost"
              className="gap-1.5 print:hidden"
            >
              <Download className="size-4" aria-hidden />
              Export CSV
            </LinkButton>
            <PrintButton />
          </div>
        }
        meta={
          <span className="flex max-w-full flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted sm:justify-end">
            <span className="inline-flex items-center gap-1 rounded border border-line bg-sunken px-1.5 py-0.5 font-num text-ink">
              <Hash className="size-3" aria-hidden />
              {campaign.hashtag}
            </span>
            <span>
              {formatDate(campaign.startsOn)} – {formatDate(campaign.endsOn)}
            </span>
            <span>{campaign.platforms.map((p) => PLATFORM_LABEL[p]).join(", ")}</span>
          </span>
        }
      />

      <PageBody className="space-y-4">
        <div className="grid items-start gap-3 lg:grid-cols-[minmax(21rem,2fr)_3fr]">
          <CampaignInstrument
            campaign={campaign}
            deliveredCount={delivered.length}
            costPerEngagement={costPerEngagement}
            versionLabel={versionLabel}
          />
          <StatRow>
            <StatTile
              label="Engagements"
              value={formatCompact(campaign.totalEngagements)}
              footnote="on attributed posts"
            />
            <StatTile
              label="Committed spend"
              value={formatCurrency(campaign.spentAmount, campaign.budgetCurrency, { compact: true })}
              footnote={
                campaign.budgetAmount
                  ? `of ${formatCurrency(campaign.budgetAmount, campaign.budgetCurrency, { compact: true })} budget`
                  : "no budget recorded"
              }
            />
            <StatTile
              label="Creators confirmed"
              value={`${campaign.confirmedCount}/${campaign.participantCount}`}
              footnote={`${delivered.length} delivering`}
            />
            <StatTile
              label="Budget remaining"
              value={
                campaign.budgetAmount === null || campaign.spentAmount === null
                  ? NO_VALUE
                  : formatCurrency(
                      campaign.budgetAmount - campaign.spentAmount,
                      campaign.budgetCurrency,
                      { compact: true },
                    )
              }
              footnote={
                campaign.budgetAmount === null
                  ? "budget not set"
                  : "committed rates, not invoices"
              }
            />
          </StatRow>
        </div>

        <SentimentPanel
          record={campaignSentiment(user, campaign.id)}
          blocked={sentimentBlockedReason()}
          subject={{ kind: "campaign", id: campaign.id }}
          canRun={can(user, "campaign:write")}
        />

        <Card>
          <CardHeader>
            <CardTitle>Creator performance</CardTitle>
          </CardHeader>
          <TableWrap label="Campaign participants">
            <Table>
              <Thead>
                <Tr>
                  <Th>Creator</Th>
                  <Th>Status</Th>
                  <Th numeric>Talent rate</Th>
                  <Th numeric>Our rate</Th>
                  <Th numeric>Agreed</Th>
                  <Th numeric>Posts</Th>
                  <Th>Deliverables</Th>
                  <Th numeric>Views</Th>
                  <Th numeric>Engagement</Th>
                  <Th numeric>Cost / eng.</Th>
                  {/* A `th` takes its accessible name from its content, so
                      without this the hint's label was announced as part of
                      the column name. The hint keeps its own name as a
                      separately focusable control. */}
                  <Th numeric aria-label="Campaign score">
                    <span className="inline-flex items-center gap-1">
                      Campaign score
                      {/* The reset stops the tooltip body inheriting the
                          header's label-caps transform and tracking. */}
                      <span className="font-normal normal-case tracking-normal">
                        <InfoHint label="How campaign score relates to Health">
                          A creator&apos;s campaign performance is scored separately from
                          their SENSO Health — the first answers &ldquo;how did they
                          do for us?&rdquo;, the second &ldquo;who are they?&rdquo;. The two
                          are never merged.
                        </InfoHint>
                      </span>
                    </span>
                  </Th>
                  <Th numeric>Health</Th>
                </Tr>
              </Thead>
              <Tbody>
                {campaign.participants.map((participant) => (
                  <ParticipantRow key={participant.id} participant={participant} />
                ))}
              </Tbody>
            </Table>
          </TableWrap>
          <CardContent className="border-t border-line text-sm text-ink-muted">
            Rates are values your team recorded. SENSO does not hold creators&apos;
            asking rates and never infers them.
          </CardContent>
        </Card>

        {delivered.length > 0 && (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Campaign score by creator</CardTitle>
              </CardHeader>
              <CardContent>
                {scored.length > 0 ? (
                  <CategoryBars
                    data={scored.map((participant) => ({
                      label: `@${participant.primaryHandle}`,
                      value: participant.performance.campaignScore as number,
                    }))}
                    valueLabel="campaign score"
                    format="integer"
                    // The full scale, so 62 against 68 reads as what it is
                    // rather than being stretched across the whole chart.
                    domain={[0, 100]}
                    ariaLabel="Campaign performance score for each delivering creator"
                    height={200}
                  />
                ) : (
                  <EmptyState
                    variant="panel"
                    title="No campaign scores yet"
                    description="Every delivered creator is still unscored — scores appear once the formula has run."
                  />
                )}
                {scored.length > 0 && unscored > 0 && (
                  <p className="mt-2 text-sm text-ink-muted">
                    {pluralise(unscored, "creator")} delivered but{" "}
                    {unscored === 1 ? "is" : "are"} not yet scored.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Views by creator</CardTitle>
              </CardHeader>
              <CardContent>
                {viewsMeasured.length > 0 ? (
                  <CategoryBars
                    data={viewsMeasured.map((participant) => ({
                      label: `@${participant.primaryHandle}`,
                      value: participant.performance.views as number,
                    }))}
                    valueLabel="views"
                    ariaLabel="Attributed views for each delivering creator"
                    height={200}
                  />
                ) : (
                  <EmptyState
                    variant="panel"
                    title="No views measured yet"
                    description="Views appear once attributed posts report them."
                  />
                )}
              </CardContent>
            </Card>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Deliverables</CardTitle>
            <span className="text-sm text-ink-muted">
              {campaign.deliverables.length === 0
                ? "None set"
                : `Asked of each of ${pluralise(campaign.participants.length, "participant")}`}
            </span>
          </CardHeader>
          {campaign.deliverables.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="No deliverables set"
              description="Set what each creator owes — a video, a reel, a story — and fulfilment is counted from the posts the tracker attributes, never from a status someone sets by hand."
            />
          ) : (
            <TableWrap label="Campaign deliverables">
              <Table>
                <Thead>
                  <Tr>
                    <Th>Deliverable</Th>
                    <Th>Platform</Th>
                    <Th>Format</Th>
                    <Th numeric>Per creator</Th>
                    <Th>Due</Th>
                    <Th numeric>Published</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {campaign.deliverables.map((deliverable) => (
                    <Tr key={deliverable.id}>
                      <Td className="font-medium text-ink">{deliverable.label}</Td>
                      <Td>{PLATFORM_LABEL[deliverable.platform]}</Td>
                      <Td>{DELIVERABLE_FORMAT_LABEL[deliverable.format]}</Td>
                      <Td numeric>{deliverable.quantity}</Td>
                      <Td className="whitespace-nowrap">
                        {deliverable.dueOn ? formatDate(deliverable.dueOn) : NO_VALUE}
                      </Td>
                      {/* Fulfilment is counted per creator against the whole
                          requirement set, so a per-row published count would
                          imply an attribution this platform cannot make: a
                          post carries the campaign hashtag, not the
                          deliverable it satisfies. */}
                      <Td numeric className="text-ink-subtle">
                        {NO_VALUE}
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </TableWrap>
          )}
          <p className="border-t border-rule px-4 py-2.5 text-sm text-ink-muted">
            Campaign fulfilment{" "}
            <span className="font-num text-ink">
              {campaign.fulfilmentPercent === null
                ? NO_VALUE
                : `${campaign.fulfilmentPercent}%`}
            </span>{" "}
            — attributed posts against every participant&apos;s requirement.
          </p>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Attributed content</CardTitle>
            <span className="text-sm text-ink-muted">
              Posts matched to #{campaign.hashtag}
            </span>
          </CardHeader>
          {campaign.attributedContent.length === 0 ? (
            <EmptyState
              icon={Hash}
              title="No posts matched yet"
              description={`The tracker scans participating creators' published content for #${campaign.hashtag}. Nothing has matched so far.`}
            />
          ) : (
            <TableWrap label="Attributed posts">
              <Table>
                <Thead>
                  <Tr>
                    <Th>Creator</Th>
                    <Th>Caption</Th>
                    <Th>Platform</Th>
                    <Th>Published</Th>
                    <Th numeric>Views</Th>
                    <Th numeric>Engagements</Th>
                    <Th>Matched</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {campaign.attributedContent.map((post) => (
                    <Tr key={post.id}>
                      <Td>
                        <Link
                          href={`/influencers/${post.influencerId}`}
                          className="rounded font-medium text-ink hover:text-brand-ink hover:underline"
                        >
                          {post.influencerName}
                        </Link>
                      </Td>
                      <Td className="max-w-72">
                        <a
                          href={post.url}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="inline-flex max-w-full items-center gap-1 rounded text-ink-muted hover:text-brand-ink hover:underline"
                        >
                          <span className="truncate">{post.caption}</span>
                          <ExternalLink className="size-3 shrink-0" aria-hidden />
                        </a>
                      </Td>
                      <Td>{PLATFORM_LABEL[post.platform]}</Td>
                      <Td className="whitespace-nowrap text-sm text-ink-muted">
                        {formatRelativeTime(post.publishedAt)}
                      </Td>
                      <Td numeric>{formatCompact(post.views)}</Td>
                      <Td numeric>{formatCompact(post.engagements)}</Td>
                      <Td className="whitespace-nowrap text-sm text-ink-muted">
                        {formatRelativeTime(post.matchedAt)}
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </TableWrap>
          )}
        </Card>
      </PageBody>
    </>
  );
}

/* ---------------------------------------------------------------------------
 * The campaign delivery readout — the page's one instrument surface, so
 * campaign detail rhymes with the influencer profile (health-panel.tsx).
 *
 * No campaign-level score exists in the contract, and none may be computed
 * here (§6: scores come from versioned backend formulas, with components
 * stored). So the ring sweeps delivery coverage — the share of participants
 * with at least one attributed post — a measured 0–100 quantity, and the
 * headline figure is the attributed-post count itself.
 * ------------------------------------------------------------------------ */

function CampaignInstrument({
  campaign,
  deliveredCount,
  costPerEngagement,
  versionLabel,
}: {
  campaign: CampaignDetail;
  deliveredCount: number;
  costPerEngagement: number | null;
  versionLabel: string | null;
}) {
  const coverage =
    campaign.participantCount > 0
      ? (deliveredCount / campaign.participantCount) * 100
      : null;

  return (
    <section className="animate-rise flex flex-col relative overflow-hidden rounded-2xl bg-instrument text-instrument-ink shadow-instrument before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-white/8">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-instrument-line px-4 py-2.5">
        <div className="flex items-center gap-2">
          <h2 className="label-caps text-instrument-muted">Campaign delivery</h2>
          <InfoHint label="How these figures are attributed">
            Only posts carrying <span className="font-num">#{campaign.hashtag}</span> are
            counted. Campaign performance is scored separately from SENSO Health, and
            the two are never merged.
          </InfoHint>
        </div>
        {versionLabel && (
          <span
            className="font-num text-xs text-instrument-muted"
            title="Campaign score formula version"
          >
            {versionLabel}
          </span>
        )}
      </header>

      <div className="flex flex-1 flex-wrap items-center gap-x-5 gap-y-4 p-5">
        <ScoreRing value={coverage} size={104} tone="instrument" label="Delivery coverage" />
        <div className="min-w-0 space-y-1.5">
          <p className="flex items-baseline gap-2">
            <span className="font-num text-title font-medium">{campaign.attributedPosts}</span>
            <span className="label-caps-sm text-instrument-muted">attributed posts</span>
          </p>
          <p className="max-w-56 text-sm leading-5 text-instrument-muted">
            {deliveredCount} of {campaign.participantCount} creators have delivered against{" "}
            <span className="font-num">#{campaign.hashtag}</span>.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-8 gap-y-3 border-t border-instrument-line px-5 py-3">
        <InstrumentFigure
          label="Cost per engagement"
          value={
            costPerEngagement === null
              ? NO_VALUE
              : formatCurrency(costPerEngagement, campaign.budgetCurrency)
          }
          note="agreed rates ÷ attributed engagements"
        />
        <InstrumentFigure label="Reach" value={formatCompact(campaign.totalReach)} />
      </div>
    </section>
  );
}

/** A labelled figure on the instrument — the housing's repeating unit. */
function InstrumentFigure({
  label,
  value,
  note,
}: {
  label: string;
  value: ReactNode;
  note?: string;
}) {
  return (
    <div className="min-w-28 space-y-0.5">
      <p className="label-caps-sm text-instrument-muted">{label}</p>
      <p className="font-num text-md font-semibold text-instrument-ink">{value}</p>
      {note && <p className="text-2xs text-instrument-muted">{note}</p>}
    </div>
  );
}

function ParticipantRow({ participant }: { participant: CampaignParticipant }) {
  const { performance } = participant;
  const gap =
    participant.talentRate !== null && participant.clientRate !== null
      ? participant.talentRate - participant.clientRate
      : null;

  return (
    <Tr>
      <Td>
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar name={participant.displayName} src={participant.avatarUrl} size="sm" />
          <div className="min-w-0">
            <Link
              href={`/influencers/${participant.influencerId}`}
              className="block truncate rounded font-medium text-ink hover:text-brand-ink hover:underline"
            >
              {participant.displayName}
            </Link>
            <p className="truncate text-sm text-ink-muted">
              <span className="font-num">@{participant.primaryHandle}</span> ·{" "}
              <span className="font-num">{formatCompact(participant.followers)}</span> followers
            </p>
          </div>
        </div>
      </Td>
      <Td>
        <Badge tone={PARTICIPANT_TONE[participant.status]}>
          {PARTICIPANT_STATUS_LABEL[participant.status]}
        </Badge>
      </Td>
      <Td numeric>{formatCurrency(participant.talentRate, participant.currency, { compact: true })}</Td>
      <Td numeric>
        {formatCurrency(participant.clientRate, participant.currency, { compact: true })}
        {gap !== null && gap > 0 && (
          <span className="block text-xs font-normal text-caution">
            gap {formatCurrency(gap, participant.currency, { compact: true })}
          </span>
        )}
      </Td>
      <Td numeric className="font-medium">
        {formatCurrency(participant.agreedRate, participant.currency, { compact: true })}
      </Td>
      <Td numeric>{performance.attributedPosts}</Td>
      <Td>
        {participant.fulfilment.state === "none_required" ? (
          <span className="text-ink-subtle">{NO_VALUE}</span>
        ) : (
          <span className="flex items-center gap-1.5 whitespace-nowrap">
            <Badge
              tone={
                participant.fulfilment.state === "fulfilled"
                  ? "positive"
                  : participant.fulfilment.state === "missed"
                    ? "critical"
                    : "neutral"
              }
            >
              {FULFILMENT_LABEL[participant.fulfilment.state]}
            </Badge>
            <span className="font-num text-sm text-ink-muted">
              {participant.fulfilment.published}/{participant.fulfilment.required}
            </span>
          </span>
        )}
      </Td>
      <Td numeric>{formatCompact(performance.views)}</Td>
      <Td numeric>{formatPercent(performance.engagementRate)}</Td>
      <Td numeric>
        {performance.costPerEngagement === null
          ? NO_VALUE
          : formatCurrency(performance.costPerEngagement, participant.currency)}
      </Td>
      <Td numeric>
        <ScorePill value={performance.campaignScore} label="Campaign score" />
      </Td>
      <Td numeric>
        <ScorePill value={participant.healthScore} label="Health" />
      </Td>
    </Tr>
  );
}
