import { z } from "zod";
import { Platform } from "./common";

/* ---------------------------------------------------------------------------
 * Creator onboarding — an application, reviewed by a person.
 *
 * A creator applies through a link; nothing they type becomes a published
 * profile until somebody approves it. Two rules shape the shape of it:
 *
 *   - What a creator states about themselves is a *claim*, not an
 *     observation. An applicant's follower count is never written into the
 *     index: the index is built from platform APIs, and a self-reported
 *     figure wearing the same styling as a measured one is the exact
 *     confusion this product exists to prevent.
 *   - Tax and payment details are collected because a payout needs them, and
 *     are never shown in discovery, search or any client-facing surface.
 * ------------------------------------------------------------------------ */

export const ApplicationStatus = z.enum([
  "draft",
  "submitted",
  "in_review",
  "approved",
  "rejected",
  "withdrawn",
]);
export type ApplicationStatus = z.infer<typeof ApplicationStatus>;

export const APPLICATION_STATUS_LABEL: Record<ApplicationStatus, string> = {
  draft: "Started",
  submitted: "Submitted",
  in_review: "In review",
  approved: "Approved",
  rejected: "Not accepted",
  withdrawn: "Withdrawn",
};

export const ApplicantSocial = z.object({
  platform: Platform,
  handle: z.string().trim().min(1).max(80),
  /** The applicant's own claim. Never written to the index. */
  statedFollowers: z.number().int().nonnegative().nullable(),
  /** Set once the connector resolved the handle to a real account. */
  resolvedInfluencerId: z.string().nullable(),
  resolvedFollowers: z.number().int().nullable(),
});
export type ApplicantSocial = z.infer<typeof ApplicantSocial>;

/** Held for payouts only. Never surfaced to a client. */
export const PayoutDetails = z.object({
  legalName: z.string().nullable(),
  country: z.string().nullable(),
  taxId: z.string().nullable(),
  /** Last four only — SENSO records how to pay, not the full instrument. */
  accountLast4: z.string().nullable(),
  bankName: z.string().nullable(),
  currency: z.string().nullable(),
});
export type PayoutDetails = z.infer<typeof PayoutDetails>;

export const ApplicationStep = z.enum(["profile", "socials", "payout", "review"]);
export type ApplicationStep = z.infer<typeof ApplicationStep>;

export const Application = z.object({
  id: z.string(),
  /** The organisation that invited them, when the link came from one. */
  orgId: z.string().nullable(),
  token: z.string(),
  status: ApplicationStatus,
  name: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
  country: z.string().nullable(),
  bio: z.string().nullable(),
  categories: z.array(z.string()),
  socials: z.array(ApplicantSocial),
  payout: PayoutDetails,
  /** Which sections are complete, so the applicant sees their own progress. */
  completed: z.array(ApplicationStep),
  reviewNote: z.string().nullable(),
  reviewedByName: z.string().nullable(),
  reviewedAt: z.string().datetime().nullable(),
  /** Set on approval: the index record this applicant was matched to. */
  linkedInfluencerId: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Application = z.infer<typeof Application>;

/** What a client-side reviewer sees. Payout details are stripped. */
export const ApplicationSummary = Application.omit({ token: true, payout: true }).extend({
  payoutProvided: z.boolean(),
});
export type ApplicationSummary = z.infer<typeof ApplicationSummary>;

export const ApplicationStartInput = z.object({
  name: z.string().trim().min(2, "Enter your name").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
});
export type ApplicationStartInput = z.infer<typeof ApplicationStartInput>;

export const ApplicationPatch = z.object({
  phone: z.string().trim().max(40).nullable().optional(),
  country: z.string().trim().max(60).nullable().optional(),
  bio: z.string().trim().max(2000).nullable().optional(),
  categories: z.array(z.string().trim().min(2).max(40)).max(8).optional(),
  socials: z
    .array(
      z.object({
        platform: Platform,
        handle: z.string().trim().min(1).max(80),
        statedFollowers: z.number().int().nonnegative().nullable().default(null),
      }),
    )
    .max(6)
    .optional(),
  payout: PayoutDetails.partial().optional(),
  submit: z.boolean().optional(),
});
export type ApplicationPatch = z.infer<typeof ApplicationPatch>;

export const ApplicationDecisionInput = z.object({
  decision: z.enum(["approve", "reject", "in_review"]),
  note: z.string().trim().max(2000).optional(),
  /** Required to approve: the index record this applicant really is. */
  linkedInfluencerId: z.string().trim().min(1).nullable().default(null),
});
export type ApplicationDecisionInput = z.infer<typeof ApplicationDecisionInput>;
