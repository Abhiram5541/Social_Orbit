import type { SessionUser } from "@/lib/contracts/auth";
import type { NotificationItem } from "@/lib/contracts/notifications";
import { formatDate } from "@/lib/format";
import { toSummary } from "@/server/repositories/influencer-repository";
import { quotaFor } from "@/server/repositories/usage-repository";
import {
  getCampaign,
  getShortlist,
  listCampaigns,
  listShortlists,
} from "@/server/repositories/workspace-repository";
import { expiringContracts } from "./deal-service";

/* ---------------------------------------------------------------------------
 * Alerts for one person: real detections on the creators their organisation
 * tracks, plus their plan's allowance. Derived at read time from the current
 * state, so nothing is stored and nothing is invented — an empty inbox says
 * so. The notifications page draws this list; the daily digest emails what
 * is new in it.
 * ------------------------------------------------------------------------ */

export function alertsFor(user: SessionUser): NotificationItem[] {
  // Platform staff have no plan quota of their own to warn about.
  const quota = user.orgKind === "client" ? quotaFor(user.orgId, user.plan) : null;

  // Alerts are derived from real detections on the creators this org tracks.
  const tracked = listShortlists(user)
    .flatMap((shortlist) => getShortlist(user, shortlist.id)?.items ?? [])
    .filter(
      (item, index, list) =>
        list.findIndex((other) => other.influencerId === item.influencerId) === index,
    );

  const items: NotificationItem[] = [];

  for (const item of tracked) {
    const summary = toSummary(item.influencerId);
    if (!summary) continue;

    if (summary.activity === "dormant") {
      items.push({
        id: `dormant-${summary.id}`,
        kind: "dormancy",
        severity: "warning",
        title: `${summary.displayName} has gone dormant`,
        detail: "No qualifying publication in over 90 days. Recent figures should be read as historical.",
        // The last observed publication is the event; when even that is
        // unknown, the row carries no time rather than a minted one.
        at: summary.lastActiveAt ?? undefined,
        href: `/influencers/${summary.id}`,
      });
    }
    if (summary.risk === "high") {
      items.push({
        id: `risk-${summary.id}`,
        kind: "brand_safety",
        severity: "critical",
        title: `${summary.displayName} is flagged high risk`,
        // Current state, not a dated detection — no timestamp is honest;
        // "just now" on every visit would be a manufactured observation.
        detail: "Audience-quality or brand-safety signals crossed the escalation threshold.",
        href: `/influencers/${summary.id}`,
      });
    }
    if (summary.confidence < 50) {
      items.push({
        id: `confidence-${summary.id}`,
        kind: "data_stale",
        severity: "info",
        title: `Preliminary confidence on ${summary.displayName}`,
        detail: `Confidence is ${Math.round(summary.confidence)}%. There is not enough history or source authority to rely on these numbers yet.`,
        href: `/influencers/${summary.id}`,
      });
    }
  }

  // Deliverables: what is due soon and what is already late. Counted from
  // attributed posts, never from a status somebody set by hand (D44), so the
  // reminder cannot be silenced by marking a row done.
  const today = new Date().toISOString().slice(0, 10);
  const soon = new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10);

  for (const summary of listCampaigns(user)) {
    if (summary.status === "archived" || summary.status === "completed") continue;
    const campaign = getCampaign(user, summary.id);
    if (!campaign) continue;

    for (const participant of campaign.participants) {
      const { fulfilment } = participant;
      if (fulfilment.state === "fulfilled" || fulfilment.state === "none_required") continue;
      const due = fulfilment.dueOn;
      if (!due) continue;

      const outstanding = Math.max(0, fulfilment.required - fulfilment.published);
      if (due < today) {
        items.push({
          id: `late-${campaign.id}-${participant.influencerId}`,
          kind: "deliverable_overdue",
          severity: "critical",
          title: `${participant.displayName} is late on ${campaign.name}`,
          detail: `${outstanding} of ${fulfilment.required} still unpublished; due ${formatDate(due)}.`,
          at: `${due}T00:00:00.000Z`,
          href: `/campaigns/${campaign.id}`,
        });
      } else if (due <= soon) {
        items.push({
          id: `due-${campaign.id}-${participant.influencerId}`,
          kind: "deliverable_due",
          severity: "warning",
          title: `${participant.displayName} is due on ${campaign.name}`,
          detail: `${outstanding} of ${fulfilment.required} outstanding, due ${formatDate(due)}.`,
          at: `${due}T00:00:00.000Z`,
          href: `/campaigns/${campaign.id}`,
        });
      }
    }
  }

  for (const contract of expiringContracts(user, 30)) {
    items.push({
      id: `contract-${contract.id}`,
      kind: "contract_expiring",
      severity: "warning",
      title: `Usage rights end soon: ${contract.displayName} on ${contract.campaignName}`,
      detail: `Rights expire on ${formatDate(contract.usageRights.expiresOn!)}. Renew them or stop running the content.`,
      at: `${contract.usageRights.expiresOn}T00:00:00.000Z`,
      href: `/campaigns/${contract.campaignId}`,
    });
  }

  if (quota && quota.limit !== null && (quota.remaining ?? 0) <= 2) {
    items.push({
      id: "quota",
      kind: "quota_warning",
      severity: quota.remaining === 0 ? "critical" : "warning",
      title:
        quota.remaining === 0
          ? "Monthly search allowance used"
          : `${quota.remaining} searches remaining`,
      detail: `Your allowance resets on ${formatDate(quota.resetsAt)}.`,
      href: "/usage",
    });
  }

  // Dated events newest first; state-derived rows carry no time and sort
  // after them. The list itself pulls critical severities to the top.
  items.sort((a, b) => (b.at ?? "").localeCompare(a.at ?? ""));

  return items;
}
