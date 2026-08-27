import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowUpRight,
  ListChecks,
  Megaphone,
  Search,
  TriangleAlert,
} from "lucide-react";
import { PLAN_CONFIG } from "@/lib/contracts/auth";
import { CAMPAIGN_STATUS_LABEL } from "@/lib/contracts/campaign";
import {
  formatCompact,
  formatDate,
  formatPercent,
  formatRelativeTime,
  pluralise,
} from "@/lib/format";
import { requirePageSession } from "@/server/auth/rbac";
import { quotaFor } from "@/server/repositories/usage-repository";
import {
  getShortlist,
  listCampaigns,
  listShortlists,
} from "@/server/repositories/workspace-repository";
import { PageBody, PageHeader } from "@/components/shell/app-shell";
import { LinkButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState, Notice } from "@/components/ui/states";
import { Avatar } from "@/components/ui/avatar";
import { ScorePill } from "@/components/intelligence/score";
import { StatRow, StatTile } from "@/components/intelligence/stat";

export const metadata: Metadata = { title: "Overview" };

export default async function DashboardPage() {
  const user = await requirePageSession("/dashboard");
  const quota = quotaFor(user.orgId, user.plan);
  const shortlists = listShortlists(user);
  const campaigns = listCampaigns(user);
  const plan = PLAN_CONFIG[user.plan];

  const liveCampaigns = campaigns.filter((campaign) => campaign.status === "live");
  const trackedCreators = shortlists
    .flatMap((shortlist) => getShortlist(user, shortlist.id)?.items ?? [])
    .filter(
      (item, index, list) =>
        list.findIndex((other) => other.influencerId === item.influencerId) === index,
    );

  // Alerts are derived from the creators this org actually tracks — DPR §21.
  const alerts = trackedCreators
    .filter((item) => (item.healthScore ?? 100) < 60 || (item.campaignFit ?? 100) < 50)
    .slice(0, 4);

  return (
    <>
      <PageHeader
        title={`Good morning, ${user.name.split(" ")[0]}.`}
        description={`What is happening across ${user.orgName}.`}
        actions={
          <LinkButton href="/discovery" variant="primary" className="gap-2">
            <Search className="size-4" aria-hidden />
            Discover creators
          </LinkButton>
        }
      />

      <PageBody className="space-y-5">
        {quota.limit !== null && (
          <QuotaBanner
            remaining={quota.remaining ?? 0}
            limit={quota.limit}
            resetsAt={quota.resetsAt}
            planLabel={plan.label}
          />
        )}

        <StatRow>
          <StatTile
            label="Tracked creators"
            value={formatCompact(trackedCreators.length)}
            footnote={`across ${pluralise(shortlists.length, "shortlist")}`}
          />
          <StatTile
            label="Live campaigns"
            value={formatCompact(liveCampaigns.length)}
            footnote={
              campaigns.length > 0
                ? `${campaigns.length} total`
                : "none created yet"
            }
          />
          <StatTile
            label="Attributed posts"
            value={formatCompact(
              campaigns.reduce((sum, campaign) => sum + campaign.attributedPosts, 0),
            )}
            footnote="matched to campaign hashtags"
          />
          <StatTile
            label="Searches this month"
            value={`${quota.used}${quota.limit === null ? "" : ` / ${quota.limit}`}`}
            footnote={quota.limit === null ? "unlimited on your plan" : "resets monthly"}
            emphasis={quota.limit !== null && (quota.remaining ?? 0) <= 1}
          />
        </StatRow>

        <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          <Card>
            <CardHeader>
              <CardTitle>Campaigns</CardTitle>
              <Link
                href="/campaigns"
                className="rounded text-[13px] font-medium text-brand-ink hover:underline"
              >
                View all
              </Link>
            </CardHeader>
            {campaigns.length === 0 ? (
              <EmptyState
                icon={Megaphone}
                title="No campaigns yet"
                description="Create a campaign to select creators, set a tracking hashtag, and measure what each of them delivered."
                action={
                  <LinkButton href="/campaigns/new" variant="primary" size="sm">
                    Create campaign
                  </LinkButton>
                }
              />
            ) : (
              <ul className="divide-y divide-line">
                {campaigns.slice(0, 4).map((campaign) => (
                  <li key={campaign.id}>
                    <Link
                      href={`/campaigns/${campaign.id}`}
                      className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 transition-colors hover:bg-brand-softer"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 text-[14px] font-medium text-ink">
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
                        <p className="mt-0.5 truncate text-[12px] text-ink-muted">
                          <span className="font-num">#{campaign.hashtag}</span> ·{" "}
                          {formatDate(campaign.startsOn)} – {formatDate(campaign.endsOn)}
                        </p>
                      </div>
                      <dl className="flex flex-wrap gap-x-5 gap-y-1 sm:shrink-0 sm:text-right">
                        <div>
                          <dt className="text-[11px] uppercase tracking-[0.05em] text-ink-muted">
                            Creators
                          </dt>
                          <dd className="font-num text-[14px] tabular-nums text-ink">
                            {campaign.confirmedCount}/{campaign.participantCount}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[11px] uppercase tracking-[0.05em] text-ink-muted">
                            Reach
                          </dt>
                          <dd className="font-num text-[14px] tabular-nums text-ink">
                            {formatCompact(campaign.totalReach)}
                          </dd>
                        </div>
                      </dl>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Shortlists</CardTitle>
              <Link
                href="/shortlists"
                className="rounded text-[13px] font-medium text-brand-ink hover:underline"
              >
                View all
              </Link>
            </CardHeader>
            {shortlists.length === 0 ? (
              <EmptyState
                icon={ListChecks}
                title="No shortlists yet"
                description="Save creators from discovery to compare them side by side and move them into a campaign."
              />
            ) : (
              <ul className="divide-y divide-line">
                {shortlists.map((shortlist) => (
                  <li key={shortlist.id}>
                    <Link
                      href={`/shortlists/${shortlist.id}`}
                      className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-brand-softer"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[14px] font-medium text-ink">
                          {shortlist.name}
                        </p>
                        <p className="text-[12px] text-ink-muted">
                          {pluralise(shortlist.itemCount, "creator")} · updated{" "}
                          {formatRelativeTime(shortlist.updatedAt)}
                        </p>
                      </div>
                      <ArrowUpRight className="size-4 shrink-0 text-ink-subtle" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Needs attention</CardTitle>
            <span className="text-[12px] text-ink-muted">
              Signals across creators you track
            </span>
          </CardHeader>
          {trackedCreators.length === 0 ? (
            <EmptyState
              icon={TriangleAlert}
              title="Nothing to review"
              description="Once you shortlist creators, SocialOrbit watches them for dormancy, growth anomalies, engagement decline and stale data."
            />
          ) : alerts.length === 0 ? (
            <CardContent>
              <Notice tone="positive" icon={ListChecks} title="All clear">
                No risk or activity signals on the {pluralise(trackedCreators.length, "creator")}{" "}
                you track. SocialOrbit re-checks on every refresh cycle.
              </Notice>
            </CardContent>
          ) : (
            <ul className="divide-y divide-line">
              {alerts.map((item) => (
                <li key={item.influencerId}>
                  <Link
                    href={`/influencers/${item.influencerId}`}
                    className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-brand-softer"
                  >
                    <Avatar name={item.displayName} src={item.avatarUrl} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-ink">
                        {item.displayName}
                      </p>
                      <p className="truncate text-[12px] text-ink-muted">
                        {(item.healthScore ?? 100) < 60
                          ? "Health score below your review threshold"
                          : "Campaign fit has fallen below 50"}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-4">
                      <span className="text-right">
                        <span className="block text-[11px] uppercase tracking-[0.05em] text-ink-muted">
                          Health
                        </span>
                        <ScorePill value={item.healthScore} label="Health" />
                      </span>
                      <span className="hidden text-right sm:block">
                        <span className="block text-[11px] uppercase tracking-[0.05em] text-ink-muted">
                          Engagement
                        </span>
                        <span className="font-num text-[13px] tabular-nums text-ink">
                          {formatPercent(item.engagementRate)}
                        </span>
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </PageBody>
    </>
  );
}

function QuotaBanner({
  remaining,
  limit,
  resetsAt,
  planLabel,
}: {
  remaining: number;
  limit: number;
  resetsAt: string;
  planLabel: string;
}) {
  if (remaining === 0) {
    return (
      <Notice
        tone="critical"
        icon={Search}
        title="Monthly search allowance used"
        action={
          <LinkButton href="/usage" variant="primary" size="sm">
            Upgrade plan
          </LinkButton>
        }
      >
        Your {planLabel} plan includes {limit} influencer searches per month. Browsing saved
        creators and shortlists stays available. The allowance resets{" "}
        {formatRelativeTime(resetsAt)}.
      </Notice>
    );
  }

  if (remaining <= Math.max(1, Math.floor(limit * 0.4))) {
    return (
      <Notice
        tone="caution"
        icon={Search}
        title={`${remaining} of ${limit} searches remaining`}
        action={
          <LinkButton href="/usage" size="sm">
            See plans
          </LinkButton>
        }
      >
        Allowance resets {formatRelativeTime(resetsAt)}. Paging through results you have
        already opened does not use another search.
      </Notice>
    );
  }

  return null;
}

// Quota and campaign figures are per-request and per-tenant; never statically cached.
export const dynamic = "force-dynamic";
