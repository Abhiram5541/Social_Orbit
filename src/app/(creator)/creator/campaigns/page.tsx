import type { Metadata } from "next";
import { Megaphone } from "lucide-react";
import { requireOwnProfile } from "@/server/auth/creator";
import { PageBody, PageHeader } from "@/components/shell/app-shell";
import { Card } from "@/components/ui/card";
import { EmptyState, Notice } from "@/components/ui/states";

export const metadata: Metadata = { title: "Campaigns" };
export const dynamic = "force-dynamic";

export default async function CreatorCampaignsPage() {
  await requireOwnProfile("/creator/campaigns");

  return (
    <>
      <PageHeader
        title="Campaigns"
        description="Campaigns you have been invited to, and how your posts performed against each tracking hashtag."
      />
      <PageBody className="space-y-4">
        <Notice tone="info" title="What brands can and cannot see">
          A brand running a campaign sees the performance of posts you published carrying
          their tracking hashtag. They do not see your other campaigns, your rates with other
          brands, or your audience demographics.
        </Notice>

        <Card>
          <EmptyState
            icon={Megaphone}
            title="No campaign invitations"
            description="When a brand adds you to a campaign you will see it here, along with the tracking hashtag and the performance of your attributed posts."
          />
        </Card>
      </PageBody>
    </>
  );
}
