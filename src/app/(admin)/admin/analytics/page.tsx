import type { Metadata } from "next";
import { HEALTH_COMPONENT_LABEL, HEALTH_WEIGHTS, type HealthComponentKey } from "@/lib/contracts/score";
import { formatCompact } from "@/lib/format";
import { requirePagePermission } from "@/server/auth/rbac";
import { allSummaries } from "@/server/repositories/influencer-repository";
import { databaseStats } from "@/server/repositories/ops-repository";
import { PageBody, PageHeader } from "@/components/shell/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatRow, StatTile } from "@/components/intelligence/stat";
import { CategoryBars } from "@/components/charts/trend-chart";

export const metadata: Metadata = { title: "Analytics" };
export const dynamic = "force-dynamic";

const BANDS = [
  { label: "0–39", min: 0, max: 40 },
  { label: "40–54", min: 40, max: 55 },
  { label: "55–69", min: 55, max: 70 },
  { label: "70–84", min: 70, max: 85 },
  { label: "85–100", min: 85, max: 101 },
];

export default async function AnalyticsPage() {
  await requirePagePermission("analytics:read", "/admin/analytics");
  const summaries = allSummaries();
  const stats = databaseStats();

  const scores = summaries
    .map((summary) => summary.healthScore)
    .filter((value): value is number => value !== null);
  const confidences = summaries.map((summary) => summary.confidence);

  const average = (values: number[]) =>
    values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;

  const distribution = BANDS.map((band) => ({
    label: band.label,
    value: scores.filter((score) => score >= band.min && score < band.max).length,
  }));

  const confidenceDistribution = BANDS.map((band) => ({
    label: band.label,
    value: confidences.filter((score) => score >= band.min && score < band.max).length,
  }));

  const riskCounts = (["low", "medium", "high"] as const).map((level) => ({
    label: level,
    value: summaries.filter((summary) => summary.risk === level).length,
  }));

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Score and confidence distribution across the whole database, and the weights that produced them."
      />
      <PageBody className="space-y-4">
        <StatRow>
          <StatTile label="Scored profiles" value={formatCompact(scores.length)} />
          <StatTile label="Mean health" value={average(scores).toFixed(1)} />
          <StatTile label="Mean confidence" value={`${average(confidences).toFixed(1)}%`} />
          <StatTile label="High risk" value={riskCounts[2].value} />
          <StatTile label="Preliminary confidence" value={stats.lowConfidenceProfiles} />
        </StatRow>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Health score distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <CategoryBars
                data={distribution}
                valueLabel="creators"
                format="integer"
                ariaLabel="Number of creators in each health score band"
                height={200}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Confidence distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <CategoryBars
                data={confidenceDistribution}
                valueLabel="creators"
                format="integer"
                ariaLabel="Number of creators in each confidence band"
                height={200}
              />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Health score weights</CardTitle>
            <span className="font-num text-[12px] text-ink-muted">health-1.0.0</span>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {(Object.keys(HEALTH_WEIGHTS) as HealthComponentKey[]).map((key) => (
                <li key={key} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[13px] text-ink">{HEALTH_COMPONENT_LABEL[key]}</span>
                    <span className="font-num text-[12px] tabular-nums text-ink-muted">
                      {(HEALTH_WEIGHTS[key] * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-line">
                    <div
                      className="h-full rounded-full bg-series-1"
                      style={{ width: `${HEALTH_WEIGHTS[key] * 100 * 5}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-3 border-t border-line pt-3 text-[12px] text-ink-muted">
              Weights are versioned with the formula. Changing them creates a new formula
              version rather than silently re-scoring history, so a score recorded last
              quarter can still be reproduced.
            </p>
          </CardContent>
        </Card>
      </PageBody>
    </>
  );
}
