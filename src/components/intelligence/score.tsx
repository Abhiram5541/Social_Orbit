import * as React from "react";
import { cn } from "@/lib/class-names";
import { NO_VALUE } from "@/lib/format";
import { healthBand } from "@/lib/contracts/score";
import type { RiskLevel } from "@/lib/contracts/common";
import { Badge, type BadgeTone } from "@/components/ui/badge";

/* ---------------------------------------------------------------------------
 * Score display.
 *
 * The score is the product's headline artifact, so it is the one place the
 * design spends its boldness: a dark instrument readout with the value set
 * large and light, ringed by its own components. Everything around it stays
 * quiet.
 *
 * A deliberate restraint runs through the colour: the ring is always cobalt,
 * because the score is one brand artifact rather than a traffic light. Only
 * components in genuinely poor territory take on warning colour, so a panel
 * where every bar is a different hue never happens.
 * ------------------------------------------------------------------------ */

export const HEALTH_BAND_LABEL: Record<ReturnType<typeof healthBand>, string> = {
  excellent: "Excellent",
  strong: "Strong performance",
  fair: "Fair",
  weak: "Needs review",
};

export type ScoreTone = "light" | "instrument";

/** Sub-50 is a real problem; sub-70 is worth noticing; above that stays quiet. */
function componentTone(value: number, tone: ScoreTone): string {
  if (value < 50) return "bg-critical";
  if (value < 70) return "bg-caution";
  return tone === "instrument" ? "bg-instrument-muted" : "bg-neutral-metric";
}

export function ScoreRing({
  value,
  size = 96,
  label = "SocialOrbit Health",
  tone = "light",
  animate = true,
  className,
}: {
  value: number | null;
  size?: number;
  label?: string;
  tone?: ScoreTone;
  /** The sweep runs once on mount. Turn it off for print or dense listings. */
  animate?: boolean;
  className?: string;
}) {
  const stroke = size >= 120 ? 7 : size >= 80 ? 6 : 5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = value === null ? 0 : Math.max(0, Math.min(100, value));
  const offset = circumference * (1 - pct / 100);

  const track = tone === "instrument" ? "stroke-instrument-line" : "stroke-line";
  const arc = tone === "instrument" ? "stroke-brand-glow" : "stroke-brand";
  const numeral = tone === "instrument" ? "text-instrument-ink" : "text-ink";
  const unit = tone === "instrument" ? "text-instrument-muted" : "text-ink-subtle";

  return (
    <div
      className={cn("relative shrink-0", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={
        value === null
          ? `${label}: not yet available`
          : `${label}: ${Math.round(value)} out of 100`
      }
    >
      <svg viewBox={`0 0 ${size} ${size}`} className="size-full -rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className={track}
        />
        {value !== null && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            // The arc sweeps from empty to its value once on mount. Under
            // reduced motion the animation is neutralised and the inline
            // dashoffset below is what renders, so the value is never lost.
            strokeDashoffset={offset}
            className={cn(arc, animate && "animate-sweep")}
            style={
              animate
                ? ({
                    "--sweep-from": circumference,
                    "--sweep-to": offset,
                  } as React.CSSProperties)
                : undefined
            }
          />
        )}
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center leading-none">
        <span
          className={cn("font-num font-light tabular-nums", numeral)}
          style={{ fontSize: size * 0.34, letterSpacing: "-0.04em" }}
        >
          {value === null ? NO_VALUE : Math.round(value)}
        </span>
        {value !== null && (
          <span className={cn("mt-1 label-caps text-[9px]", unit)}>/100</span>
        )}
      </div>
    </div>
  );
}

/** One weighted component of a score, with its contribution made visible. */
export function ScoreBar({
  label,
  value,
  weight,
  available = true,
  tone = "light",
  index = 0,
  className,
}: {
  label: string;
  value: number | null;
  weight?: number;
  available?: boolean;
  tone?: ScoreTone;
  /** Position in the group, used to stagger the growth animation. */
  index?: number;
  className?: string;
}) {
  // A measured zero still gets a visible sliver. Rendering it as literally no
  // bar makes it indistinguishable at a glance from a component that was never
  // measured, and those mean opposite things: "we looked, it is the floor"
  // against "nobody looked". The number beside it says which, but the bar is
  // what the eye reads first.
  const measured = available && value !== null;
  const raw = value === null ? 0 : Math.max(0, Math.min(100, value));
  const pct = value === null ? 0 : Math.max(raw, 1.5);
  const labelColour = tone === "instrument" ? "text-instrument-muted" : "text-ink-muted";
  const valueColour = tone === "instrument" ? "text-instrument-ink" : "text-ink";
  const trackColour = tone === "instrument" ? "bg-instrument-line" : "bg-line";

  return (
    <div className={cn("grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1", className)}>
      <div className="flex min-w-0 items-baseline gap-1.5">
        <span className={cn("truncate text-[12px]", labelColour)}>{label}</span>
        {weight !== undefined && (
          // Named, because it sits beside a value and is not one. A bare "15%"
          // next to an empty bar reads as the number the bar failed to draw.
          <span
            className={cn("shrink-0 font-num text-[10px] tabular-nums", labelColour)}
            title={`Weight in the formula: ${Math.round(weight * 100)}%`}
          >
            <span className="sr-only">weight </span>
            {Math.round(weight * 100)}%
          </span>
        )}
      </div>
      <span className={cn("font-num text-[13px] font-semibold tabular-nums", valueColour)}>
        {measured ? Math.round(value) : NO_VALUE}
      </span>
      <div
        className={cn(
          "col-span-2 h-1 overflow-hidden rounded-sm",
          // An unmeasured component gets a hatched track rather than an empty
          // one. Empty reads as "a bar that failed to render"; hatched reads as
          // "there is nothing to draw here", which is what is true.
          measured ? trackColour : "border border-dashed",
          measured
            ? ""
            : tone === "instrument"
              ? "border-instrument-line bg-transparent"
              : "border-line bg-transparent",
        )}
      >
        {measured && (
          <div
            className={cn("animate-extend h-full rounded-sm", componentTone(raw, tone))}
            style={
              {
                width: `${pct}%`,
                "--stagger": `${120 + index * 45}ms`,
              } as React.CSSProperties
            }
          />
        )}
      </div>
    </div>
  );
}

/** Compact inline score used in tables and result cards. */
export function ScorePill({
  value,
  label,
  className,
}: {
  value: number | null;
  label?: string;
  className?: string;
}) {
  if (value === null) {
    return <span className={cn("font-num text-ink-subtle", className)}>{NO_VALUE}</span>;
  }
  const band = healthBand(value);
  return (
    <span
      className={cn("inline-flex items-baseline gap-1.5", className)}
      title={label ? `${label}: ${HEALTH_BAND_LABEL[band]}` : HEALTH_BAND_LABEL[band]}
    >
      <span
        aria-hidden
        className={cn(
          "size-1 shrink-0 self-center rounded-full",
          value < 50 ? "bg-critical" : value < 70 ? "bg-caution" : "bg-brand",
        )}
      />
      <span className="font-num text-[13px] font-semibold tabular-nums text-ink">
        {Math.round(value)}
      </span>
    </span>
  );
}

const RISK_TONE: Record<RiskLevel, BadgeTone> = {
  // Neutral, never green: an unassessed creator has not passed anything.
  unknown: "neutral",
  low: "positive",
  medium: "caution",
  high: "critical",
};

const RISK_LABEL: Record<RiskLevel, string> = {
  unknown: "Risk not assessed",
  low: "Low risk",
  medium: "Medium risk",
  high: "High risk",
};

export function RiskBadge({
  level,
  onInstrument,
  className,
}: {
  level: RiskLevel;
  onInstrument?: boolean;
  className?: string;
}) {
  return (
    <Badge tone={RISK_TONE[level]} dot onInstrument={onInstrument} className={className}>
      {RISK_LABEL[level]}
    </Badge>
  );
}
