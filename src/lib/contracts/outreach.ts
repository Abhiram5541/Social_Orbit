import { z } from "zod";

/* ---------------------------------------------------------------------------
 * Creator outreach.
 *
 * Email a creator about a campaign, from a template, and keep the exchange on
 * their relationship timeline. Two rules shape everything here:
 *
 *   - A creator who opted out is never contacted again, by anybody in the
 *     organisation, through any template. The check is in the send path, not
 *     in the interface.
 *   - What the provider tells us is all we claim. "Sent" means the provider
 *     accepted it; delivered, opened and bounced appear only when a webhook
 *     says so, and are absent otherwise rather than assumed.
 * ------------------------------------------------------------------------ */

export const MessageStatus = z.enum([
  "sent",
  "delivered",
  "opened",
  "replied",
  "bounced",
  "complained",
  "failed",
]);
export type MessageStatus = z.infer<typeof MessageStatus>;

export const MESSAGE_STATUS_LABEL: Record<MessageStatus, string> = {
  sent: "Sent",
  delivered: "Delivered",
  opened: "Opened",
  replied: "Replied",
  bounced: "Bounced",
  complained: "Marked as spam",
  failed: "Failed",
};

/** Placeholders a template may use. Anything else is left as written. */
export const TEMPLATE_TOKENS = [
  "creator.name",
  "creator.handle",
  "campaign.name",
  "campaign.hashtag",
  "sender.name",
  "org.name",
] as const;

export const OutreachTemplate = z.object({
  id: z.string(),
  orgId: z.string(),
  name: z.string(),
  subject: z.string(),
  body: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type OutreachTemplate = z.infer<typeof OutreachTemplate>;

export const TemplateInput = z.object({
  name: z.string().trim().min(2, "Name the template").max(80),
  subject: z.string().trim().min(2, "Write a subject").max(200),
  body: z.string().trim().min(10, "Write the message").max(8000),
});
export type TemplateInput = z.infer<typeof TemplateInput>;

export const OutreachMessage = z.object({
  id: z.string(),
  orgId: z.string(),
  influencerId: z.string(),
  displayName: z.string(),
  campaignId: z.string().nullable(),
  templateId: z.string().nullable(),
  to: z.string(),
  subject: z.string(),
  body: z.string(),
  status: MessageStatus,
  /** Provider events, appended as the webhook reports them. */
  events: z.array(z.object({ status: MessageStatus, at: z.string().datetime() })),
  sentAt: z.string().datetime(),
  sentByName: z.string(),
  error: z.string().nullable(),
});
export type OutreachMessage = z.infer<typeof OutreachMessage>;

export const SendInput = z.object({
  influencerIds: z.array(z.string().min(1)).min(1, "Pick at least one creator").max(50),
  campaignId: z.string().nullable().default(null),
  templateId: z.string().nullable().default(null),
  subject: z.string().trim().min(2).max(200),
  body: z.string().trim().min(10).max(8000),
});
export type SendInput = z.infer<typeof SendInput>;

/** One creator's outcome in a bulk send. */
export const SendOutcome = z.object({
  influencerId: z.string(),
  displayName: z.string(),
  ok: z.boolean(),
  detail: z.string(),
});
export type SendOutcome = z.infer<typeof SendOutcome>;
