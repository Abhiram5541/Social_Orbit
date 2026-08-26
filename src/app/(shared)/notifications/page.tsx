import type { Metadata } from "next";
import { requirePageSession } from "@/server/auth/rbac";
import { quotaFor } from "@/server/repositories/usage-repository";
import { getShortlist, listShortlists } from "@/server/repositories/workspace-repository";
import { toSummary } from "@/server/repositories/influencer-repository";
import { PageBody, PageHeader } from "@/components/shell/app-shell";
import {
  NotificationsList,
  type NotificationItem,
} from "@/components/shell/notifications-page";

export const metadata: Metadata = { title: "Notifications" };
export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const user = await requirePageSession("/notifications");
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
        at: summary.lastActiveAt ?? new Date().toISOString(),
        href: `/influencers/${summary.id}`,
      });
    }
    if (summary.risk === "high") {
      items.push({
        id: `risk-${summary.id}`,
        kind: "brand_safety",
        severity: "critical",
        title: `${summary.displayName} is flagged high risk`,
        detail: "Audience-quality or brand-safety signals crossed the escalation threshold.",
        at: new Date().toISOString(),
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
        at: new Date().toISOString(),
        href: `/influencers/${summary.id}`,
      });
    }
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
      detail: `Your allowance resets on ${new Date(quota.resetsAt).toDateString()}.`,
      at: new Date().toISOString(),
      href: "/usage",
    });
  }

  items.sort((a, b) => b.at.localeCompare(a.at));

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Signals detected on the creators you track, and account events that need your attention."
      />
      <PageBody>
        <NotificationsList items={items} />
      </PageBody>
    </>
  );
}
