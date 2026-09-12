import type { Metadata } from "next";
import { pluralise } from "@/lib/format";
import { requirePagePermission } from "@/server/auth/rbac";
import { conflictQueue, lowConfidenceQueue } from "@/server/repositories/ops-repository";
import { countInfluencers } from "@/server/repositories/influencer-repository";
import { PageBand, PageBody, PageHeader } from "@/components/shell/app-shell";
import { ReviewTable } from "@/components/admin/review-table";
import { Metric, MetricStrip } from "@/components/intelligence/signal";

export const metadata: Metadata = { title: "Anomalies" };
export const dynamic = "force-dynamic";

const WATCHES = [
  "Content outside a creator's own range",
  "Confidence too thin to publish",
  "Sources disagreeing on a field",
  "Growth without matching engagement",
];

export default async function Page() {
  await requirePagePermission("analytics:anomaly_queue", "/admin/anomalies");

  // Two detectors, one workspace: an operator is triaging *deviation*, and
  // splitting that across two nav items made them check one and forget the
  // other. Conflicts outrank thin confidence — a contradiction is a wrong
  // number, thin confidence is only an unproven one.
  const conflicts = conflictQueue();
  const lowConfidence = lowConfidenceQueue();
  const items = [...conflicts, ...lowConfidence];
  const indexed = countInfluencers();

  return (
    <>
      <PageHeader
        eyebrow="Intelligence"
        title="Anomalies"
        leadFigure={
          items.length > 0 ? `${pluralise(items.length, "signal")}` : "all clear"
        }
        description="Deviation detection across the indexed database: content performing outside a creator's own established range, fields where two sources disagree, and profiles whose confidence is too thin to publish without a warning."
      />

      <PageBand inset={false}>
        <MetricStrip>
          <Metric
            label="Awaiting a decision"
            value={items.length}
            tone="lead"
            footnote={items.length === 0 ? "nothing flagged" : "across both detectors"}
          />
          <Metric
            label="Source conflicts"
            value={conflicts.length}
            footnote="two sources disagree"
          />
          <Metric
            label="Preliminary confidence"
            value={lowConfidence.length}
            footnote="below the 50% publish threshold"
          />
          <Metric
            label="Profiles scanned"
            value={indexed}
            footnote="every indexed creator, every cycle"
          />
        </MetricStrip>
      </PageBand>

      <PageBody>
        <ReviewTable
          items={items}
          title="Signals requiring attention"
          emptyTitle="No anomalies flagged"
          emptyDescription={`Nothing across ${indexed.toLocaleString()} indexed creators deviates beyond the detection threshold, and no field has two sources disagreeing.`}
          watchList={WATCHES}
          actionLabel="Investigate"
        />
      </PageBody>
    </>
  );
}
