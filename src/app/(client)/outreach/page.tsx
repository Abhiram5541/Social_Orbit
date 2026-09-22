import type { Metadata } from "next";
import { requirePagePermission } from "@/server/auth/rbac";
import { listCrm } from "@/server/repositories/crm-repository";
import { listCampaigns } from "@/server/repositories/workspace-repository";
import { listMessages, listTemplates } from "@/server/services/outreach-service";
import { notifyChannels } from "@/server/services/notification-service";
import { PageBody, PageHeader } from "@/components/shell/app-shell";
import { Notice } from "@/components/ui/states";
import { OutreachComposer } from "@/components/crm/outreach-composer";

export const metadata: Metadata = { title: "Outreach" };
export const dynamic = "force-dynamic";

export default async function OutreachPage() {
  const user = await requirePagePermission("outreach:send", "/outreach");
  const mailReady = notifyChannels().email;

  return (
    <>
      <PageHeader
        eyebrow="Activate"
        title="Outreach"
        description="Email creators from your own relationship records, individually or in bulk. Every send is logged on the creator's timeline, and a creator who has opted out is never contacted."
      />
      <PageBody className="space-y-4">
        {!mailReady && (
          <Notice tone="caution" title="Mail is not configured">
            Sends will be refused until a verified sender is set on the server
            (RESEND_API_KEY and EMAIL_FROM). Everything else here works; nothing is
            queued silently.
          </Notice>
        )}
        <OutreachComposer
          records={listCrm(user)}
          templates={listTemplates(user)}
          campaigns={listCampaigns(user).map((campaign) => ({ id: campaign.id, name: campaign.name }))}
          history={listMessages(user)}
        />
      </PageBody>
    </>
  );
}
