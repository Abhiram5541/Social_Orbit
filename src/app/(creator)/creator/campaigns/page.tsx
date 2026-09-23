import type { Metadata } from "next";
import { Megaphone } from "lucide-react";
import {
  CAMPAIGN_STATUS_LABEL,
  DELIVERABLE_FORMAT_LABEL,
  FULFILMENT_LABEL,
} from "@/lib/contracts/campaign";
import { CONTRACT_STATUS_LABEL, PAYMENT_STATUS_LABEL } from "@/lib/contracts/deal";
import { SUBMISSION_LABEL } from "@/lib/contracts/campaign-workflow";
import { PLATFORM_LABEL } from "@/lib/contracts/common";
import { formatCompact, formatCurrency, formatDate, formatPercent, NO_VALUE } from "@/lib/format";
import { requireOwnProfile } from "@/server/auth/creator";
import { creatorWorkspace } from "@/server/services/creator-workspace-service";
import { PageBody, PageHeader } from "@/components/shell/app-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState, Notice } from "@/components/ui/states";
import { Table, TableWrap, Tbody, Td, Th, Thead, Tr } from "@/components/ui/table";

export const metadata: Metadata = { title: "Campaigns" };
export const dynamic = "force-dynamic";

/**
 * The creator's own campaign workspace: the brief, what they owe, what they
 * have submitted, what was approved, what was published, and where the
 * contract and the money stand — across every brand they work with.
 */
export default async function CreatorCampaignsPage() {
  const { user } = await requireOwnProfile("/creator/campaigns");
  const workspace = creatorWorkspace(user.influencerId!);

  return (
    <>
      <PageHeader
        eyebrow="Performance"
        title="Campaigns"
        description="Every campaign you have been invited to, what you owe on each, and how your published posts were attributed."
      />
      <PageBody className="space-y-4">
        <Notice tone="info" title="What brands can and cannot see">
          A brand sees the posts SENSO attributed to their tracking hashtag and the figures
          the platforms published for them. They never see your other campaigns, your rates
          with anyone else, or your payout details.
        </Notice>

        {workspace.campaigns.length === 0 ? (
          <Card>
            <EmptyState
              icon={Megaphone}
              title="No campaigns yet"
              description="When a brand adds you to a campaign it appears here with its brief, its deliverables and your own performance."
            />
          </Card>
        ) : (
          workspace.campaigns.map((campaign) => (
            <Card key={campaign.campaignId}>
              <CardHeader>
                <CardTitle>{campaign.campaignName}</CardTitle>
                <span className="flex flex-wrap items-center gap-2 text-sm text-ink-muted">
                  <Badge tone={campaign.status === "live" ? "positive" : "neutral"}>
                    {CAMPAIGN_STATUS_LABEL[campaign.status]}
                  </Badge>
                  <span className="font-num">#{campaign.hashtag}</span>
                  <span>
                    {formatDate(campaign.startsOn)} – {formatDate(campaign.endsOn)}
                  </span>
                </span>
              </CardHeader>

              {campaign.brief && (
                <p className="border-b border-rule px-4 py-3 text-base leading-6 text-ink-muted">
                  {campaign.brief}
                </p>
              )}

              <dl className="grid divide-y divide-rule sm:grid-cols-4 sm:divide-x sm:divide-y-0">
                <Figure label="Your rate">
                  {formatCurrency(campaign.me.agreedRate, campaign.me.currency, { compact: true })}
                </Figure>
                <Figure label="Attributed posts">
                  {campaign.me.performance.attributedPosts}
                </Figure>
                <Figure label="Views">{formatCompact(campaign.me.performance.views)}</Figure>
                <Figure label="Engagement">
                  {formatPercent(campaign.me.performance.engagementRate)}
                </Figure>
              </dl>

              <div className="border-t border-rule px-4 py-3">
                <p className="label-caps-sm text-ink-subtle">Deliverables</p>
                {campaign.deliverables.length === 0 ? (
                  <p className="mt-1 text-sm text-ink-muted">
                    None set by the brand for this campaign.
                  </p>
                ) : (
                  <>
                    <ul className="mt-1.5 space-y-1">
                      {campaign.deliverables.map((deliverable) => (
                        <li key={deliverable.id} className="text-base text-ink">
                          {deliverable.quantity} × {deliverable.label}{" "}
                          <span className="text-ink-muted">
                            ({PLATFORM_LABEL[deliverable.platform]} ·{" "}
                            {DELIVERABLE_FORMAT_LABEL[deliverable.format]}
                            {deliverable.dueOn ? ` · due ${formatDate(deliverable.dueOn)}` : ""})
                          </span>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-2 flex items-center gap-2 text-sm">
                      <Badge
                        tone={
                          campaign.me.fulfilment.state === "fulfilled"
                            ? "positive"
                            : campaign.me.fulfilment.state === "missed"
                              ? "critical"
                              : "neutral"
                        }
                      >
                        {FULFILMENT_LABEL[campaign.me.fulfilment.state]}
                      </Badge>
                      <span className="font-num text-ink-muted">
                        {campaign.me.fulfilment.published}/{campaign.me.fulfilment.required}{" "}
                        published
                      </span>
                    </p>
                  </>
                )}
              </div>

              {campaign.submissions.length > 0 && (
                <TableWrap label={`Submissions for ${campaign.campaignName}`}>
                  <Table>
                    <Thead>
                      <Tr>
                        <Th>Draft</Th>
                        <Th>State</Th>
                        <Th numeric>Revision</Th>
                        <Th>Latest feedback</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {campaign.submissions.map((submission) => {
                        const latest = submission.events[submission.events.length - 1];
                        return (
                          <Tr key={submission.id}>
                            <Td className="max-w-[18rem] truncate">{submission.caption}</Td>
                            <Td>
                              <Badge
                                tone={
                                  submission.state === "approved" || submission.state === "published"
                                    ? "positive"
                                    : submission.state === "changes_requested"
                                      ? "caution"
                                      : "neutral"
                                }
                              >
                                {SUBMISSION_LABEL[submission.state]}
                              </Badge>
                            </Td>
                            <Td numeric>{submission.revision}</Td>
                            <Td className="text-ink-muted">{latest?.comment || NO_VALUE}</Td>
                          </Tr>
                        );
                      })}
                    </Tbody>
                  </Table>
                </TableWrap>
              )}

              <div className="grid divide-y divide-rule border-t border-rule sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                <div className="px-4 py-3">
                  <p className="label-caps-sm text-ink-subtle">Agreement</p>
                  {campaign.contracts.length === 0 ? (
                    <p className="mt-1 text-sm text-ink-muted">Nothing sent yet.</p>
                  ) : (
                    campaign.contracts.map((contract) => (
                      <p key={contract.id} className="mt-1 flex items-center gap-2 text-base">
                        <Badge tone={contract.status === "signed" ? "positive" : "neutral"}>
                          {CONTRACT_STATUS_LABEL[contract.status]}
                        </Badge>
                        <span className="text-ink-muted">v{contract.version}</span>
                      </p>
                    ))
                  )}
                </div>
                <div className="px-4 py-3">
                  <p className="label-caps-sm text-ink-subtle">Payment</p>
                  {campaign.payments.length === 0 ? (
                    <p className="mt-1 text-sm text-ink-muted">Nothing scheduled yet.</p>
                  ) : (
                    campaign.payments.map((payment) => (
                      <p key={payment.id} className="mt-1 flex items-center gap-2 text-base">
                        <Badge tone={payment.status === "paid" ? "positive" : "neutral"}>
                          {PAYMENT_STATUS_LABEL[payment.status]}
                        </Badge>
                        <span className="font-num text-ink">
                          {formatCurrency(payment.amount, payment.currency, { compact: true })}
                        </span>
                        <span className="text-ink-muted">{payment.description}</span>
                      </p>
                    ))
                  )}
                </div>
              </div>
            </Card>
          ))
        )}
      </PageBody>
    </>
  );
}

function Figure({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="px-4 py-3">
      <dt className="label-caps-sm text-ink-subtle">{label}</dt>
      <dd className="mt-0.5 font-num text-stat font-semibold text-ink">{children}</dd>
    </div>
  );
}
