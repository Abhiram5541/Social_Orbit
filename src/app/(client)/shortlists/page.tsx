import type { Metadata } from "next";
import { requirePagePermission } from "@/server/auth/rbac";
import { listShortlists } from "@/server/repositories/workspace-repository";
import { toSummary } from "@/server/repositories/influencer-repository";
import { PageBody, PageHeader } from "@/components/shell/app-shell";
import { ShortlistManager } from "@/components/shortlist/shortlist-manager";

export const metadata: Metadata = { title: "Shortlists" };
export const dynamic = "force-dynamic";

export default async function ShortlistsPage({
  searchParams,
}: {
  searchParams: Promise<{ add?: string }>;
}) {
  const user = await requirePagePermission("shortlist:read", "/shortlists");
  const { add } = await searchParams;

  // Resolve the hand-off from discovery server-side so the dialog opens with a
  // real creator rather than fetching one after mount.
  const pendingAdd = add ? toSummary(add) : null;

  return (
    <>
      <PageHeader
        title="Shortlists"
        description="Group creators you are considering, annotate them for your team, and move a list straight into a campaign."
      />
      <PageBody>
        <ShortlistManager shortlists={listShortlists(user)} pendingAdd={pendingAdd} />
      </PageBody>
    </>
  );
}
