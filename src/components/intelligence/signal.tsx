import * as React from "react";
import { cn } from "@/lib/class-names";
import { NO_VALUE } from "@/lib/format";
import type { Provenance } from "@/lib/contracts/common";
import { Sparkline, type SparkPolarity } from "@/components/charts/trend-chart";
import { Delta, ProvenanceMark } from "./provenance";

/* ---------------------------------------------------------------------------
 * Signal hierarchy.
 *
 * A screen is allowed exactly one HeroSignal, one MetricStrip under it, and
 * whatever supporting panels it needs. That ordering is the whole point: the
 * old dashboards gave six numbers identical weight and left the reader to
 * work out which one they had opened the page for.
 *
 *   HeroSignal    the answer to "how is it going" — one figure, its trend,
 *                 the band it falls in, and a sentence saying why.
 *   MetricStrip   the supporting signals — one continuous strip divided by
 *                 rules, never a tray of separate boxes.
 *   Metric        one cell of that strip.
 * ------------------------------------------------------------------------ */

export interface SignalComponent {
  label: string;
  /** 0–100. Null renders as an explicit "not measurable" row, never as zero. */
  value: number | null;
  hint?: string;
}

/**
 * The one executive readout on a screen.
 *
 * Composition rather than ornament: an oversized light numeral carries the
 * value, a scale track shows where that value sits on the range it is drawn
 * from, and a plain sentence says what moved. The components column on the
 * right is what stops it being a vanity number — it shows the reader what the
 * figure is made of before they have to click anything.
 */
export function HeroSignal({
  eyebrow,
  value,
  display,
  suffix,
  band,
  bandTone = "neutral",
  delta,
  deltaSuffix,
  explanation,
  components,
  scale = [0, 100],
  aside,
  tone = "paper",
  className,
}: {
  eyebrow: React.ReactNode;
  /** Drives the scale track. Rounded for display unless `display` overrides. */
  value: number | null;
  /**
   * What is printed, when rounding the value would misstate it — a coverage
   * of 0.63% must not be shown as "1".
   */
  display?: React.ReactNode;
  /** e.g. "/100". Set small and muted beside the figure. */
  suffix?: React.ReactNode;
  /** The qualitative reading — "Strong", "Needs attention". */
  band?: React.ReactNode;
  bandTone?: "positive" | "caution" | "critical" | "neutral" | "brand";
  delta?: number | null;
  deltaSuffix?: string;
  /** One sentence in plain language. Says *why*, not what. */
  explanation?: React.ReactNode;
  /** Up to five contributing components, rendered as a small bar stack. */
  components?: SignalComponent[];
  scale?: [number, number];
  /** Anything the caller wants in the right column instead of components. */
  aside?: React.ReactNode;
  /**
   * `instrument` renders the readout against the graphite housing — the mode
   * used inside an `Instrument` band, which is where a screen's one headline
   * reading belongs.
   */
  tone?: "paper" | "instrument";
  className?: string;
}) {
  const [min, max] = scale;
  const pct =
    value === null ? null : Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  const dark = tone === "instrument";

  // On graphite every measurement hue has to be lifted: a deep emerald or a
  // deep rose mixed for white paper collapses toward a near-black ground.
  const bandClass = dark
    ? {
        positive: "text-positive-lift",
        caution: "text-caution-lift",
        critical: "text-critical-lift",
        brand: "text-brand-lift",
        neutral: "text-instrument-muted",
      }[bandTone]
    : {
        positive: "text-positive",
        caution: "text-caution",
        critical: "text-critical",
        brand: "text-brand-ink",
        neutral: "text-ink-muted",
      }[bandTone];

  const labelInk = dark ? "text-instrument-muted" : "text-ink-subtle";
  const figureInk = dark ? "text-instrument-ink" : "text-ink";
  const bodyInk = dark ? "text-instrument-muted" : "text-ink-muted";
  const trackBg = dark ? "bg-instrument-line" : "bg-sunken-strong";
  const trackFill = dark ? "bg-brand-lift" : "bg-ink";
  const barFill = dark ? "bg-instrument-muted" : "bg-neutral-metric";

  return (
    <div
      className={cn(
        "grid items-start gap-x-10 gap-y-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,20rem)]",
        className,
      )}
    >
      <div className="min-w-0">
        <p className={cn("label-caps", labelInk)}>{eyebrow}</p>

        <div className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-1">
          <span className={cn("font-num text-hero font-medium leading-none", figureInk)}>
            {display ?? (value === null ? NO_VALUE : Math.round(value))}
          </span>
          {suffix && (
            <span className={cn("font-num pb-1.5 text-stat font-medium", labelInk)}>
              {suffix}
            </span>
          )}
          {(delta !== undefined || band) && (
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1 pb-1.5">
              {delta !== undefined && (
                <Delta value={delta} suffix={deltaSuffix} className="text-base" />
              )}
              {band && (
                <span className={cn("text-base font-semibold", bandClass)}>{band}</span>
              )}
            </span>
          )}
        </div>

        {/* The scale track. A number with no range behind it is a number the
            reader has to take on trust; this shows the range it came from. */}
        {pct !== null && (
          <div className="mt-5 max-w-lg">
            <div className={cn("h-1.5 overflow-hidden rounded-full", trackBg)}>
              <div
                className={cn("animate-extend h-full rounded-full", trackFill)}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className={cn("mt-1.5 flex justify-between font-num text-2xs", labelInk)}>
              <span>{min}</span>
              <span>{max}</span>
            </div>
          </div>
        )}

        {explanation && (
          <p className={cn("measure mt-5 text-base leading-relaxed", bodyInk)}>
            {explanation}
          </p>
        )}
      </div>

      {aside ??
        (components && components.length > 0 ? (
          <dl className="min-w-0 space-y-2.5">
            <dt className={cn("label-caps-sm", labelInk)}>Contributing components</dt>
            {components.slice(0, 5).map((component, index) => (
              <dd key={component.label} className="flex items-center gap-3">
                <span className={cn("min-w-0 flex-1 truncate text-sm", bodyInk)}>
                  {component.label}
                </span>
                <span
                  className={cn("h-1 w-20 shrink-0 overflow-hidden rounded-full", trackBg)}
                  aria-hidden
                >
                  {component.value !== null && (
                    <span
                      className={cn("animate-extend block h-full rounded-full", barFill)}
                      style={{
                        width: `${Math.max(0, Math.min(100, component.value))}%`,
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        ...({ "--stagger": `${index * 40}ms` } as any),
                      }}
                    />
                  )}
                </span>
                <span
                  className={cn(
                    "w-9 shrink-0 text-right font-num text-sm",
                    component.value === null ? labelInk : figureInk,
                  )}
                >
                  {component.value === null ? NO_VALUE : Math.round(component.value)}
                </span>
              </dd>
            ))}
          </dl>
        ) : null)}
    </div>
  );
}

/**
 * The supporting signal row: one continuous strip divided by rules.
 *
 * Not a grid of bordered tiles. The strip reads as a single instrument
 * because it is one — which is also what lets it stay dense enough to carry
 * six figures without any of them shouting.
 */
export function MetricStrip({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDListElement>) {
  // `count` drops null, undefined and the `false` a conditional child
  // leaves behind — counting those pushed the strip to the wrong
  // column count whenever a tile was rendered conditionally.
  const count = React.Children.toArray(children).length;
  return (
    <dl
      className={cn(
        "grid divide-rule",
        // Two up on a phone, then as many columns as there are metrics. A
        // one-metric strip must not be forced into two columns, and a
        // two-metric strip must not leave a third cell empty — both were
        // leaving a visible hole in the band.
        count === 1 ? "grid-cols-1" : "grid-cols-2",
        "divide-x divide-y",
        // A strip must divide evenly. Eight metrics laid out six-wide leaves a
        // stranded row of two, which reads as a mistake rather than a grid.
        count >= 7
          ? "sm:grid-cols-4"
          : count === 6
            ? "sm:grid-cols-3 lg:grid-cols-6"
            : count === 5
              ? "sm:grid-cols-3 lg:grid-cols-5"
              : count === 4
                ? "sm:grid-cols-4"
                : count === 3
                  ? "sm:grid-cols-3"
                  : count === 2
                    ? "sm:grid-cols-2"
                    : "sm:grid-cols-1",
        count <= 6 && "sm:divide-y-0",
        className,
      )}
      {...props}
    >
      {children}
    </dl>
  );
}

/**
 * One cell of a MetricStrip.
 *
 * `state` exists because absence is not zero (CLAUDE.md D13). A metric with
 * no measurable signal renders its reason, never a confident 0 — a fabricated
 * figure in a strip like this is the most quotable thing on the screen.
 */
export function Metric({
  label,
  value,
  delta,
  deltaSuffix,
  invertDelta,
  spark,
  sparkPolarity = "higher-better",
  footnote,
  provenance,
  tone = "default",
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  delta?: number | null;
  deltaSuffix?: string;
  invertDelta?: boolean;
  spark?: number[];
  sparkPolarity?: SparkPolarity;
  footnote?: React.ReactNode;
  provenance?: Provenance;
  /** `lead` sets the strip's headline figure larger than its neighbours. */
  tone?: "default" | "lead" | "muted";
  className?: string;
}) {
  return (
    <div className={cn("min-w-0 px-4 py-4", className)}>
      <dt className="flex items-center gap-1.5">
        <span className="label-caps-sm truncate text-ink-subtle">{label}</span>
        {provenance && <ProvenanceMark provenance={provenance} />}
      </dt>
      <dd className="mt-1.5">
        <span
          className={cn(
            "font-num block leading-none",
            tone === "lead"
              ? "text-metric font-medium text-ink"
              : tone === "muted"
                ? "text-stat font-medium text-ink-muted"
                : "text-stat font-medium text-ink",
          )}
        >
          {value ?? NO_VALUE}
        </span>
        {(delta !== undefined || spark || footnote) && (
          <div className="mt-1.5 flex min-h-5 flex-wrap items-center gap-x-2 gap-y-0.5">
            {delta !== undefined && (
              <Delta
                value={delta}
                suffix={deltaSuffix}
                invert={invertDelta}
                className="text-xs"
              />
            )}
            {spark && spark.length > 1 && (
              <Sparkline values={spark} polarity={sparkPolarity} width={56} height={16} />
            )}
            {footnote && (
              <span className="truncate text-xs text-ink-subtle">{footnote}</span>
            )}
          </div>
        )}
      </dd>
    </div>
  );
}
