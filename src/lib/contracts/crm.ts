import { z } from "zod";
import { Platform } from "./common";

/* ---------------------------------------------------------------------------
 * Creator relationship management.
 *
 * The influencer database is global and shared — it is the product. What a
 * client organisation owns is its *relationship* with a creator: who owns the
 * account internally, how to reach them, what has been agreed, and what
 * happened. That record is per organisation and never leaves it.
 *
 * One record per (org, creator), so duplicates are impossible by construction
 * rather than by a detection pass: the creator id is the key.
 * ------------------------------------------------------------------------ */

export const RelationshipStage = z.enum([
  "prospect",
  "contacted",
  "replied",
  "negotiating",
  "contracted",
  "active",
  "past",
  "declined",
  "blocked",
]);
export type RelationshipStage = z.infer<typeof RelationshipStage>;

export const STAGE_LABEL: Record<RelationshipStage, string> = {
  prospect: "Prospect",
  contacted: "Contacted",
  replied: "Replied",
  negotiating: "Negotiating",
  contracted: "Contracted",
  active: "Active",
  past: "Past collaborator",
  declined: "Declined",
  blocked: "Blocked",
};

/** Ordered for a pipeline view: how far a relationship has progressed. */
export const STAGE_ORDER: RelationshipStage[] = [
  "prospect",
  "contacted",
  "replied",
  "negotiating",
  "contracted",
  "active",
  "past",
  "declined",
  "blocked",
];

export const InteractionKind = z.enum([
  "note",
  "email_sent",
  "email_replied",
  "call",
  "meeting",
  "stage_change",
  "campaign_added",
  "rate_agreed",
  "contract_sent",
  "contract_signed",
  "payment_made",
  "content_submitted",
]);
export type InteractionKind = z.infer<typeof InteractionKind>;

export const INTERACTION_LABEL: Record<InteractionKind, string> = {
  note: "Note",
  email_sent: "Email sent",
  email_replied: "Reply received",
  call: "Call",
  meeting: "Meeting",
  stage_change: "Stage changed",
  campaign_added: "Added to campaign",
  rate_agreed: "Rate agreed",
  contract_sent: "Contract sent",
  contract_signed: "Contract signed",
  payment_made: "Payment made",
  content_submitted: "Content submitted",
};

/** One dated event on the relationship. Append-only: nothing is rewritten. */
export const Interaction = z.object({
  id: z.string(),
  kind: InteractionKind,
  body: z.string(),
  at: z.string().datetime(),
  byName: z.string(),
  /** Set when the event came from a campaign, contract or payment. */
  refId: z.string().nullable(),
});
export type Interaction = z.infer<typeof Interaction>;

export const CreatorContact = z.object({
  email: z.string().nullable(),
  phone: z.string().nullable(),
  managerName: z.string().nullable(),
  managerEmail: z.string().nullable(),
  agency: z.string().nullable(),
  /** Where the address came from — a creator's own bio, or typed by a person. */
  source: z.enum(["manual", "bio", "creator_portal"]).nullable(),
  /** Set when the creator asked not to be contacted. Nothing is ever sent
   *  after this, and it cannot be cleared by sending. */
  optedOutAt: z.string().datetime().nullable().default(null),
});
export type CreatorContact = z.infer<typeof CreatorContact>;

/**
 * Measured collaboration history, not a sentiment. Every component is
 * countable from records this platform already holds, and a component with
 * nothing to count is withheld rather than scored zero — the same rule the
 * health score follows.
 */
export const RelationshipScore = z.object({
  value: z.number().min(0).max(100).nullable(),
  components: z.object({
    responseRate: z.number().nullable(),
    completionRate: z.number().nullable(),
    onTimeRate: z.number().nullable(),
    repeatCollaborations: z.number().int(),
    campaignsCompleted: z.number().int(),
  }),
  /** Share of the formula that was measurable, 0–1. */
  coverage: z.number().min(0).max(1),
  formulaVersion: z.string(),
});
export type RelationshipScore = z.infer<typeof RelationshipScore>;

export const CrmRecord = z.object({
  id: z.string(),
  orgId: z.string(),
  influencerId: z.string(),
  displayName: z.string(),
  primaryHandle: z.string(),
  avatarUrl: z.string().nullable(),
  primaryPlatform: Platform,
  followers: z.number().int().nullable(),
  healthScore: z.number().nullable(),
  stage: RelationshipStage,
  ownerUserId: z.string().nullable(),
  ownerName: z.string().nullable(),
  tags: z.array(z.string()),
  contact: CreatorContact,
  /** Free-form fields an organisation defines for itself. */
  customFields: z.record(z.string(), z.string()),
  interactions: z.array(Interaction),
  relationship: RelationshipScore,
  campaignIds: z.array(z.string()),
  lastInteractionAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type CrmRecord = z.infer<typeof CrmRecord>;

/** The list view: the record without its timeline. */
export const CrmSummary = CrmRecord.omit({ interactions: true, customFields: true });
export type CrmSummary = z.infer<typeof CrmSummary>;

export const CrmPatch = z.object({
  stage: RelationshipStage.optional(),
  ownerUserId: z.string().nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  contact: CreatorContact.partial().optional(),
  customFields: z.record(z.string(), z.string().max(500)).optional(),
});
export type CrmPatch = z.infer<typeof CrmPatch>;

export const InteractionInput = z.object({
  kind: InteractionKind.default("note"),
  body: z.string().trim().min(1, "Write something").max(2000),
});
export type InteractionInput = z.infer<typeof InteractionInput>;
