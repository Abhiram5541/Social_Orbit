import type { Metadata } from "next";
import { requirePageSession } from "@/server/auth/rbac";
import { PageBody, PageHeader } from "@/components/shell/app-shell";
import { SettingsPanels } from "@/components/shell/settings-page";

export const metadata: Metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requirePageSession("/creator/settings");
  return (
    <>
      <PageHeader title="Settings" description="Your account, security and permissions." />
      <PageBody>
        <SettingsPanels user={user} />
      </PageBody>
    </>
  );
}
