import type { Metadata } from "next";
import { requirePagePermission } from "@/server/auth/rbac";
import { lowConfidenceQueue } from "@/server/repositories/ops-repository";
import { PageBody, PageHeader } from "@/components/shell/app-shell";
import { ReviewTable } from "@/components/admin/review-table";

export const metadata: Metadata = { title: "Anomaly queue" };
export const dynamic = "force-dynamic";

export default async function Page() {
  await requirePagePermission("analytics:anomaly_queue", "/admin/anomalies");
  const items = lowConfidenceQueue();

  return (
    <>
      <PageHeader
        title="Anomaly queue"
        description="Content performing outside a creator's own established range, and profiles whose confidence is too thin to publish without a warning."
        meta={
          <span className="text-[12px] text-ink-muted">
            {items.length} {items.length === 1 ? "item" : "items"} waiting
          </span>
        }
      />
      <PageBody>
        <ReviewTable
          items={items}
          emptyTitle="No anomalies flagged"
          emptyDescription="Nothing in the indexed catalogue deviates beyond the detection threshold."
        />
      </PageBody>
    </>
  );
}
