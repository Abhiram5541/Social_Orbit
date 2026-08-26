import type { Metadata } from "next";
import { requirePagePermission } from "@/server/auth/rbac";
import { verificationQueue } from "@/server/repositories/ops-repository";
import { PageBody, PageHeader } from "@/components/shell/app-shell";
import { ReviewTable } from "@/components/admin/review-table";

export const metadata: Metadata = { title: "Verification queue" };
export const dynamic = "force-dynamic";

export default async function Page() {
  await requirePagePermission("verification:review", "/admin/verification");
  const items = verificationQueue();

  return (
    <>
      <PageHeader
        title="Verification queue"
        description="Creators who have connected an account but have not yet passed identity matching. Verified status is only ever issued after a successful match — never from public data."
        meta={
          <span className="text-[12px] text-ink-muted">
            {items.length} {items.length === 1 ? "item" : "items"} waiting
          </span>
        }
      />
      <PageBody>
        <ReviewTable
          items={items}
          emptyTitle="No creators awaiting verification"
          emptyDescription="Every connected account has been matched or rejected."
        />
      </PageBody>
    </>
  );
}
