import type { Metadata } from "next";
import { Suspense } from "react";
import { AskPanel } from "@/components/discovery/ask-panel";
import { AssistantPanel } from "@/components/discovery/assistant-panel";
import { SlidersHorizontal } from "lucide-react";
import { formatCompact } from "@/lib/format";
import { can, requirePagePermission } from "@/server/auth/rbac";
import { listCampaigns } from "@/server/repositories/workspace-repository";
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
      {/* Ask in a sentence, see the filters it becomes, then run it. Above
          the toolbar because it is a way *into* a search, not a filter on
          one. */}
      <div className="space-y-3 px-4 pb-3 sm:px-6">
        {/* The assistant answers; the panel below shows what a sentence
            became before a search is spent on it. Both are ways *into* a
            search rather than filters on one. */}
        <AssistantPanel />
        <AskPanel />
      </div>

      <Suspense
        fallback={
          <div className="min-w-0 flex-1">
            {/* Decorative: while the real toolbar streams in, a second search
                field with the same name would be announced twice and matched
                twice. */}
            <div aria-hidden className="border-b border-line bg-surface px-4 py-3 sm:px-6">
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
        <DiscoveryView
          initialQuota={quotaFor(user.orgId, user.plan)}
          campaigns={
            can(user, "campaign:write")
              ? listCampaigns(user)
                  .filter((campaign) => campaign.status !== "archived")
                  .map((campaign) => ({ id: campaign.id, name: campaign.name }))
              : []
          }
        />
      </Suspense>
    </div>
  );
}
