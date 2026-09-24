import { randomBytes } from "node:crypto";
import type { SessionUser } from "@/lib/contracts/auth";
import type {
  CampaignSpend,
  Contract,
  ContractInput,
  ContractTemplate,
  ContractTemplateInput,
  Payment,
  PaymentActionInput,
  PaymentInput,
  SignInput,
} from "@/lib/contracts/deal";
import { ApiFailure, assertTenantAccess } from "@/server/auth/rbac";
import { appRows, persist } from "@/server/data/app-store";
import { noteIfTracked } from "@/server/repositories/crm-repository";
import { toSummary } from "@/server/repositories/influencer-repository";
import { getCampaign } from "@/server/repositories/workspace-repository";
import { render } from "./outreach-service";

/* ---------------------------------------------------------------------------
 * Contracts, usage rights, compensation and payments.
 *
 * SENSO signs nothing and moves no money. What it does is record: the terms
 * agreed, the document as it was sent, the signature somebody actually gave,
 * and every state a payment passed through with the person who moved it.
 *
 * Nothing here transitions on a clock. An unsigned contract past its expiry
 * is *expired*, never signed by default; a payment is paid because a person
 * recorded paying it and left a reference, not because its due date arrived.
 * A finance record that advances itself is a finance record nobody can
 * defend in an audit.
 * ------------------------------------------------------------------------ */

export const DEAL_VERSION = "deal-1.0.0";

type ContractRow = Omit<Contract, "campaignName" | "displayName">;
type PaymentRow = Omit<Payment, "campaignName" | "displayName">;

const templates = () => appRows<ContractTemplate>("contract_templates", () => []);
const contracts = () => appRows<ContractRow>("contracts", () => []);
const payments = () => appRows<PaymentRow>("payments", () => []);

const nextId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const nameOf = (influencerId: string) =>
  toSummary(influencerId)?.displayName ?? influencerId;

/* --- Templates ---------------------------------------------------------- */

export function listContractTemplates(user: SessionUser): ContractTemplate[] {
  return templates()
    .filter((row) => row.orgId === user.orgId)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function createContractTemplate(
  user: SessionUser,
  input: ContractTemplateInput,
): ContractTemplate {
  const row: ContractTemplate = {
    id: nextId("ctpl"),
    orgId: user.orgId,
    name: input.name,
    body: input.body,
    createdAt: new Date().toISOString(),
  };
  templates().push(row);
  persist("contract_templates", [row]);
  return row;
}

/* --- Contracts ---------------------------------------------------------- */

function decorate(row: ContractRow, campaignName: string): Contract {
  return { ...row, campaignName, displayName: nameOf(row.influencerId) };
}

export function listContracts(
  user: SessionUser,
  filter: { campaignId?: string; influencerId?: string } = {},
): Contract[] {
  return contracts()
    .filter((row) => row.orgId === user.orgId)
    .filter((row) => !filter.campaignId || row.campaignId === filter.campaignId)
    .filter((row) => !filter.influencerId || row.influencerId === filter.influencerId)
    .map((row) => decorate(row, getCampaign(user, row.campaignId)?.name ?? "Campaign"))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Derives the rights expiry from publication window and duration. */
function withExpiry(input: ContractInput): ContractInput["usageRights"] {
  const rights = input.usageRights;
  if (rights.durationMonths === null) return { ...rights, expiresOn: null };
  const from = new Date(`${input.endsOn}T00:00:00.000Z`);
  from.setUTCMonth(from.getUTCMonth() + rights.durationMonths);
  return { ...rights, expiresOn: from.toISOString().slice(0, 10) };
}

export function createContract(user: SessionUser, input: ContractInput): Contract {
  const campaign = getCampaign(user, input.campaignId);
  if (!campaign) throw new ApiFailure("not_found", "Campaign not found.");
  assertTenantAccess(user, campaign.orgId);
  const participant = campaign.participants.find((p) => p.influencerId === input.influencerId);
  if (!participant) throw new ApiFailure("validation_failed", "That creator is not on this campaign.");

  const previous = contracts().filter(
    (row) => row.campaignId === campaign.id && row.influencerId === input.influencerId,
  );
  const now = new Date().toISOString();

  const body = render(input.body, {
    "creator.name": nameOf(input.influencerId),
    "creator.handle": participant.primaryHandle,
    "campaign.name": campaign.name,
    "campaign.hashtag": campaign.hashtag,
    "org.name": user.orgName,
    "sender.name": user.name,
    "deal.amount": String(input.compensation.baseAmount ?? ""),
    "deal.currency": input.compensation.currency,
  });

  const row: ContractRow = {
    id: nextId("ctr"),
    orgId: user.orgId,
    campaignId: campaign.id,
    influencerId: input.influencerId,
    templateId: input.templateId,
    body,
    status: "draft",
    compensation: input.compensation,
    usageRights: withExpiry(input),
    deliverablesSummary:
      input.deliverablesSummary ||
      campaign.deliverables
        .map((d) => `${d.quantity} × ${d.label} (${d.platform}/${d.format})`)
        .join(", "),
    startsOn: input.startsOn,
    endsOn: input.endsOn,
    signToken: null,
    signatureName: null,
    signedAt: null,
    expiresOn: input.expiresOn,
    events: [{ id: nextId("ev"), status: "draft", note: "Created", at: now, byName: user.name }],
    version: previous.length + 1,
    createdAt: now,
    updatedAt: now,
  };
  contracts().push(row);
  persist("contracts", [row]);
  return decorate(row, campaign.name);
}

/** Issues the signature link and freezes the document. */
export function sendContract(user: SessionUser, contractId: string): Contract {
  const row = contracts().find((entry) => entry.id === contractId);
  if (!row) throw new ApiFailure("not_found", "Contract not found.");
  assertTenantAccess(user, row.orgId);
  if (row.status === "signed") throw new ApiFailure("conflict", "That contract is already signed.");

  row.signToken = randomBytes(24).toString("base64url");
  row.status = "sent";
  row.updatedAt = new Date().toISOString();
  row.events.push({
    id: nextId("ev"),
    status: "sent",
    note: "Sent for signature",
    at: row.updatedAt,
    byName: user.name,
  });
  persist("contracts", [row]);
  noteIfTracked(user, row.influencerId, {
    kind: "contract_sent",
    body: `Contract v${row.version} sent for signature`,
    refId: row.id,
  });
  return decorate(row, getCampaign(user, row.campaignId)?.name ?? "Campaign");
}

/** The signer's view. No session: reached by the token in their email. */
export function contractByToken(token: string): Contract | null {
  const row = contracts().find((entry) => entry.signToken === token);
  if (!row) return null;
  if (row.expiresOn && new Date().toISOString().slice(0, 10) > row.expiresOn && row.status !== "signed") {
    // Past its date and unsigned is expired — it is never treated as agreed.
    return { ...decorate(row, "Campaign"), status: "expired" };
  }
  return decorate(row, "Campaign");
}

export function signContract(token: string, input: SignInput): Contract | null {
  const row = contracts().find((entry) => entry.signToken === token);
  if (!row || row.status === "signed") return null;
  if (row.expiresOn && new Date().toISOString().slice(0, 10) > row.expiresOn) return null;

  const now = new Date().toISOString();
  row.status = "signed";
  row.signatureName = input.signatureName;
  row.signedAt = now;
  row.updatedAt = now;
  row.events.push({
    id: nextId("ev"),
    status: "signed",
    note: `Signed by ${input.signatureName}`,
    at: now,
    byName: input.signatureName,
  });
  persist("contracts", [row]);
  return decorate(row, "Campaign");
}

/* --- Payments ----------------------------------------------------------- */

const decoratePayment = (row: PaymentRow, campaignName: string): Payment => ({
  ...row,
  campaignName,
  displayName: nameOf(row.influencerId),
});

export function listPayments(
  user: SessionUser,
  filter: { campaignId?: string; influencerId?: string } = {},
): Payment[] {
  return payments()
    .filter((row) => row.orgId === user.orgId)
    .filter((row) => !filter.campaignId || row.campaignId === filter.campaignId)
    .filter((row) => !filter.influencerId || row.influencerId === filter.influencerId)
    .map((row) => decoratePayment(row, getCampaign(user, row.campaignId)?.name ?? "Campaign"))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function createPayment(user: SessionUser, input: PaymentInput): Payment {
  const campaign = getCampaign(user, input.campaignId);
  if (!campaign) throw new ApiFailure("not_found", "Campaign not found.");
  assertTenantAccess(user, campaign.orgId);

  const row: PaymentRow = {
    id: nextId("pay"),
    orgId: user.orgId,
    campaignId: campaign.id,
    influencerId: input.influencerId,
    contractId: input.contractId,
    amount: input.amount,
    currency: input.currency,
    status: "scheduled",
    description: input.description,
    dueOn: input.dueOn,
    approvedByName: null,
    approvedAt: null,
    paidAt: null,
    reference: null,
    failureReason: null,
    createdAt: new Date().toISOString(),
    createdByName: user.name,
  };
  payments().push(row);
  persist("payments", [row]);
  return decoratePayment(row, campaign.name);
}

/**
 * Moves a payment through its states. Approval and payment are separate
 * actions by design — the person who approves an amount should not be the
 * only record that it left the account — and every transition records who
 * made it.
 */
export function actOnPayment(
  user: SessionUser,
  paymentId: string,
  input: PaymentActionInput,
): Payment {
  const row = payments().find((entry) => entry.id === paymentId);
  if (!row) throw new ApiFailure("not_found", "Payment not found.");
  assertTenantAccess(user, row.orgId);

  const now = new Date().toISOString();
  if (input.action === "approve") {
    if (row.status !== "scheduled") throw new ApiFailure("conflict", "Only a scheduled payment can be approved.");
    row.status = "approved";
    row.approvedByName = user.name;
    row.approvedAt = now;
  } else if (input.action === "mark_paid") {
    if (row.status !== "approved") {
      throw new ApiFailure("conflict", "Approve the payment before recording it as paid.");
    }
    row.status = "paid";
    row.paidAt = now;
    row.reference = input.reference?.trim() || null;
    noteIfTracked(user, row.influencerId, {
      kind: "payment_made",
      body: `${row.currency} ${row.amount} — ${row.description}`,
      refId: row.id,
    });
  } else if (input.action === "mark_failed") {
    row.status = "failed";
    row.failureReason = input.reason?.trim() || "No reason recorded.";
  } else {
    row.status = "cancelled";
  }
  persist("payments", [row]);
  return decoratePayment(row, getCampaign(user, row.campaignId)?.name ?? "Campaign");
}

/**
 * Budget against committed, approved and paid. Committed is what contracts
 * and agreed rates promise; paid is only what somebody recorded paying.
 */
export function campaignSpend(user: SessionUser, campaignId: string): CampaignSpend {
  const campaign = getCampaign(user, campaignId);
  if (!campaign) throw new ApiFailure("not_found", "Campaign not found.");
  const rows = payments().filter(
    (row) => row.orgId === user.orgId && row.campaignId === campaignId && row.status !== "cancelled",
  );
  const sum = (predicate: (row: PaymentRow) => boolean) =>
    rows.filter(predicate).reduce((total, row) => total + row.amount, 0);

  const committed = campaign.participants.reduce(
    (total, participant) => total + (participant.agreedRate ?? 0),
    0,
  );
  const paid = sum((row) => row.status === "paid");

  return {
    currency: campaign.budgetCurrency,
    budget: campaign.budgetAmount,
    committed,
    approved: sum((row) => row.status === "approved"),
    paid,
    outstanding: Math.max(0, committed - paid),
  };
}

/**
 * Signed contracts whose usage rights lapse within `days`.
 *
 * The date is already derived from publication plus duration (`withExpiry`),
 * so this only reads it. It matters because the failure mode is silent: a
 * brand keeps running an asset it no longer has the right to run, and nobody
 * finds out until the creator's lawyer does.
 */
export function expiringContracts(user: SessionUser, days = 30): Contract[] {
  const today = new Date().toISOString().slice(0, 10);
  const horizon = new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
  return listContracts(user)
    .filter((contract) => contract.status === "signed")
    .filter((contract) => {
      const expires = contract.usageRights.expiresOn;
      return expires !== null && expires >= today && expires <= horizon;
    })
    .sort((a, b) => (a.usageRights.expiresOn ?? "").localeCompare(b.usageRights.expiresOn ?? ""));
}
