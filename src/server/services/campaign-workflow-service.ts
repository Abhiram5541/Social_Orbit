import { randomBytes } from "node:crypto";
import type { SessionUser } from "@/lib/contracts/auth";
import type {
  Proposal,
  ProposalDecisionInput,
  ProposalInput,
  ProposalLine,
  ReviewInput,
  Submission,
  SubmissionInput,
} from "@/lib/contracts/campaign-workflow";
import { ApiFailure, assertTenantAccess } from "@/server/auth/rbac";
import { appRows, persist } from "@/server/data/app-store";
import { noteIfTracked } from "@/server/repositories/crm-repository";
import { toSummary } from "@/server/repositories/influencer-repository";
import { getCampaign } from "@/server/repositories/workspace-repository";

/* ---------------------------------------------------------------------------
 * Campaign proposals and content review.
 *
 * Both are read by people outside the workspace — a brand contact deciding on
 * a roster, a creator sending a draft — so both are reached by an unguessable
 * token rather than a login. The token grants one campaign's proposal and
 * nothing else: it is not a session, it cannot list campaigns, and it expires
 * on a date the person who created it set.
 *
 * A decision is never inferred. A proposal is complete when every line has
 * been decided, not when a deadline passes; a submission is published when
 * somebody says it is, and the platform links it to a real attributed post
 * rather than assuming the two are the same thing.
 * ------------------------------------------------------------------------ */

/**
 * A proposal is a document sent to a client, so it snapshots what was
 * proposed: the names, figures and rates as they stood when it was created.
 * Re-deriving them would change what a client sees after they have already
 * read it — and the public read has no tenant session to derive them with.
 */
type ProposalRow = Proposal;
type SubmissionRow = Omit<Submission, "displayName">;

const proposals = () => appRows<ProposalRow>("proposals", () => []);
const submissions = () => appRows<SubmissionRow>("submissions", () => []);

const nextId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/* --- Proposals ---------------------------------------------------------- */

const toProposal = (row: ProposalRow): Proposal => row;

export function listProposals(user: SessionUser, campaignId?: string): Proposal[] {
  return proposals()
    .filter((row) => row.orgId === user.orgId)
    .filter((row) => !campaignId || row.campaignId === campaignId)
    .map(toProposal)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function createProposal(user: SessionUser, input: ProposalInput): Proposal {
  const campaign = getCampaign(user, input.campaignId);
  if (!campaign) throw new ApiFailure("not_found", "Campaign not found.");
  assertTenantAccess(user, campaign.orgId);
  if (campaign.participants.length === 0) {
    throw new ApiFailure("validation_failed", "Add creators to the campaign before proposing it.");
  }

  const previous = proposals().filter((row) => row.campaignId === campaign.id);
  const row: ProposalRow = {
    id: nextId("prp"),
    orgId: user.orgId,
    campaignId: campaign.id,
    // 32 bytes: a link that is guessable is a link that leaks a client's
    // roster and its rates.
    token: randomBytes(24).toString("base64url"),
    version: previous.length + 1,
    note: input.note ?? null,
    expiresOn: input.expiresOn,
    campaignName: campaign.name,
    lines: campaign.participants.map((participant): ProposalLine => {
      const summary = toSummary(participant.influencerId);
      return {
        influencerId: participant.influencerId,
        displayName: summary?.displayName ?? participant.displayName,
        primaryHandle: summary?.primaryHandle ?? participant.primaryHandle,
        avatarUrl: summary?.avatarUrl ?? null,
        followers: summary?.followers ?? participant.followers,
        healthScore: summary?.healthScore ?? participant.healthScore,
        agreedRate: participant.agreedRate,
        currency: participant.currency,
        decision: "pending",
        comment: null,
        decidedAt: null,
      };
    }),
    createdAt: new Date().toISOString(),
    createdByName: user.name,
    completedAt: null,
  };
  proposals().push(row);
  persist("proposals", [row]);
  return toProposal(row);
}

/** The public read: by token only, and only while the link is live. */
export function proposalByToken(token: string): Proposal | null {
  const row = proposals().find((entry) => entry.token === token);
  if (!row) return null;
  if (row.expiresOn && new Date().toISOString().slice(0, 10) > row.expiresOn) return null;
  return toProposal(row);
}

export function decideProposalLine(
  token: string,
  input: ProposalDecisionInput,
  byName = "Client",
): Proposal | null {
  const row = proposals().find((entry) => entry.token === token);
  if (!row) return null;
  if (row.expiresOn && new Date().toISOString().slice(0, 10) > row.expiresOn) return null;

  const line = row.lines.find((entry) => entry.influencerId === input.influencerId);
  if (!line) return null;

  line.decision = input.decision;
  line.comment = input.comment?.trim() || null;
  line.decidedAt = new Date().toISOString();
  // Complete when every creator has been decided — not when a deadline
  // passes, because silence is not an approval.
  row.completedAt = row.lines.every((entry) => entry.decision !== "pending")
    ? new Date().toISOString()
    : null;
  persist("proposals", [row]);
  void byName;
  return toProposal(row);
}

/* --- Content submissions ------------------------------------------------ */

const toSubmission = (row: SubmissionRow): Submission => ({
  ...row,
  displayName: toSummary(row.influencerId)?.displayName ?? row.influencerId,
});

export function listSubmissions(
  user: SessionUser,
  filter: { campaignId?: string; influencerId?: string } = {},
): Submission[] {
  return submissions()
    .filter((row) => row.orgId === user.orgId)
    .filter((row) => !filter.campaignId || row.campaignId === filter.campaignId)
    .filter((row) => !filter.influencerId || row.influencerId === filter.influencerId)
    .map(toSubmission)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function createSubmission(user: SessionUser, input: SubmissionInput): Submission {
  const campaign = getCampaign(user, input.campaignId);
  if (!campaign) throw new ApiFailure("not_found", "Campaign not found.");
  assertTenantAccess(user, campaign.orgId);
  if (!campaign.participants.some((p) => p.influencerId === input.influencerId)) {
    throw new ApiFailure("validation_failed", "That creator is not on this campaign.");
  }

  const now = new Date().toISOString();
  const row: SubmissionRow = {
    id: nextId("sub"),
    orgId: campaign.orgId,
    campaignId: campaign.id,
    influencerId: input.influencerId,
    deliverableId: input.deliverableId,
    platform: input.platform,
    format: input.format,
    caption: input.caption,
    mediaUrl: input.mediaUrl,
    state: "submitted",
    publishedContentId: null,
    revision: 1,
    events: [
      { id: nextId("ev"), state: "submitted", comment: "Submitted for review", at: now, byName: user.name },
    ],
    submittedAt: now,
    updatedAt: now,
  };
  submissions().push(row);
  persist("submissions", [row]);
  noteIfTracked(user, input.influencerId, {
    kind: "content_submitted",
    body: `Draft submitted for ${campaign.name}`,
    refId: row.id,
  });
  return toSubmission(row);
}

export function reviewSubmission(
  user: SessionUser,
  submissionId: string,
  input: ReviewInput,
): Submission {
  const row = submissions().find((entry) => entry.id === submissionId);
  if (!row) throw new ApiFailure("not_found", "Submission not found.");
  assertTenantAccess(user, row.orgId);

  const state =
    input.decision === "approve"
      ? "approved"
      : input.decision === "mark_published"
        ? "published"
        : "changes_requested";

  // Requesting changes starts a new revision; approving does not, because
  // the thing approved is the draft that was reviewed.
  if (state === "changes_requested") row.revision += 1;
  row.state = state;
  row.updatedAt = new Date().toISOString();
  row.events.push({
    id: nextId("ev"),
    state,
    comment: input.comment?.trim() || "",
    at: row.updatedAt,
    byName: user.name,
  });
  persist("submissions", [row]);
  return toSubmission(row);
}

/**
 * Links an approved draft to the real post the tracker attributed. The two
 * are separate records on purpose: a draft is what a creator promised, an
 * attributed post is what the platform observed, and conflating them would
 * let an approval stand in for a publication nobody saw.
 */
export function linkPublishedContent(
  user: SessionUser,
  submissionId: string,
  contentId: string,
): Submission {
  const row = submissions().find((entry) => entry.id === submissionId);
  if (!row) throw new ApiFailure("not_found", "Submission not found.");
  assertTenantAccess(user, row.orgId);
  row.publishedContentId = contentId;
  row.state = "published";
  row.updatedAt = new Date().toISOString();
  row.events.push({
    id: nextId("ev"),
    state: "published",
    comment: `Linked to attributed post ${contentId}`,
    at: row.updatedAt,
    byName: user.name,
  });
  persist("submissions", [row]);
  return toSubmission(row);
}
