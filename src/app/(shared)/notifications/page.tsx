import type { Metadata } from "next";
import { requirePageSession } from "@/server/auth/rbac";
import { alertsFor } from "@/server/services/alert-service";
import { PageBody, PageHeader } from "@/components/shell/app-shell";
import { NotificationsList } from "@/components/shell/notifications-page";

export const metadata: Metadata = { title: "Notifications" };
export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const user = await requirePageSession("/notifications");
  const items = alertsFor(user);

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
