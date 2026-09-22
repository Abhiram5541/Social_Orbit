import { z } from "zod";

/* ---------------------------------------------------------------------------
 * The commercial record of a collaboration: what was agreed, on what terms,
 * for what rights, and what has been paid.
 *
 * SENSO signs nothing and moves no money. It records the agreement, renders
 * the document, tracks the signature state a provider reports and keeps the
 * payment ledger — and every one of those is an observation with a source.
 * A contract is "signed" because a signature was recorded, not because a
 * deadline passed; a payment is "paid" because somebody recorded paying it,
 * and the ledger says who and when.
 * ------------------------------------------------------------------------ */

/* --- Compensation ------------------------------------------------------- */

export const CompensationModel = z.enum([
  "flat_fee",
  "commission",
  "affiliate",
  "gifting",
  "hybrid",
  "performance_bonus",
]);
export type CompensationModel = z.infer<typeof CompensationModel>;

export const COMPENSATION_LABEL: Record<CompensationModel, string> = {
  flat_fee: "Flat fee",
  commission: "Commission",
  affiliate: "Affiliate",
  gifting: "Gifting",
  hybrid: "Hybrid",
  performance_bonus: "Performance bonus",
};

export const Compensation = z.object({
  model: CompensationModel,
  currency: z.string().length(3),
  /** The guaranteed amount. Null for pure commission or gifting. */
  baseAmount: z.number().nonnegative().nullable(),
  /** Percentage of attributed sales, where a model pays one. */
  commissionPct: z.number().min(0).max(100).nullable(),
  /** What a bonus pays, and the measured condition that earns it. */
  bonusAmount: z.number().nonnegative().nullable(),
  bonusCondition: z.string().nullable(),
  /** Retail value of gifted product, where that is the consideration. */
  giftingValue: z.number().nonnegative().nullable(),
  notes: z.string().nullable(),
});
export type Compensation = z.infer<typeof Compensation>;

/* --- Usage rights ------------------------------------------------------- */

export const UsageRights = z.object({
  /** Where the content may run. */
  territories: z.array(z.string()).default([]),
  /** Months from publication. Null means in perpetuity, which is stated. */
  durationMonths: z.number().int().positive().nullable(),
  /** Channels the brand may reuse it on. */
  channels: z.array(z.string()).default([]),
  paidMedia: z.boolean(),
  whitelisting: z.boolean(),
  exclusivity: z.string().nullable(),
  exclusivityEndsOn: z.string().date().nullable(),
  /** Derived from publication + duration; null in perpetuity. */
  expiresOn: z.string().date().nullable(),
});
export type UsageRights = z.infer<typeof UsageRights>;

/* --- Contracts ---------------------------------------------------------- */

export const ContractStatus = z.enum([
  "draft",
  "sent",
  "signed",
  "declined",
  "expired",
  "void",
]);
export type ContractStatus = z.infer<typeof ContractStatus>;

export const CONTRACT_STATUS_LABEL: Record<ContractStatus, string> = {
  draft: "Draft",
  sent: "Awaiting signature",
  signed: "Signed",
  declined: "Declined",
  expired: "Expired",
  void: "Void",
};

export const ContractEvent = z.object({
  id: z.string(),
  status: ContractStatus.nullable(),
  note: z.string(),
  at: z.string().datetime(),
  byName: z.string(),
});
export type ContractEvent = z.infer<typeof ContractEvent>;

export const ContractTemplate = z.object({
  id: z.string(),
  orgId: z.string(),
  name: z.string(),
  /** Uses the same {{token}} placeholders outreach does. */
  body: z.string(),
  createdAt: z.string().datetime(),
});
export type ContractTemplate = z.infer<typeof ContractTemplate>;

export const ContractTemplateInput = z.object({
  name: z.string().trim().min(2).max(80),
  body: z.string().trim().min(20).max(20000),
});
export type ContractTemplateInput = z.infer<typeof ContractTemplateInput>;

export const Contract = z.object({
  id: z.string(),
  orgId: z.string(),
  campaignId: z.string(),
  campaignName: z.string(),
  influencerId: z.string(),
  displayName: z.string(),
  templateId: z.string().nullable(),
  /** The rendered document, frozen when it was sent. */
  body: z.string(),
  status: ContractStatus,
  compensation: Compensation,
  usageRights: UsageRights,
  deliverablesSummary: z.string(),
  startsOn: z.string().date(),
  endsOn: z.string().date(),
  /** The signature link, when one has been issued. */
  signToken: z.string().nullable(),
  signatureName: z.string().nullable(),
  signedAt: z.string().datetime().nullable(),
  /** After this an unsigned contract is expired, never auto-signed. */
  expiresOn: z.string().date().nullable(),
  events: z.array(ContractEvent),
  version: z.number().int(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Contract = z.infer<typeof Contract>;

export const ContractInput = z.object({
  campaignId: z.string().min(1),
  influencerId: z.string().min(1),
  templateId: z.string().nullable().default(null),
  body: z.string().trim().min(20).max(20000),
  compensation: Compensation,
  usageRights: UsageRights,
  deliverablesSummary: z.string().trim().max(2000).default(""),
  startsOn: z.string().date(),
  endsOn: z.string().date(),
  expiresOn: z.string().date().nullable().default(null),
});
export type ContractInput = z.infer<typeof ContractInput>;

export const SignInput = z.object({
  signatureName: z.string().trim().min(2, "Type your full name").max(120),
  accept: z.literal(true, { message: "Confirm you agree to the terms" }),
});
export type SignInput = z.infer<typeof SignInput>;

/* --- Payments ----------------------------------------------------------- */

export const PaymentStatus = z.enum([
  "scheduled",
  "approved",
  "paid",
  "failed",
  "cancelled",
]);
export type PaymentStatus = z.infer<typeof PaymentStatus>;

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  scheduled: "Scheduled",
  approved: "Approved for payout",
  paid: "Paid",
  failed: "Failed",
  cancelled: "Cancelled",
};

export const Payment = z.object({
  id: z.string(),
  orgId: z.string(),
  campaignId: z.string(),
  campaignName: z.string(),
  influencerId: z.string(),
  displayName: z.string(),
  contractId: z.string().nullable(),
  amount: z.number().nonnegative(),
  currency: z.string().length(3),
  status: PaymentStatus,
  /** What the money is for: the deliverable, the bonus, the commission. */
  description: z.string(),
  dueOn: z.string().date().nullable(),
  approvedByName: z.string().nullable(),
  approvedAt: z.string().datetime().nullable(),
  paidAt: z.string().datetime().nullable(),
  /** The bank or provider reference a person recorded. */
  reference: z.string().nullable(),
  failureReason: z.string().nullable(),
  createdAt: z.string().datetime(),
  createdByName: z.string(),
});
export type Payment = z.infer<typeof Payment>;

export const PaymentInput = z.object({
  campaignId: z.string().min(1),
  influencerId: z.string().min(1),
  contractId: z.string().nullable().default(null),
  amount: z.number().positive("Enter an amount"),
  currency: z.string().length(3),
  description: z.string().trim().min(2).max(200),
  dueOn: z.string().date().nullable().default(null),
});
export type PaymentInput = z.infer<typeof PaymentInput>;

export const PaymentActionInput = z.object({
  action: z.enum(["approve", "mark_paid", "mark_failed", "cancel"]),
  reference: z.string().trim().max(120).optional(),
  reason: z.string().trim().max(500).optional(),
});
export type PaymentActionInput = z.infer<typeof PaymentActionInput>;

/** Budget against what is committed and what has actually left the account. */
export const CampaignSpend = z.object({
  currency: z.string(),
  budget: z.number().nullable(),
  committed: z.number(),
  approved: z.number(),
  paid: z.number(),
  outstanding: z.number(),
});
export type CampaignSpend = z.infer<typeof CampaignSpend>;
