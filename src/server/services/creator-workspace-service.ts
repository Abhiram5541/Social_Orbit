import type { Contract, Payment } from "@/lib/contracts/deal";
import type { Submission } from "@/lib/contracts/campaign-workflow";
import { appRows } from "@/server/data/app-store";
import { campaignsForCreator } from "@/server/repositories/workspace-repository";

/* ---------------------------------------------------------------------------
 * The creator's own campaign workspace.
 *
 * Assembled across every organisation the creator works with, because it is
 * their record, not one client's. The caller must already have proven the
 * session owns this creator (`requireOwnProfile`).
 *
 * Only what a creator is entitled to crosses over: their own brief,
 * deliverables, drafts, agreement and payments. A client's internal rate for
 * them, the rest of that client's roster and any other client's existence
 * stay out of the shape entirely rather than being filtered in the view.
 * ------------------------------------------------------------------------ */

type SubmissionRow = Omit<Submission, "displayName">;
type ContractRow = Omit<Contract, "campaignName" | "displayName">;
type PaymentRow = Omit<Payment, "campaignName" | "displayName">;

type CampaignForCreator = ReturnType<typeof campaignsForCreator>[number];

export type CreatorCampaign = CampaignForCreator & {
  submissions: SubmissionRow[];
  contracts: ContractRow[];
  payments: PaymentRow[];
};

export function creatorWorkspace(influencerId: string): { campaigns: CreatorCampaign[] } {
  const submissions = appRows<SubmissionRow>("submissions", () => []);
  const contracts = appRows<ContractRow>("contracts", () => []);
  const payments = appRows<PaymentRow>("payments", () => []);

  const campaigns = campaignsForCreator(influencerId).map((campaign) => ({
    ...campaign,
    submissions: submissions
      .filter((row) => row.influencerId === influencerId && row.campaignId === campaign.campaignId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    contracts: contracts
      .filter((row) => row.influencerId === influencerId && row.campaignId === campaign.campaignId)
      .sort((a, b) => b.version - a.version),
    payments: payments
      .filter((row) => row.influencerId === influencerId && row.campaignId === campaign.campaignId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  }));

  return { campaigns };
}

/* --- The creator's own view of their work --------------------------------
 * Aggregated across every organisation they work with, for the same reason
 * the workspace is: it is their record. Every figure is summed from the same
 * attributed posts the client sees, so the two sides of a campaign are
 * reading one set of numbers rather than two.
 * ---------------------------------------------------------------------- */

export interface CreatorAnalytics {
  campaigns: number;
  activeCampaigns: number;
  attributedPosts: number;
  /** Null when no platform in the set reported a view count (D44). */
  views: number | null;
  engagements: number | null;
  /** Median campaign score across the campaigns that have one. */
  medianCampaignScore: number | null;
  /** Deliverables met on time, as a share of those with a due date. */
  onTimePercent: number | null;
  /** What has actually been paid, by currency. Not what was agreed. */
  paid: { currency: string; amount: number }[];
  awaitingPayment: { currency: string; amount: number }[];
}

export function creatorAnalytics(influencerId: string): CreatorAnalytics {
  const { campaigns } = creatorWorkspace(influencerId);

  const performances = campaigns.map((campaign) => campaign.me.performance);
  const sumOrNull = (read: (p: (typeof performances)[number]) => number | null): number | null =>
    performances.length === 0 || performances.every((p) => read(p) === null)
      ? null
      : performances.reduce((total, p) => total + (read(p) ?? 0), 0);

  const scores = performances
    .map((performance) => performance.campaignScore)
    .filter((score): score is number => score !== null)
    .sort((a, b) => a - b);

  const withDueDate = campaigns.filter((campaign) => campaign.me.fulfilment.dueOn !== null);
  const onTime = withDueDate.filter(
    (campaign) => campaign.me.fulfilment.state === "fulfilled",
  ).length;

  const byCurrency = (rows: { currency: string; amount: number }[]) => {
    const totals = new Map<string, number>();
    for (const row of rows) totals.set(row.currency, (totals.get(row.currency) ?? 0) + row.amount);
    return [...totals.entries()].map(([currency, amount]) => ({ currency, amount }));
  };

  const payments = campaigns.flatMap((campaign) => campaign.payments);

  return {
    campaigns: campaigns.length,
    activeCampaigns: campaigns.filter((campaign) => campaign.status === "live").length,
    attributedPosts: performances.reduce((total, p) => total + p.attributedPosts, 0),
    views: sumOrNull((p) => p.views),
    engagements: sumOrNull((p) =>
      p.likes === null && p.comments === null && p.shares === null
        ? null
        : (p.likes ?? 0) + (p.comments ?? 0) + (p.shares ?? 0),
    ),
    medianCampaignScore:
      scores.length === 0
        ? null
        : Number(
            (scores.length % 2
              ? scores[(scores.length - 1) / 2]
              : (scores[scores.length / 2 - 1] + scores[scores.length / 2]) / 2
            ).toFixed(1),
          ),
    onTimePercent:
      withDueDate.length === 0 ? null : Number(((onTime / withDueDate.length) * 100).toFixed(1)),
    paid: byCurrency(payments.filter((payment) => payment.status === "paid")),
    awaitingPayment: byCurrency(
      payments.filter((payment) => payment.status === "approved" || payment.status === "scheduled"),
    ),
  };
}

export interface CreatorNotice {
  id: string;
  kind: "draft_changes" | "contract_to_sign" | "deliverable_due" | "deliverable_overdue" | "paid";
  severity: "info" | "warning" | "critical";
  title: string;
  detail: string;
  campaignId: string;
}

/**
 * What the creator has to act on, derived from the same records the client
 * side reads. Nothing is stored: a notice exists exactly as long as the
 * thing it describes does, so there is no inbox to fall out of date.
 */
export function creatorNotices(influencerId: string): CreatorNotice[] {
  const { campaigns } = creatorWorkspace(influencerId);
  const today = new Date().toISOString().slice(0, 10);
  const soon = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);
  const notices: CreatorNotice[] = [];

  for (const campaign of campaigns) {
    for (const submission of campaign.submissions) {
      if (submission.state !== "changes_requested") continue;
      notices.push({
        id: `draft-${submission.id}`,
        kind: "draft_changes",
        severity: "warning",
        title: `Changes requested on ${campaign.campaignName}`,
        // The reviewer's own words, from the event that asked for them.
        detail:
          [...submission.events]
            .reverse()
            .find((event) => event.state === "changes_requested")?.comment ??
          "The reviewer asked for a revision.",
        campaignId: campaign.campaignId,
      });
    }

    for (const contract of campaign.contracts) {
      if (contract.status !== "sent") continue;
      notices.push({
        id: `sign-${contract.id}`,
        kind: "contract_to_sign",
        severity: "warning",
        title: `A contract is waiting for your signature`,
        detail: `${campaign.campaignName}, version ${contract.version}.`,
        campaignId: campaign.campaignId,
      });
    }

    const { fulfilment } = campaign.me;
    const due = fulfilment.dueOn;
    if (due && fulfilment.state !== "fulfilled" && fulfilment.state !== "none_required") {
      const outstanding = Math.max(0, fulfilment.required - fulfilment.published);
      notices.push({
        id: `due-${campaign.campaignId}`,
        kind: due < today ? "deliverable_overdue" : "deliverable_due",
        severity: due < today ? "critical" : due <= soon ? "warning" : "info",
        title:
          due < today
            ? `Overdue on ${campaign.campaignName}`
            : `Due on ${campaign.campaignName}`,
        detail: `${outstanding} of ${fulfilment.required} still to publish, by ${due}.`,
        campaignId: campaign.campaignId,
      });
    }

    for (const payment of campaign.payments) {
      if (payment.status !== "paid") continue;
      notices.push({
        id: `paid-${payment.id}`,
        kind: "paid",
        severity: "info",
        title: `Paid for ${campaign.campaignName}`,
        detail: `${payment.currency} ${payment.amount}.`,
        campaignId: campaign.campaignId,
      });
    }
  }

  const rank = { critical: 0, warning: 1, info: 2 } as const;
  return notices.sort((a, b) => rank[a.severity] - rank[b.severity]);
}
