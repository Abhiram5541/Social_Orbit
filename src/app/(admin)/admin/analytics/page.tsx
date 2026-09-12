import type { Metadata } from "next";
import {
  HEALTH_COMPONENT_LABEL,
  HEALTH_WEIGHTS,
  healthBand,
  type HealthComponentKey,
} from "@/lib/contracts/score";
import { CATEGORY_LABEL } from "@/lib/contracts/common";
import { confidenceBand } from "@/lib/contracts/common";
import { formatCompact, plural } from "@/lib/format";
import { median } from "@/server/analytics/metrics";
import { requirePagePermission } from "@/server/auth/rbac";
import { allSummaries } from "@/server/repositories/influencer-repository";
import { databaseStats } from "@/server/repositories/ops-repository";
import { PageBand, PageBody, PageHeader } from "@/components/shell/app-shell";
import {
  Instrument,
  Panel,
  PanelBody,
  PanelFoot,
  PanelHead,
  PanelTitle,
  Split,
} from "@/components/ui/panel";
import { DistributionRows, type DistributionTone } from "@/components/charts/distribution-bars";
import { CorrelationPlot } from "@/components/charts/distribution";
import { HeroSignal, Metric, MetricStrip } from "@/components/intelligence/signal";

export const metadata: Metadata = { title: "Analytics" };
export const dynamic = "force-dynamic";

/** The scoring contract's own bands — never a second set invented for a chart. */
const HEALTH_BANDS = [
  { label: "Excellent", range: "85–100", min: 85, max: 101, tone: "positive" },
  { label: "Strong", range: "70–84", min: 70, max: 85, tone: "brand" },
  { label: "Fair", range: "50–69", min: 50, max: 70, tone: "caution" },
  { label: "Needs review", range: "0–49", min: 0, max: 50, tone: "critical" },
] as const;

const CONFIDENCE_BANDS = [
  { label: "High", range: "90–100", min: 90, max: 101, tone: "positive" },
  { label: "Good", range: "70–89", min: 70, max: 90, tone: "brand" },
  { label: "Moderate", range: "50–69", min: 50, max: 70, tone: "caution" },
  { label: "Preliminary", range: "0–49", min: 0, max: 50, tone: "critical" },
] as const;

const HEALTH_TONE = {
  excellent: "positive",
  strong: "brand",
  fair: "caution",
  weak: "critical",
} as const;

export default async function AnalyticsPage() {
  await requirePagePermission("analytics:read", "/admin/analytics");
  const summaries = allSummaries();
  const stats = databaseStats();

  const scored = summaries.filter(
    (summary): summary is (typeof summaries)[number] & { healthScore: number } =>
      summary.healthScore !== null,
  );
  const scores = scored.map((summary) => summary.healthScore);
  const confidences = summaries.map((summary) => summary.confidence);

  const medianHealth = median(scores);
  const medianConfidence = median(confidences);

  const healthRows = HEALTH_BANDS.map((band) => ({
    label: band.label,
    sublabel: band.range,
    tone: band.tone as DistributionTone,
    value: scores.filter((score) => score >= band.min && score < band.max).length,
  }));

  const confidenceRows = CONFIDENCE_BANDS.map((band) => ({
    label: band.label,
    sublabel: band.range,
    tone: band.tone as DistributionTone,
    value: confidences.filter((score) => score >= band.min && score < band.max).length,
  }));

  // The modal band is the narrative: it says what shape the database is in
  // without the reader having to read a histogram off an axis.
  const modalHealth = [...healthRows].sort((a, b) => b.value - a.value)[0];
  const modalConfidence = [...confidenceRows].sort((a, b) => b.value - a.value)[0];

  const riskRows = (
    [
      { key: "low", label: "Low", tone: "positive" },
      { key: "medium", label: "Medium", tone: "caution" },
      { key: "high", label: "High", tone: "critical" },
    ] as const
  ).map((row) => ({
    label: row.label,
    tone: row.tone as DistributionTone,
    value: summaries.filter((summary) => summary.risk === row.key).length,
  }));
  // D13: `unknown` is not a fourth severity — it counts profiles with no
  // measurable audience-quality signal, so it renders apart from the trio.
  const unknownRisk = summaries.filter((summary) => summary.risk === "unknown").length;

  const categoryRows = Object.entries(
    summaries.reduce<Record<string, number>>((acc, summary) => {
      for (const category of summary.categories) {
        acc[category] = (acc[category] ?? 0) + 1;
      }
      return acc;
    }, {}),
  )
    .map(([key, value]) => ({
      label: CATEGORY_LABEL[key as keyof typeof CATEGORY_LABEL] ?? key,
      value,
      tone: "neutral" as DistributionTone,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  const maxWeight = Math.max(...Object.values(HEALTH_WEIGHTS));

  // The cross-analysis. A creator scoring well on thin evidence is the failure
  // mode the whole confidence axis exists to expose, so it gets counted.
  const confidentAndStrong = scored.filter(
    (summary) => summary.healthScore >= 70 && summary.confidence >= 70,
  ).length;
  const strongButThin = scored.filter(
    (summary) => summary.healthScore >= 70 && summary.confidence < 50,
  ).length;

  return (
    <>
      <PageHeader
        eyebrow="Intelligence"
        title="Analytics"
        leadFigure={`${formatCompact(scored.length)} scored`}
        description="Score and confidence distribution across the whole database, the relationship between them, and the versioned weights that produced both."
      />

      <Instrument className="py-8">
        <HeroSignal tone="instrument"
          eyebrow="Database health · median SocialOrbit Health across every scored profile"
          value={medianHealth}
          suffix="/100"
          band={modalHealth.label}
          bandTone={modalHealth.tone as "positive" | "brand" | "caution" | "critical"}
          explanation={
            <>
              The distribution is dominated by the{" "}
              <span className="text-ink">{modalHealth.label.toLowerCase()}</span> band —{" "}
              <span className="font-num text-ink">{modalHealth.value}</span> of{" "}
              <span className="font-num text-ink">{scored.length}</span> scored profiles.
              Two of the nine health components — audience authenticity and growth pattern
              — cannot be measured without authorised access or accumulated snapshots, so
              the remaining weights are renormalised rather than counted as zero. That
              caps how high an unconnected creator can score, and it is why the mass sits
              in the middle rather than at the top.
            </>
          }
          aside={
            <div>
              <p className="label-caps-sm mb-2 text-ink-subtle">Health distribution</p>
              <DistributionRows rows={healthRows} total={scored.length} showZero />
            </div>
          }
        />
      </Instrument>

      <PageBand inset={false}>
        <MetricStrip>
          <Metric
            label="Scored profiles"
            value={formatCompact(scored.length)}
            tone="lead"
            footnote={`of ${summaries.length.toLocaleString()} indexed`}
          />
          <Metric
            label="Median health"
            value={medianHealth === null ? "—" : medianHealth.toFixed(1)}
            footnote="median, not mean"
          />
          <Metric
            label="Median confidence"
            value={medianConfidence === null ? "—" : `${medianConfidence.toFixed(1)}%`}
            footnote={`${modalConfidence.label.toLowerCase()} band dominates`}
          />
          <Metric
            label="High risk"
            value={riskRows[2].value}
            footnote="measured disqualifying signal"
          />
          <Metric
            label="Risk unmeasurable"
            value={unknownRisk}
            tone="muted"
            footnote="needs authorised access"
          />
          <Metric
            label="Preliminary confidence"
            value={stats.lowConfidenceProfiles}
            footnote="below the publish threshold"
          />
        </MetricStrip>
      </PageBand>

      <PageBody className="space-y-5">
        <Panel>
          <PanelHead>
            <div className="min-w-0">
              <PanelTitle>Quality against evidence</PanelTitle>
              <p className="mt-0.5 max-w-3xl text-sm text-ink-muted">
                Every scored profile, plotted by its SocialOrbit Health against the data
                confidence behind it. These are separate axes by design: a creator can be
                excellent and barely observed at the same time, and folding one into the
                other would hide exactly that case.
              </p>
            </div>
          </PanelHead>
          <PanelBody>
            <CorrelationPlot
              points={scored.map((summary) => ({
                id: summary.id,
                name: summary.displayName,
                x: summary.healthScore,
                y: summary.confidence,
                tone: HEALTH_TONE[healthBand(summary.healthScore)] as DistributionTone,
                detail: `${confidenceBand(summary.confidence)} confidence`,
              }))}
              xLabel="SocialOrbit Health"
              yLabel="Confidence"
              ariaLabel="Every scored creator plotted by health score against data confidence"
            />
          </PanelBody>
          <PanelFoot>
            <span>
              <span className="font-num text-ink">{confidentAndStrong}</span>{" "}
              {plural(confidentAndStrong, "profile")} score 70+ on
              evidence that is itself 70%+ confident — the quadrant a shortlist should be
              drawn from.
              {strongButThin > 0 && (
                <>
                  {" "}
                  <span className="font-num text-caution">{strongButThin}</span> score 70+
                  on preliminary evidence and carry a published warning.
                </>
              )}
            </span>
          </PanelFoot>
        </Panel>

        <Split cols="even" className="overflow-hidden rounded-xl border border-line bg-surface">
          <div className="min-w-0">
            <PanelHead>
              <PanelTitle as="h3">Confidence distribution</PanelTitle>
              <span className="text-sm text-ink-muted">
                completeness · depth · authority · staleness
              </span>
            </PanelHead>
            <PanelBody>
              <DistributionRows rows={confidenceRows} total={summaries.length} showZero />
            </PanelBody>
            <PanelFoot>
              Confidence is computed from data completeness, historical depth and source
              authority, less penalties for staleness and conflicts. It never enters the
              health score.
            </PanelFoot>
          </div>
          <div className="min-w-0">
            <PanelHead>
              <PanelTitle as="h3">Audience risk</PanelTitle>
              <span className="text-sm text-ink-muted">strongest signal, not an average</span>
            </PanelHead>
            <PanelBody className="space-y-4">
              <DistributionRows rows={riskRows} total={summaries.length} showZero />
              {/* Apart from the severity trio on purpose: this is a count of
                  profiles nobody could measure, not a fourth risk level. */}
              <div className="flex items-baseline justify-between gap-4 border-t border-rule pt-3">
                <span className="text-base text-ink-subtle">
                  Unknown{" "}
                  <span className="text-sm">— no measurable audience-quality signal</span>
                </span>
                <span className="font-num text-base text-ink-subtle">
                  {unknownRisk.toLocaleString()}
                </span>
              </div>
            </PanelBody>
            <PanelFoot>
              Bot risk, inactive audience and view anomaly need authorised access. Reporting
              an unmeasured creator as &ldquo;low risk&rdquo; would be a safety claim the
              platform never earned.
            </PanelFoot>
          </div>
        </Split>

        <Split cols="even" className="overflow-hidden rounded-xl border border-line bg-surface">
          <div className="min-w-0">
            <PanelHead>
              <PanelTitle as="h3">Category coverage</PanelTitle>
              <span className="text-sm text-ink-muted">top 10 · creators may hold several</span>
            </PanelHead>
            <PanelBody>
              <DistributionRows rows={categoryRows} total={summaries.length} />
            </PanelBody>
            <PanelFoot>
              Categories are observed from the platform&apos;s own published topics where it
              publishes them, and AI-inferred otherwise. Unmapped topics are dropped rather
              than pushed into the nearest category — a wrong category corrupts the
              benchmark medians of everyone genuinely in it.
            </PanelFoot>
          </div>

          <div className="min-w-0">
            <PanelHead>
              <PanelTitle as="h3">Health score weights</PanelTitle>
              <span className="font-num text-sm text-ink-muted">health-1.1.0</span>
            </PanelHead>
            <PanelBody>
              <ul className="space-y-2">
                {(Object.keys(HEALTH_WEIGHTS) as HealthComponentKey[]).map((key) => (
                  <li key={key} className="space-y-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-base text-ink">
                        {HEALTH_COMPONENT_LABEL[key]}
                      </span>
                      <span className="font-num text-sm text-ink-muted">
                        {(HEALTH_WEIGHTS[key] * 100).toFixed(0)}%
                      </span>
                    </div>
                    {/* Single-series bars scaled to the largest weight; colour
                        would carry no meaning, so they stay neutral. */}
                    <div className="h-1.5 overflow-hidden rounded-full bg-sunken-strong">
                      <div
                        className="h-full rounded-full bg-neutral-metric"
                        style={{ width: `${(HEALTH_WEIGHTS[key] / maxWeight) * 100}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </PanelBody>
            <PanelFoot>
              Weights are versioned with the formula. Changing them creates a new formula
              version rather than silently re-scoring history, so a score recorded last
              quarter can still be reproduced.
            </PanelFoot>
          </div>
        </Split>
      </PageBody>
    </>
  );
}
