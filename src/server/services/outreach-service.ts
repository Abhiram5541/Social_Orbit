import type { SessionUser } from "@/lib/contracts/auth";
import type {
  MessageStatus,
  OutreachMessage,
  OutreachTemplate,
  SendInput,
  SendOutcome,
  TemplateInput,
} from "@/lib/contracts/outreach";
import { ApiFailure, assertTenantAccess } from "@/server/auth/rbac";
import { appRows, persist } from "@/server/data/app-store";
import {
  addInteraction,
  contactableEmail,
  getOrCreateCrm,
} from "@/server/repositories/crm-repository";
import { toSummary } from "@/server/repositories/influencer-repository";
import { getCampaign } from "@/server/repositories/workspace-repository";
import { sendEmail } from "./notification-service";

/* ---------------------------------------------------------------------------
 * Outreach — email a creator, from a template, about a campaign.
 *
 * Every send goes through `deliver`, which is the only place the opt-out is
 * checked: a suppression enforced in the interface is a suppression that
 * stops working the first time somebody calls the API directly.
 *
 * A message claims only what the provider confirmed. Accepting it means
 * "sent"; delivered, opened, bounced and complained arrive later through the
 * provider webhook and are appended as events. Nothing is inferred — an
 * unopened email is an email we have no open event for, which is not the
 * same as one that was ignored.
 * ------------------------------------------------------------------------ */

type TemplateRow = OutreachTemplate;
/** The creator's name is resolved from the index on read, never stored. */
type MessageRow = Omit<OutreachMessage, "displayName">;

const templates = () => appRows<TemplateRow>("outreach_templates", () => []);
const messages = () => appRows<MessageRow>("outreach_messages", () => []);

const nextId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/* --- Templates ---------------------------------------------------------- */

export function listTemplates(user: SessionUser): OutreachTemplate[] {
  return templates()
    .filter((row) => row.orgId === user.orgId)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function createTemplate(user: SessionUser, input: TemplateInput): OutreachTemplate {
  const now = new Date().toISOString();
  const row: TemplateRow = {
    id: nextId("tpl"),
    orgId: user.orgId,
    name: input.name,
    subject: input.subject,
    body: input.body,
    createdAt: now,
    updatedAt: now,
  };
  templates().push(row);
  persist("outreach_templates", [row]);
  return row;
}

export function deleteTemplate(user: SessionUser, id: string): void {
  const row = templates().find((entry) => entry.id === id);
  if (!row) throw new ApiFailure("not_found", "Template not found.");
  assertTenantAccess(user, row.orgId);
  const list = templates();
  list.splice(list.indexOf(row), 1);
  // The store replaces a kind's rows from the process copy, so persisting
  // any surviving row rewrites the set; an empty set needs one write too.
  persist("outreach_templates", list.filter((entry) => entry.orgId === user.orgId));
}

/* --- Personalisation ---------------------------------------------------- */

/**
 * `{{creator.name}}` and friends. An unknown token is left exactly as
 * written rather than replaced with an empty string: a sender proof-reading
 * their own draft should see the mistake, not a sentence with a hole in it.
 */
export function render(text: string, values: Record<string, string>): string {
  return text.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (whole, token: string) =>
    token in values ? values[token] : whole,
  );
}

function tokensFor(
  user: SessionUser,
  influencerId: string,
  campaignId: string | null,
): Record<string, string> {
  const summary = toSummary(influencerId);
  const campaign = campaignId ? getCampaign(user, campaignId) : null;
  return {
    "creator.name": summary?.displayName ?? "there",
    "creator.handle": summary?.primaryHandle ?? "",
    "campaign.name": campaign?.name ?? "",
    "campaign.hashtag": campaign?.hashtag ?? "",
    "sender.name": user.name,
    "org.name": user.orgName,
  };
}

/* --- Sending ------------------------------------------------------------ */

export interface SendReport {
  sent: number;
  skipped: number;
  outcomes: SendOutcome[];
}

export async function sendOutreach(user: SessionUser, input: SendInput): Promise<SendReport> {
  const report: SendReport = { sent: 0, skipped: 0, outcomes: [] };

  for (const influencerId of input.influencerIds) {
    const summary = toSummary(influencerId);
    const displayName = summary?.displayName ?? influencerId;

    // The record has to exist for the timeline entry to land somewhere, and
    // opening a creator is already how a relationship starts.
    getOrCreateCrm(user, influencerId);
    const to = contactableEmail(user, influencerId);

    if (!to) {
      report.skipped += 1;
      report.outcomes.push({
        influencerId,
        displayName,
        ok: false,
        detail: "No contactable address, or the creator opted out.",
      });
      continue;
    }

    const values = tokensFor(user, influencerId, input.campaignId);
    const subject = render(input.subject, values);
    const body = render(input.body, values);

    const delivered = await sendEmail({
      to,
      subject,
      html: `<div style="font-family:Inter,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1a0a2e">${body
        .split("\n")
        .map((line) => `<p style="margin:0 0 12px">${escapeHtml(line)}</p>`)
        .join("")}</div>`,
    });

    const row: MessageRow = {
      id: nextId("msg"),
      orgId: user.orgId,
      influencerId,
      campaignId: input.campaignId,
      templateId: input.templateId,
      to,
      subject,
      body,
      status: delivered ? "sent" : "failed",
      events: [{ status: delivered ? "sent" : "failed", at: new Date().toISOString() }],
      sentAt: new Date().toISOString(),
      sentByName: user.name,
      error: delivered ? null : "The mail provider is not configured or refused the message.",
    };
    messages().push(row);
    persist("outreach_messages", [row]);

    if (delivered) {
      report.sent += 1;
      addInteraction(user, influencerId, {
        kind: "email_sent",
        body: subject,
        refId: row.id,
      });
    } else {
      report.skipped += 1;
    }

    report.outcomes.push({
      influencerId,
      displayName,
      ok: delivered,
      detail: delivered ? `Sent to ${to}` : "The mail provider refused the message.",
    });
  }

  return report;
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function listMessages(user: SessionUser, influencerId?: string): OutreachMessage[] {
  return messages()
    .filter((row) => row.orgId === user.orgId)
    .filter((row) => !influencerId || row.influencerId === influencerId)
    .map((row) => ({ ...row, displayName: toSummary(row.influencerId)?.displayName ?? row.influencerId }))
    .sort((a, b) => b.sentAt.localeCompare(a.sentAt));
}

/**
 * A provider event. Statuses only move forward through the funnel, so a
 * delivery notice arriving after an open does not undo the open.
 */
const RANK: Record<MessageStatus, number> = {
  failed: 0,
  sent: 1,
  delivered: 2,
  opened: 3,
  replied: 4,
  bounced: 5,
  complained: 6,
};

export function recordProviderEvent(messageId: string, status: MessageStatus): boolean {
  const row = messages().find((entry) => entry.id === messageId);
  if (!row) return false;
  row.events.push({ status, at: new Date().toISOString() });
  if (RANK[status] > RANK[row.status]) row.status = status;
  persist("outreach_messages", [row]);
  return true;
}
