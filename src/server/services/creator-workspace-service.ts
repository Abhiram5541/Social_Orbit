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
