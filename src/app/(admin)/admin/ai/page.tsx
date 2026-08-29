import type { Metadata } from "next";
import { requirePagePermission } from "@/server/auth/rbac";
import { conflictQueue } from "@/server/repositories/ops-repository";
import { PageBody, PageHeader } from "@/components/shell/app-shell";
import { ReviewTable } from "@/components/admin/review-table";
import { AiEnrichment } from "@/components/admin/ai-enrichment";
import { readRecords } from "@/server/data/records";

export const metadata: Metadata = { title: "AI enrichment review" };
export const dynamic = "force-dynamic";

export default async function Page() {
  await requirePagePermission("analytics:ai_review", "/admin/ai");
  const items = conflictQueue();
  const data = readRecords();
  const pending = data.influencers.filter((influencer) => !data.ai.has(influencer.id)).length;

  return (
    <>
      <PageHeader
        title="AI enrichment review"
        description="Where two providers disagreed on a high-value fact, SocialOrbit opens a task instead of silently picking one (DPR UC-12)."
        meta={
          <span className="text-[12px] text-ink-muted">
            {items.length} {items.length === 1 ? "item" : "items"} waiting
          </span>
        }
      />
      <PageBody className="space-y-4">
        <AiEnrichment disabled={!process.env.OPENAI_API_KEY} pending={pending} />

        <ReviewTable
          items={items}
          emptyTitle="No conflicts open"
          emptyDescription="OpenAI and Gemini agree on every high-value fact currently held."
        />
      </PageBody>
    </>
  );
}
