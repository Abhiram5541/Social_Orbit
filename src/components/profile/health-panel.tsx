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
import { InfoHint } from "@/components/ui/overlay";
import { HEALTH_BAND_LABEL, RiskBadge, ScoreBar, ScoreRing } from "@/components/intelligence/score";

/* ---------------------------------------------------------------------------
 * The SocialOrbit Health readout.
 *
 * This is the one dark surface in the product, and the one place the design
 * spends its boldness. The reasoning: a measurement reported with its own
 * uncertainty is the most characteristic artifact in this product's world, and
 * rendering it as another white card would make it look like every other block
 * on the page. As an instrument panel it reads as the thing you came to check.
 *
 * Three quantities stay visibly separate, because conflating them is the
 * failure mode this product exists to avoid:
 *   the score (quality) · the confidence (how much to trust it) · the AI
 *   reading (interpretation, on its own ground, clearly labelled).
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
  // Not "was anything measured" but "was enough measured to publish a number".
  // A creator with one indexed upload can still pin audience activity at 100
  // and score a flawless 100/100 off a tenth of the formula.
  const measured = health.sufficient;

  return (
    <section className="animate-rise overflow-hidden rounded-xl bg-instrument text-instrument-ink shadow-instrument">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-instrument-line px-4 py-2.5">
        <div className="flex items-center gap-2">
          <h2 className="label-caps text-instrument-muted">SocialOrbit Health</h2>
          <InfoHint label="How the health score is calculated">
            Nine weighted components, computed in backend code by formula{" "}
            {health.formulaVersion}. AI classifies some inputs; it never sets the score.
          </InfoHint>
        </div>
        <span className="font-num text-[11px] tracking-[0.04em] text-instrument-muted">
          {health.formulaVersion}
        </span>
      </header>

      <div className="grid gap-x-8 gap-y-6 p-5 lg:grid-cols-[auto_1fr]">
        <div className="flex items-center gap-5">
          <ScoreRing value={measured ? health.value : null} size={124} tone="instrument" />
          <div className="min-w-0 space-y-2">
            <p className="text-[19px] font-semibold leading-tight tracking-[-0.02em]">
              {measured ? HEALTH_BAND_LABEL[health.band] : "Not scored"}
            </p>
            {!measured ? (
              <p className="max-w-56 text-[12px] leading-5 text-instrument-muted">
                Only {Math.round(health.weightCovered * 100)}% of the formula could be
                measured for this creator — too little to publish a score. Withheld rather
                than rounded up from one component.
              </p>
            ) : benchmarks && percentile !== undefined ? (
              <p className="max-w-56 text-[12px] leading-5 text-instrument-muted">
                {ordinal(percentile)} percentile of {benchmarks.cohortSize} creators in{" "}
                {benchmarks.category} · {benchmarks.followerBand}
              </p>
            ) : (
              <p className="max-w-56 text-[12px] leading-5 text-instrument-muted">
                Not enough indexed creators in this category and size band to rank against
                yet.
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              <RiskBadge level={risk.level} onInstrument />
            </div>
          </div>
        </div>

        {/* Components: two columns of hairline bars, staggered on entry. */}
        <div className="grid gap-x-7 gap-y-3 sm:grid-cols-2">
          {health.components.map((component, index) => (
            <ScoreBar
              key={component.key}
              label={HEALTH_COMPONENT_LABEL[component.key as HealthComponentKey]}
              weight={component.weight}
              value={component.available ? component.value : null}
              available={component.available}
              tone="instrument"
              index={index}
            />
          ))}
        </div>
      </div>

      {/* Confidence sits on its own rule, not inside the score block — it
          answers a different question and must not read as part of the value. */}
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-instrument-line px-5 py-3">
        <InstrumentReadout
          label="Data confidence"
          value={`${Math.round(confidence.score)}%`}
          note={`${confidence.band} confidence`}
          bar={confidence.score}
          barTone={
            confidence.band === "preliminary"
              ? "bg-critical"
              : confidence.band === "moderate"
                ? "bg-caution"
                : "bg-brand-glow"
          }
        />
        <InstrumentReadout
          label="Formula coverage"
          value={`${Math.round(health.weightCovered * 100)}%`}
          note={
            unavailable.length === 0
              ? "all components measurable"
              : `${unavailable.length} not measurable`
          }
          bar={health.weightCovered * 100}
          barTone="bg-instrument-muted"
        />
        <span className="text-[11px] text-instrument-muted">
          Computed {formatRelativeTime(health.computedAt)}
        </span>
      </div>

      {unavailable.length > 0 && (
        <p className="border-t border-instrument-line px-5 py-2.5 text-[12px] leading-5 text-instrument-muted">
          {unavailable.length === 1 ? "One component is" : `${unavailable.length} components are`}{" "}
          not measurable yet (
          {unavailable
            .map((component) =>
              HEALTH_COMPONENT_LABEL[component.key as HealthComponentKey].toLowerCase(),
            )
            .join(", ")}
          ). The remaining weights are renormalised rather than counted as zero.
        </p>
      )}

      {ai && (
        <div className="border-t border-instrument-line bg-instrument-raised px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-1.5">
              <Sparkles className="size-3.5 text-inferred" aria-hidden />
              <span className="label-caps text-instrument-muted">What the signals say</span>
            </span>
            <Badge tone="inferred" onInstrument>AI interpretation</Badge>
          </div>
          <p className="mt-2.5 max-w-3xl text-[13px] leading-6 text-instrument-ink">
            {ai.signalReading}
          </p>
          <p className="mt-2 text-[11px] leading-5 text-instrument-muted">
            {ai.provider} {ai.model} · prompt {ai.promptVersion} ·{" "}
            {formatRelativeTime(ai.generatedAt)}. An explanation of stored measurements, not a
            source of them.
          </p>
        </div>
      )}
    </section>
  );
}

/** A labelled value with a hairline bar — the panel's repeating unit. */
function InstrumentReadout({
  label,
  value,
  note,
  bar,
  barTone,
}: {
  label: string;
  value: string;
  note: string;
  bar: number;
  barTone: string;
}) {
  return (
    <div className="min-w-40 flex-1 space-y-1">
      <div className="flex items-baseline justify-between gap-3">
        <span className="label-caps text-instrument-muted">{label}</span>
        <span className="font-num text-[13px] font-semibold tabular-nums">{value}</span>
      </div>
      <div className="h-1 overflow-hidden rounded-sm bg-instrument-line">
        <div
          className={`animate-extend h-full rounded-sm ${barTone}`}
          style={{ width: `${Math.min(100, bar)}%`, "--stagger": "260ms" } as React.CSSProperties}
        />
      </div>
      <p className="text-[11px] text-instrument-muted">{note}</p>
    </div>
  );
}

function ordinal(value: number): string {
  const rounded = Math.round(value);
  const suffix =
    rounded % 100 >= 11 && rounded % 100 <= 13
      ? "th"
      : (["th", "st", "nd", "rd"][rounded % 10] ?? "th");
  return `${rounded}${suffix}`;
}
