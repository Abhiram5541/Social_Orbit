import type { Metadata } from "next";
import { requireOwnProfile } from "@/server/auth/creator";
import { PLATFORM_LABEL } from "@/lib/contracts/common";
import { PageBody, PageHeader } from "@/components/shell/app-shell";
import {
  NotificationsList,
  type NotificationItem,
} from "@/components/shell/notifications-page";

export const metadata: Metadata = { title: "Notifications" };
export const dynamic = "force-dynamic";

export default async function CreatorNotificationsPage() {
  const { profile } = await requireOwnProfile("/creator/notifications");
  const items: NotificationItem[] = [];

  for (const account of profile.socialAccounts) {
    if (account.needsReauth) {
      items.push({
        id: `reauth-${account.id}`,
        kind: "oauth_reauth",
        severity: "critical",
        title: `Reconnect your ${PLATFORM_LABEL[account.platform]} account`,
        detail:
          "The stored token can no longer be refreshed, so your authorized metrics are frozen at the last successful sync.",
        at: account.lastSyncedAt ?? new Date().toISOString(),
        href: "/creator/connections",
      });
    }
  }

  if (profile.verification === "pending") {
    items.push({
      id: "verification",
      kind: "verification",
      severity: "info",
      title: "Verification is still pending",
      detail:
        "Your account is connected. The identity match has not completed yet — a reviewer will confirm shortly.",
      at: new Date().toISOString(),
      href: "/creator/verification",
    });
  }

  if (profile.activity === "dormant") {
    items.push({
      id: "dormancy",
      kind: "dormancy",
      severity: "warning",
      title: "Your profile is showing as dormant",
      detail:
        "No qualifying publication in over 90 days. Brands filtering for active creators will not see you.",
      at: profile.lastActiveAt ?? new Date().toISOString(),
      href: "/creator/analytics",
    });
  }

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Changes to your profile, connections and verification status."
      />
      <PageBody>
        <NotificationsList items={items} />
      </PageBody>
    </>
  );
}
