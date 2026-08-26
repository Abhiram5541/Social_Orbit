import type { Metadata } from "next";
import type { InfluencerSummary } from "@/lib/contracts/influencer";
import { requirePagePermission } from "@/server/auth/rbac";
import { toSummary } from "@/server/repositories/influencer-repository";
import {
  getShortlist,
  shortlistMemberIds,
} from "@/server/repositories/workspace-repository";
import { PageBody, PageHeader } from "@/components/shell/app-shell";
import { CampaignForm } from "@/components/campaign/campaign-form";

export const metadata: Metadata = { title: "New campaign" };
export const dynamic = "force-dynamic";

export default async function NewCampaignPage({
  searchParams,
}: {
  searchParams: Promise<{ shortlist?: string; influencer?: string }>;
}) {
  const user = await requirePagePermission("campaign:write", "/campaigns/new");
  const { shortlist, influencer } = await searchParams;

  // Candidates arrive from a shortlist hand-off or from a single profile.
  const ids = shortlist
    ? shortlistMemberIds(user, shortlist)
    : influencer
      ? [influencer]
      : [];

  const candidates = ids
    .map((id) => toSummary(id))
    .filter((summary): summary is InfluencerSummary => summary !== null);

  const source = shortlist ? getShortlist(user, shortlist) : null;

  return (
    <>
      <PageHeader
        title="New campaign"
        description="A campaign needs a tracking hashtag before it can measure anything. Everything else can be filled in later."
        breadcrumbs={[{ label: "Campaigns", href: "/campaigns" }, { label: "New" }]}
      />
      <PageBody>
        <CampaignForm
          candidates={candidates}
          presetName={source ? `${source.name} campaign` : undefined}
        />
      </PageBody>
    </>
  );
}
