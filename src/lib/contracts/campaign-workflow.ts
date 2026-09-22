import { z } from "zod";
import { Platform } from "./common";
import { DeliverableFormat } from "./campaign";

/* ---------------------------------------------------------------------------
 * The campaign workflow either side of publication.
 *
 *   proposal  — the client sees the roster and approves or rejects creators
 *   submission — the creator sends content for review before it goes live
 *
 * Both are shared outside the workspace: a proposal goes to a brand contact
 * who has no SENSO account, and a submission comes from a creator who may
 * not either. Both therefore use an unguessable link rather than a login,
 * and the link grants exactly one campaign and nothing else.
 * ------------------------------------------------------------------------ */

export const ProposalDecision = z.enum(["pending", "approved", "rejected"]);
export type ProposalDecision = z.infer<typeof ProposalDecision>;

export const DECISION_LABEL: Record<ProposalDecision, string> = {
  pending: "Awaiting decision",
  approved: "Approved",
  rejected: "Rejected",
};

export const ProposalLine = z.object({
  influencerId: z.string(),
  displayName: z.string(),
  primaryHandle: z.string(),
  avatarUrl: z.string().nullable(),
  followers: z.number().int().nullable(),
  healthScore: z.number().nullable(),
  agreedRate: z.number().nullable(),
  currency: z.string(),
  decision: ProposalDecision,
  comment: z.string().nullable(),
  decidedAt: z.string().datetime().nullable(),
});
export type ProposalLine = z.infer<typeof ProposalLine>;

export const Proposal = z.object({
  id: z.string(),
  orgId: z.string(),
  campaignId: z.string(),
  campaignName: z.string(),
  /** The unguessable part of the share link. */
  token: z.string(),
  version: z.number().int(),
  note: z.string().nullable(),
  /** After this the link stops working; null means no deadline. */
  expiresOn: z.string().date().nullable(),
  lines: z.array(ProposalLine),
  createdAt: z.string().datetime(),
  createdByName: z.string(),
  /** Set once every line has a decision. */
  completedAt: z.string().datetime().nullable(),
});
export type Proposal = z.infer<typeof Proposal>;

export const ProposalInput = z.object({
  campaignId: z.string().min(1),
  note: z.string().trim().max(2000).optional(),
  expiresOn: z.string().date().nullable().default(null),
});
export type ProposalInput = z.infer<typeof ProposalInput>;

export const ProposalDecisionInput = z.object({
  influencerId: z.string().min(1),
  decision: z.enum(["approved", "rejected"]),
  comment: z.string().trim().max(1000).optional(),
});
export type ProposalDecisionInput = z.infer<typeof ProposalDecisionInput>;

/* --- Content submission ------------------------------------------------- */

export const SubmissionState = z.enum([
  "submitted",
  "changes_requested",
  "approved",
  "published",
]);
export type SubmissionState = z.infer<typeof SubmissionState>;

export const SUBMISSION_LABEL: Record<SubmissionState, string> = {
  submitted: "Awaiting review",
  changes_requested: "Changes requested",
  approved: "Approved",
  published: "Published",
};

/** One review comment or state change. Append-only, like the CRM timeline. */
export const SubmissionEvent = z.object({
  id: z.string(),
  state: SubmissionState.nullable(),
  comment: z.string(),
  at: z.string().datetime(),
  byName: z.string(),
});
export type SubmissionEvent = z.infer<typeof SubmissionEvent>;

export const Submission = z.object({
  id: z.string(),
  orgId: z.string(),
  campaignId: z.string(),
  influencerId: z.string(),
  displayName: z.string(),
  deliverableId: z.string().nullable(),
  platform: Platform,
  format: DeliverableFormat,
  caption: z.string(),
  /** A link to the draft. SENSO stores no media of its own. */
  mediaUrl: z.string().nullable(),
  state: SubmissionState,
  /** Set once the approved draft appears as a real attributed post. */
  publishedContentId: z.string().nullable(),
  revision: z.number().int(),
  events: z.array(SubmissionEvent),
  submittedAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Submission = z.infer<typeof Submission>;

export const SubmissionInput = z.object({
  campaignId: z.string().min(1),
  influencerId: z.string().min(1),
  deliverableId: z.string().nullable().default(null),
  platform: Platform,
  format: DeliverableFormat,
  caption: z.string().trim().min(1, "Add the caption").max(4000),
  mediaUrl: z.string().trim().url("Link to the draft").nullable().default(null),
});
export type SubmissionInput = z.infer<typeof SubmissionInput>;

export const ReviewInput = z.object({
  decision: z.enum(["approve", "request_changes", "mark_published"]),
  comment: z.string().trim().max(2000).optional(),
});
export type ReviewInput = z.infer<typeof ReviewInput>;
