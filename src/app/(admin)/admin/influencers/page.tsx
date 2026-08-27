import type { Metadata } from "next";
import { Suspense } from "react";
import { requirePagePermission } from "@/server/auth/rbac";
import { quotaFor } from "@/server/repositories/usage-repository";
import { databaseStats } from "@/server/repositories/ops-repository";
import { PageHeader } from "@/components/shell/app-shell";
import { TableSkeleton } from "@/components/ui/states";
import { DiscoveryView } from "@/components/discovery/discovery-view";

export const metadata: Metadata = { title: "Influencers" };
export const dynamic = "force-dynamic";

/**
 * Operators search the same index clients do — one search implementation, no
 * second code path to drift. Platform staff are simply not metered against a
 * client plan.
 */
export default async function AdminInfluencersPage() {
  const user = await requirePagePermission("influencer:read", "/admin/influencers");
  const stats = databaseStats();

  return (
    <div className="flex min-h-[calc(100dvh-var(--spacing-topbar))] flex-col">
      <PageHeader
        title="Influencer database"
        description="The canonical creator index. Operators are not metered against a client search allowance."
        meta={
          <span className="text-[12px] text-ink-muted">
            {stats.published} published · {stats.inReview} in review · {stats.verified} verified
          </span>
        }
      />
      <Suspense fallback={<TableSkeleton rows={10} columns={7} />}>
        <DiscoveryView
          initialQuota={quotaFor(user.orgId, user.plan)}
          basePath="/admin/influencers"
          canShortlist={false}
        />
      </Suspense>
    </div>
  );
}
