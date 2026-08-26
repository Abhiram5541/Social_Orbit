import * as React from "react";
import { Sparkles } from "lucide-react";
import {
  HEALTH_COMPONENT_LABEL,
  type HealthComponentKey,
  type HealthScore,
  type RiskSignals,
} from "@/lib/contracts/score";
import type { DataConfidence } from "@/lib/contracts/common";
import type { AiProfileIntelligence, BenchmarkPosition } from "@/lib/contracts/influencer";
import { formatRelativeTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { AiPanel, Card, CardContent, CardHeader, CardTitle, Eyebrow } from "@/components/ui/card";
import { InfoHint } from "@/components/ui/overlay";
import { ConfidenceMeter } from "@/components/intelligence/provenance";
import { HEALTH_BAND_LABEL, RiskBadge, ScoreBar, ScoreRing } from "@/components/intelligence/score";

/* ---------------------------------------------------------------------------
 * The SocialOrbit Health panel.
 *
 * Three things are kept visibly separate because conflating them is the whole
 * failure mode this product exists to avoid:
 *   the score (quality) · the confidence (how much to trust it) · the AI
 *   reading (interpretation, on its own tonal ground).
 * ------------------------------------------------------------------------ */

export function HealthPanel({
  health,
  risk,
  confidence,
  ai,
  benchmarks,
}: {
  health: HealthScore;
  risk: RiskSignals;
  confidence: DataConfidence;
  ai: AiProfileIntelligence | null;
  benchmarks: BenchmarkPosition | null;
}) {
  const unavailable = health.components.filter((component) => !component.available);
  const percentile = benchmarks?.metrics[0]?.percentile;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>SocialOrbit Health</CardTitle>
          <InfoHint label="How the health score is calculated">
            Nine weighted components, computed in backend code by formula{" "}
            {health.formulaVersion}. AI classifies some inputs; it never sets the score.
          </InfoHint>
        </div>
        <Badge tone="neutral" className="font-mono">
          {health.formulaVersion}
        </Badge>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-4">
          <ScoreRing value={health.weightCovered > 0 ? health.value : null} size={96} />
          <div className="min-w-40 flex-1 space-y-1.5">
            <p className="text-[17px] font-semibold leading-tight text-ink">
              {HEALTH_BAND_LABEL[health.band]}
            </p>
            {benchmarks && percentile !== undefined ? (
              <p className="text-[13px] text-ink-muted">
                {ordinal(percentile)} percentile of {benchmarks.cohortSize} creators in{" "}
                {benchmarks.category} · {benchmarks.followerBand}
              </p>
            ) : (
              <p className="text-[13px] text-ink-muted">
                Not enough indexed creators in this category and size band to rank
                against yet.
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <RiskBadge level={risk.level} />
              <span className="text-[12px] text-ink-muted">
                Computed {formatRelativeTime(health.computedAt)}
              </span>
            </div>
          </div>
          <ConfidenceMeter confidence={confidence} className="w-full sm:w-48" />
        </div>

        <div className="grid gap-x-6 gap-y-2.5 border-t border-line pt-4 sm:grid-cols-2">
          {health.components.map((component) => (
            <ScoreBar
              key={component.key}
              label={HEALTH_COMPONENT_LABEL[component.key as HealthComponentKey]}
              weight={component.weight}
              value={component.available ? component.value : null}
              available={component.available}
            />
          ))}
        </div>

        {unavailable.length > 0 && (
          <p className="border-t border-line pt-3 text-[12px] text-ink-muted">
            {unavailable.length === 1 ? "One component is" : `${unavailable.length} components are`}{" "}
            not measurable yet (
            {unavailable
              .map((component) => HEALTH_COMPONENT_LABEL[component.key as HealthComponentKey].toLowerCase())
              .join(", ")}
            ). The remaining weights are renormalised rather than counted as zero, so{" "}
            {(health.weightCovered * 100).toFixed(0)}% of the formula produced this score.
          </p>
        )}

        {ai && (
          <AiPanel className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-inferred" aria-hidden />
                <Eyebrow className="text-inferred">What the signals say</Eyebrow>
              </span>
              <Badge tone="inferred">AI interpretation</Badge>
            </div>
            <p className="text-[13px] leading-5 text-ink">{ai.signalReading}</p>
            <p className="text-[11px] text-ink-muted">
              Generated by {ai.provider} {ai.model} · prompt {ai.promptVersion} ·{" "}
              {formatRelativeTime(ai.generatedAt)}. This is an explanation of stored
              measurements, not a source of them.
            </p>
          </AiPanel>
        )}
      </CardContent>
    </Card>
  );
}

function ordinal(value: number): string {
  const rounded = Math.round(value);
  const suffix =
    rounded % 100 >= 11 && rounded % 100 <= 13
      ? "th"
      : ["th", "st", "nd", "rd"][rounded % 10] ?? "th";
  return `${rounded}${suffix}`;
}
