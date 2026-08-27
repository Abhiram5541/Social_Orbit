import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, Hash, Info } from "lucide-react";
import {
  CAMPAIGN_STATUS_LABEL,
  type CampaignParticipant,
  type ParticipantStatus,
} from "@/lib/contracts/campaign";
import { PLATFORM_LABEL } from "@/lib/contracts/common";
import {
  formatCompact,
  formatCurrency,
  formatDate,
  formatPercent,
  formatRelativeTime,
  NO_VALUE,
} from "@/lib/format";
import { requirePagePermission } from "@/server/auth/rbac";
import { getCampaign } from "@/server/repositories/workspace-repository";
import { PageBody, PageHeader } from "@/components/shell/app-shell";
import { Avatar } from "@/components/ui/avatar";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, Notice } from "@/components/ui/states";
import { Table, TableWrap, Tbody, Td, Th, Thead, Tr } from "@/components/ui/table";
import { ScorePill } from "@/components/intelligence/score";
import { StatRow, StatTile } from "@/components/intelligence/stat";
import { CategoryBars } from "@/components/charts/trend-chart";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  await params;
  return { title: "Campaign" };
}

const PARTICIPANT_TONE: Record<ParticipantStatus, BadgeTone> = {
  shortlisted: "neutral",
  invited: "neutral",
  negotiating: "caution",
  confirmed: "brand",
  delivering: "brand",
  delivered: "positive",
  declined: "critical",
};

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

  return (
    <>
      <PageHeader
        title={campaign.name}
        breadcrumbs={[{ label: "Campaigns", href: "/campaigns" }, { label: campaign.name }]}
        description={campaign.brief ?? undefined}
        actions={
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
        }
        meta={
          <span className="flex max-w-full flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink-muted sm:justify-end">
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
        <Notice tone="info" icon={Info} title="How these figures are attributed">
          Only posts carrying <span className="font-num">#{campaign.hashtag}</span> are counted.
          A creator&apos;s campaign performance is scored separately from their SocialOrbit
          Health — the first answers &ldquo;how did they do for us?&rdquo;, the second
          &ldquo;who are they?&rdquo;. The two are never merged.
        </Notice>

        <StatRow>
          <StatTile
            label="Attributed posts"
            value={campaign.attributedPosts}
            footnote={`from ${delivered.length} of ${campaign.participantCount} creators`}
            emphasis
          />
          <StatTile label="Reach" value={formatCompact(campaign.totalReach)} />
          <StatTile label="Engagements" value={formatCompact(campaign.totalEngagements)} />
          <StatTile
            label="Committed spend"
            value={formatCurrency(campaign.spentAmount, campaign.budgetCurrency, { compact: true })}
            footnote={
              campaign.budgetAmount
                ? `of ${formatCurrency(campaign.budgetAmount, campaign.budgetCurrency, { compact: true })} budget`
                : undefined
            }
          />
          <StatTile
            label="Cost per engagement"
            value={
              costPerEngagement === null
                ? NO_VALUE
                : formatCurrency(costPerEngagement, campaign.budgetCurrency)
            }
            footnote="agreed rates ÷ attributed engagements"
          />
        </StatRow>

        <Card>
          <CardHeader>
            <CardTitle>Creator performance</CardTitle>
            <span className="text-[12px] text-ink-muted">
              Campaign score is deterministic and versioned — campaign-1.0.0
            </span>
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
                  <Th numeric>Reach</Th>
                  <Th numeric>Engagement</Th>
                  <Th numeric>Cost / eng.</Th>
                  <Th numeric>Campaign score</Th>
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
          <CardContent className="border-t border-line text-[12px] text-ink-muted">
            Rates are values your team recorded. SocialOrbit does not hold creators&apos;
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
                <CategoryBars
                  data={delivered.map((participant) => ({
                    label: participant.displayName.split(" ")[0],
                    value: participant.performance.campaignScore ?? 0,
                  }))}
                  valueLabel="campaign score"
                  format="integer"
                  ariaLabel="Campaign performance score for each delivering creator"
                  height={200}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Reach by creator</CardTitle>
              </CardHeader>
              <CardContent>
                <CategoryBars
                  data={delivered.map((participant) => ({
                    label: participant.displayName.split(" ")[0],
                    value: participant.performance.reach ?? 0,
                  }))}
                  valueLabel="reach"
                  ariaLabel="Attributed reach for each delivering creator"
                  height={200}
                />
              </CardContent>
            </Card>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Attributed content</CardTitle>
            <span className="text-[12px] text-ink-muted">
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
                      <Td className="whitespace-nowrap text-[12px] text-ink-muted">
                        {formatRelativeTime(post.publishedAt)}
                      </Td>
                      <Td numeric>{formatCompact(post.views)}</Td>
                      <Td numeric>{formatCompact(post.engagements)}</Td>
                      <Td className="whitespace-nowrap text-[12px] text-ink-muted">
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
            <p className="truncate text-[12px] text-ink-muted">
              <span className="font-num">@{participant.primaryHandle}</span> ·{" "}
              {formatCompact(participant.followers)} followers
            </p>
          </div>
        </div>
      </Td>
      <Td>
        <Badge tone={PARTICIPANT_TONE[participant.status]}>
          {participant.status.replace("_", " ")}
        </Badge>
      </Td>
      <Td numeric>{formatCurrency(participant.talentRate, participant.currency, { compact: true })}</Td>
      <Td numeric>
        {formatCurrency(participant.clientRate, participant.currency, { compact: true })}
        {gap !== null && gap > 0 && (
          <span className="block text-[11px] font-normal text-caution">
            gap {formatCurrency(gap, participant.currency, { compact: true })}
          </span>
        )}
      </Td>
      <Td numeric className="font-medium">
        {formatCurrency(participant.agreedRate, participant.currency, { compact: true })}
      </Td>
      <Td numeric>{performance.attributedPosts}</Td>
      <Td numeric>{formatCompact(performance.reach)}</Td>
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
