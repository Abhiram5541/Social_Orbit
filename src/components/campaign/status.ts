import type { CampaignStatus, ParticipantStatus } from "@/lib/contracts/campaign";
import type { BadgeTone } from "@/components/ui/badge";

/* ---------------------------------------------------------------------------
 * Status → presentation maps, defined once so the campaign list and the
 * campaign detail header cannot drift when a status is added. They live with
 * the components rather than in contracts: a badge tone is a design decision,
 * not part of the wire shape.
 * ------------------------------------------------------------------------ */

export const CAMPAIGN_STATUS_TONE: Record<CampaignStatus, BadgeTone> = {
  draft: "caution",
  planning: "caution",
  live: "positive",
  completed: "neutral",
  archived: "caution",
};

export const PARTICIPANT_STATUS_LABEL: Record<ParticipantStatus, string> = {
  shortlisted: "Shortlisted",
  invited: "Invited",
  negotiating: "Negotiating",
  confirmed: "Confirmed",
  delivering: "Delivering",
  delivered: "Delivered",
  declined: "Declined",
};

export const PARTICIPANT_TONE: Record<ParticipantStatus, BadgeTone> = {
  shortlisted: "neutral",
  invited: "neutral",
  negotiating: "caution",
  confirmed: "brand",
  delivering: "brand",
  delivered: "positive",
  declined: "critical",
};
