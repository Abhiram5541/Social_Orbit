import type { Metadata } from "next";
import { Suspense } from "react";
import { SlidersHorizontal } from "lucide-react";
import { formatCompact } from "@/lib/format";
import { requirePagePermission } from "@/server/auth/rbac";
import { countInfluencers } from "@/server/repositories/influencer-repository";
import { quotaFor } from "@/server/repositories/usage-repository";
import { PageHeader } from "@/components/shell/app-shell";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { SearchInput, Select } from "@/components/ui/field";
import { TableSkeleton } from "@/components/ui/states";
import { DiscoveryView } from "@/components/discovery/discovery-view";

export const metadata: Metadata = { title: "Discovery" };
export const dynamic = "force-dynamic";

export default async function DiscoveryPage() {
  // Permission is checked here and again in the route handler the view calls.
  // This one only decides what to render; that one is the actual control.
  const user = await requirePagePermission("influencer:search", "/discovery");
  const indexed = countInfluencers();

  return (
    <div className="flex min-h-[calc(100dvh-var(--spacing-topbar))] flex-col">
      <PageHeader
        eyebrow="Discover"
        title="Creator search"
        leadFigure={`${formatCompact(indexed)} indexed`}
        description="Every creator carries a deterministic health score, a separate confidence reading, and the provenance of each figure behind it."
      />
      {/* The fallback mirrors the loaded frame — toolbar band above the table —
          so a cold navigation paints the chrome once instead of popping it in
          around a naked skeleton. */}
      <Suspense
        fallback={
          <div className="min-w-0 flex-1">
            <div className="border-b border-line bg-surface px-4 py-3 sm:px-6">
              <div className="flex flex-wrap items-center gap-2">
                <SearchInput
                  disabled
                  placeholder="Name, handle, category, country or content topic"
                  aria-label="Search influencers"
                  className="min-w-56 flex-1"
                />
                <Button variant="primary" disabled>
                  Search
                </Button>
                <Button disabled className="gap-1.5">
                  <SlidersHorizontal className="size-4" aria-hidden />
                  Filters
                </Button>
                <Select disabled aria-label="Sort results" className="w-44">
                  <option>Relevance</option>
                </Select>
              </div>
            </div>
            <div className="p-4 sm:p-6">
              <Panel>
                <TableSkeleton rows={10} columns={8} />
              </Panel>
            </div>
          </div>
        }
      >
        <DiscoveryView initialQuota={quotaFor(user.orgId, user.plan)} />
      </Suspense>
    </div>
  );
}
