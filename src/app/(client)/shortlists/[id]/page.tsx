import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { pluralise } from "@/lib/format";
import { requirePagePermission } from "@/server/auth/rbac";
import { getShortlist } from "@/server/repositories/workspace-repository";
import { PageBody, PageHeader } from "@/components/shell/app-shell";
import { ShortlistDetailView } from "@/components/shortlist/shortlist-detail";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  // Metadata runs before the page guard, so read it without a session-scoped
  // fetch; the page itself enforces both permission and tenancy.
  return { title: id.startsWith("sl_") ? "Shortlist" : "Shortlist not found" };
}

export default async function ShortlistPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requirePagePermission("shortlist:read", `/shortlists/${id}`);

  // getShortlist throws on a cross-tenant id, which the handler turns into a
  // not-found rather than confirming the resource exists elsewhere.
  const shortlist = getShortlist(user, id);
  if (!shortlist) notFound();

  return (
    <>
      <PageHeader
        title={shortlist.name}
        description={shortlist.description ?? undefined}
        breadcrumbs={[{ label: "Shortlists", href: "/shortlists" }, { label: shortlist.name }]}
        meta={
          <span className="text-[12px] text-ink-muted">
            {pluralise(shortlist.itemCount, "creator")} · created by {shortlist.createdByName}
          </span>
        }
      />
      <PageBody>
        <ShortlistDetailView shortlist={shortlist} />
      </PageBody>
    </>
  );
}
