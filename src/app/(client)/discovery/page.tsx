import type { Metadata } from "next";
import { Suspense } from "react";
import { requirePagePermission } from "@/server/auth/rbac";
import { quotaFor } from "@/server/repositories/usage-repository";
import { PageHeader } from "@/components/shell/app-shell";
import { TableSkeleton } from "@/components/ui/states";
import { DiscoveryView } from "@/components/discovery/discovery-view";

export const metadata: Metadata = { title: "Discovery" };
export const dynamic = "force-dynamic";

export default async function DiscoveryPage() {
  // Permission is checked here and again in the route handler the view calls.
  // This one only decides what to render; that one is the actual control.
  const user = await requirePagePermission("influencer:search", "/discovery");

  return (
    <div className="flex min-h-[calc(100dvh-var(--spacing-topbar))] flex-col">
      <PageHeader
        title="Discovery"
        description="Search the SocialOrbit database by market, category, audience quality and campaign fit. Filters combine with AND."
      />
      <Suspense fallback={<TableSkeleton rows={10} columns={7} />}>
        <DiscoveryView initialQuota={quotaFor(user.orgId, user.plan)} />
      </Suspense>
    </div>
  );
}
