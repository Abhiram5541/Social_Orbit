import type { Metadata } from "next";
import { requirePagePermission } from "@/server/auth/rbac";
import { listShortlists } from "@/server/repositories/workspace-repository";
import { toSummary } from "@/server/repositories/influencer-repository";
import { shortlistSignals } from "@/server/services/workspace-intelligence";
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

  // ShortlistManager renders the page header itself: the header's "New
  // shortlist" action opens the create dialog it owns.
  return (
    <ShortlistManager
      shortlists={listShortlists(user)}
      signals={shortlistSignals(user)}
      pendingAdd={pendingAdd}
    />
  );
}
