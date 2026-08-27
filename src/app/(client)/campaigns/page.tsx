import type { Metadata } from "next";
import Link from "next/link";
import { Megaphone, Plus } from "lucide-react";
import { CAMPAIGN_STATUS_LABEL } from "@/lib/contracts/campaign";
import { PLATFORM_LABEL } from "@/lib/contracts/common";
import { formatCompact, formatCurrency, formatDate, formatRelativeTime } from "@/lib/format";
import { requirePagePermission } from "@/server/auth/rbac";
import { listCampaigns } from "@/server/repositories/workspace-repository";
import { PageBody, PageHeader } from "@/components/shell/app-shell";
import { Badge } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import { Table, TableWrap, Tbody, Td, Th, Thead, Tr } from "@/components/ui/table";
import { StatRow, StatTile } from "@/components/intelligence/stat";

export const metadata: Metadata = { title: "Campaigns" };
export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const user = await requirePagePermission("campaign:read", "/campaigns");
  const campaigns = listCampaigns(user);

  const live = campaigns.filter((campaign) => campaign.status === "live");
  const attributed = campaigns.reduce((sum, campaign) => sum + campaign.attributedPosts, 0);
  const reach = campaigns.reduce((sum, campaign) => sum + (campaign.totalReach ?? 0), 0);
  const spend = campaigns.reduce((sum, campaign) => sum + (campaign.spentAmount ?? 0), 0);

  return (
    <>
      <PageHeader
        title="Campaigns"
        description="Select talent, set a tracking hashtag, and measure what each creator actually delivered."
        actions={
          <LinkButton href="/campaigns/new" variant="primary" className="gap-1.5">
            <Plus className="size-4" aria-hidden />
            New campaign
          </LinkButton>
        }
      />

      <PageBody className="space-y-4">
        {campaigns.length > 0 && (
          <StatRow>
            <StatTile label="Live campaigns" value={live.length} />
            <StatTile label="Attributed posts" value={formatCompact(attributed)} footnote="matched by hashtag" />
            <StatTile label="Total reach" value={formatCompact(reach)} />
            <StatTile
              label="Committed spend"
              value={formatCurrency(spend, campaigns[0]?.budgetCurrency ?? "INR", { compact: true })}
              footnote="agreed rates"
            />
          </StatRow>
        )}

        <Card>
          {campaigns.length === 0 ? (
            <EmptyState
              icon={Megaphone}
              title="No campaigns yet"
              description="A campaign links the creators you selected to a tracking hashtag, so every post they publish can be attributed and scored separately from their general profile."
              action={
                <LinkButton href="/campaigns/new" variant="primary" size="sm">
                  Create your first campaign
                </LinkButton>
              }
            />
          ) : (
            <TableWrap label="Campaigns">
              <Table>
                <Thead>
                  <Tr>
                    <Th>Campaign</Th>
                    <Th>Status</Th>
                    <Th>Hashtag</Th>
                    <Th>Window</Th>
                    <Th numeric>Creators</Th>
                    <Th numeric>Posts</Th>
                    <Th numeric>Reach</Th>
                    <Th numeric>Engagements</Th>
                    <Th numeric>Spend</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {campaigns.map((campaign) => (
                    <Tr key={campaign.id} interactive>
                      <Td>
                        <Link
                          href={`/campaigns/${campaign.id}`}
                          className="block rounded font-medium text-ink hover:text-brand-ink hover:underline"
                        >
                          {campaign.name}
                        </Link>
                        <span className="text-[12px] text-ink-muted">
                          {campaign.platforms.map((p) => PLATFORM_LABEL[p]).join(", ")} · updated{" "}
                          {formatRelativeTime(campaign.updatedAt)}
                        </span>
                      </Td>
                      <Td>
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
                      </Td>
                      <Td className="font-num text-[12px]">#{campaign.hashtag}</Td>
                      <Td className="whitespace-nowrap text-[12px] text-ink-muted">
                        {formatDate(campaign.startsOn)} – {formatDate(campaign.endsOn)}
                      </Td>
                      <Td numeric>
                        {campaign.confirmedCount}/{campaign.participantCount}
                      </Td>
                      <Td numeric>{campaign.attributedPosts}</Td>
                      <Td numeric>{formatCompact(campaign.totalReach)}</Td>
                      <Td numeric>{formatCompact(campaign.totalEngagements)}</Td>
                      <Td numeric>
                        {formatCurrency(campaign.spentAmount, campaign.budgetCurrency, {
                          compact: true,
                        })}
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
