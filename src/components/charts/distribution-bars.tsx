import * as React from "react";
import { cn } from "@/lib/class-names";
import { NO_VALUE } from "@/lib/format";

/* ---------------------------------------------------------------------------
 * Distribution bars.
 *
 * Split out of `distribution.tsx` deliberately. These two draw with tokens and
 * nothing else, while their former neighbours pull in Recharts — so importing
 * a labelled bar row used to ship a whole charting library with it. That cost
 * is fine on an analytics screen and absurd on a marketing page, and it was
 * being paid on admin screens that render no plot at all.
 *
 * No `"use client"`: neither component holds state or handlers, so it renders
 * on the server, and a client tree that imports it still works.
 * ------------------------------------------------------------------------ */

export type DistributionTone =
  | "positive"
  | "brand"
  | "caution"
  | "critical"
  | "neutral"
  | "inferred"
  | "verified";

export const BAR_TONE: Record<DistributionTone, string> = {
  positive: "bg-positive",
  brand: "bg-brand",
  caution: "bg-caution",
  critical: "bg-critical",
  neutral: "bg-neutral-metric",
  inferred: "bg-inferred",
  verified: "bg-verified",
};

/*
 * The same six tones raised for the graphite chrome. A measurement hue mixed
 * for white paper loses its identity against near-black — deep emerald and
 * deep rose both collapse toward the ground — so each is lifted rather than
 * reused, and the neutral becomes a light grey instead of a dark one.
 */
const BAR_TONE_INSTRUMENT: Record<DistributionTone, string> = {
  positive: "bg-positive-lift",
  brand: "bg-brand-lift",
  caution: "bg-caution-lift",
  critical: "bg-critical-lift",
  neutral: "bg-instrument-muted",
  inferred: "bg-inferred-line",
  verified: "bg-verified-lift",
};

export interface DistributionRow {
  label: string;
  /** Secondary label — the numeric range or share the row covers. */
  sublabel?: string;
  value: number;
  tone?: DistributionTone;
}

/**
 * Labelled horizontal bars sharing one scale.
 *
 * The bar sits *under* its label rather than beside it, so long category names
 * never squeeze the plot area — the single most common way a bar chart in a
 * sidebar column ends up unreadable.
 */
export function DistributionRows({
  rows,
  total,
  emptyLabel = "Nothing measured yet",
  showZero = false,
  onInstrument = false,
  className,
}: {
  rows: DistributionRow[];
  /** The denominator for the share. Defaults to the row total. */
  total?: number;
  emptyLabel?: string;
  /** Keeps rows whose count is zero — useful when the absence is the point. */
  showZero?: boolean;
  /** Renders against the graphite chrome rather than on paper. */
  onInstrument?: boolean;
  className?: string;
}) {
  const sum = total ?? rows.reduce((acc, row) => acc + row.value, 0);
  const max = Math.max(1, ...rows.map((row) => row.value));
  const visible = showZero ? rows : rows.filter((row) => row.value > 0);

  if (visible.length === 0) {
    return (
      <p className={cn("text-sm", onInstrument ? "text-instrument-subtle" : "text-ink-subtle")}>
        {emptyLabel}
      </p>
    );
  }

  const tones = onInstrument ? BAR_TONE_INSTRUMENT : BAR_TONE;

  return (
    <ul className={cn("space-y-2.5", className)}>
      {visible.map((row) => (
        <li key={row.label}>
          <div className="flex items-baseline justify-between gap-3">
            <span
              className={cn(
                "min-w-0 truncate text-base",
                onInstrument ? "text-instrument-ink" : "text-ink",
              )}
            >
              {row.label}
              {row.sublabel && (
                <span
                  className={cn(
                    "ml-1.5 font-num text-xs",
                    onInstrument ? "text-instrument-subtle" : "text-ink-subtle",
                  )}
                >
                  {row.sublabel}
                </span>
              )}
            </span>
            <span className="shrink-0 font-num text-sm">
              <span className={onInstrument ? "text-instrument-ink" : "text-ink"}>
                {row.value.toLocaleString()}
              </span>
              {sum > 0 && (
                <span
                  className={cn(
                    "ml-1.5",
                    onInstrument ? "text-instrument-subtle" : "text-ink-subtle",
                  )}
                >
                  {((row.value / sum) * 100).toFixed(1)}%
                </span>
              )}
            </span>
          </div>
          <div
            className={cn(
              "mt-1.5 h-1.5 overflow-hidden rounded-full",
              onInstrument ? "bg-instrument-line" : "bg-sunken-strong",
            )}
          >
            <div
              className={cn("animate-extend h-full rounded-full", tones[row.tone ?? "neutral"])}
              style={{ width: `${(row.value / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * A stacked composition bar — one row, several segments, used where the parts
 * matter more than their individual magnitudes (verification mix, risk mix).
 */
export function CompositionBar({
  segments,
  onInstrument = false,
  className,
}: {
  segments: { label: string; value: number; tone: DistributionTone }[];
  /** Renders against the graphite chrome rather than on paper. */
  onInstrument?: boolean;
  className?: string;
}) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  if (total === 0) {
    return (
      <p
        className={cn(
          "text-sm",
          onInstrument ? "text-instrument-subtle" : "text-ink-subtle",
          className,
        )}
      >
        {NO_VALUE}
      </p>
    );
  }

  const visible = segments.filter((segment) => segment.value > 0);
  const tones = onInstrument ? BAR_TONE_INSTRUMENT : BAR_TONE;

  return (
    <div className={cn("space-y-2.5", className)}>
      <div
        className={cn(
          "flex h-2 gap-px overflow-hidden rounded-full",
          onInstrument ? "bg-instrument-line" : "bg-sunken-strong",
        )}
        aria-hidden
      >
        {visible.map((segment) => (
          <span
            key={segment.label}
            className={tones[segment.tone]}
            style={{ width: `${(segment.value / total) * 100}%` }}
          />
        ))}
      </div>
      <ul
        className={cn(
          "flex flex-wrap gap-x-4 gap-y-1 text-sm",
          onInstrument ? "text-instrument-muted" : "text-ink-muted",
        )}
      >
        {visible.map((segment) => (
          <li key={segment.label} className="inline-flex items-center gap-1.5">
            <span
              className={cn("size-1.5 shrink-0 rounded-full", tones[segment.tone])}
              aria-hidden
            />
            {segment.label}
            <span className={cn("font-num", onInstrument ? "text-instrument-ink" : "text-ink")}>
              {segment.value.toLocaleString()}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
