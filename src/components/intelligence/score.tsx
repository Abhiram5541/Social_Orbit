import * as React from "react";
import { cn } from "@/lib/cn";
import { NO_VALUE } from "@/lib/format";
import { healthBand } from "@/lib/contracts/score";
import type { RiskLevel } from "@/lib/contracts/common";
import { Badge, type BadgeTone } from "@/components/ui/badge";

/* ---------------------------------------------------------------------------
 * Score display.
 *
 * A deliberate restraint runs through this file: the SocialOrbit score itself
 * is always drawn in brand blue, because it is one brand artifact rather than a
 * traffic light. Only components that fall into genuinely poor territory take
 * on warning colour. A panel where every bar is a different hue reads as
 * decoration and stops communicating.
 * ------------------------------------------------------------------------ */

export const HEALTH_BAND_LABEL: Record<ReturnType<typeof healthBand>, string> = {
  excellent: "Excellent",
  strong: "Strong performance",
  fair: "Fair",
  weak: "Needs review",
};

/** Sub-50 is a real problem; sub-70 is worth noticing; above that stays quiet. */
function componentTone(value: number): string {
  if (value < 50) return "bg-critical";
  if (value < 70) return "bg-caution";
  return "bg-neutral-metric";
}

export function ScoreRing({
  value,
  size = 96,
  label = "SocialOrbit Health",
  className,
}: {
  value: number | null;
  size?: number;
  label?: string;
  className?: string;
}) {
  const stroke = size >= 80 ? 8 : 6;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = value === null ? 0 : Math.max(0, Math.min(100, value));
  const offset = circumference * (1 - pct / 100);

  return (
    <div
      className={cn("relative shrink-0", className)}
      style={{ width: size, height: size }}
      role="img"
      aria-label={
        value === null ? `${label}: not yet available` : `${label}: ${Math.round(value)} out of 100`
      }
    >
      <svg viewBox={`0 0 ${size} ${size}`} className="size-full -rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-line"
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
            strokeDashoffset={offset}
            className="stroke-brand"
          />
        )}
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center leading-none">
        <span
          className="font-mono font-semibold tabular-nums text-ink"
          style={{ fontSize: size * 0.28 }}
        >
          {value === null ? NO_VALUE : Math.round(value)}
        </span>
        {value !== null && (
          <span className="mt-0.5 text-[10px] text-ink-subtle">/100</span>
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
  className,
}: {
  label: string;
  value: number | null;
  weight?: number;
  available?: boolean;
  className?: string;
}) {
  const pct = value === null ? 0 : Math.max(0, Math.min(100, value));
  return (
    <div className={cn("grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1", className)}>
      <div className="flex min-w-0 items-baseline gap-1.5">
        <span className="truncate text-[12px] text-ink-muted">{label}</span>
        {weight !== undefined && (
          <span className="shrink-0 font-mono text-[10px] tabular-nums text-ink-subtle">
            {Math.round(weight * 100)}%
          </span>
        )}
      </div>
      <span className="font-mono text-[13px] font-medium tabular-nums text-ink">
        {available && value !== null ? Math.round(value) : NO_VALUE}
      </span>
      <div className="col-span-2 h-1.5 overflow-hidden rounded-full bg-line">
        {available && value !== null && (
          <div
            className={cn("h-full rounded-full transition-[width]", componentTone(value))}
            style={{ width: `${pct}%` }}
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
    return <span className={cn("font-mono text-ink-subtle", className)}>{NO_VALUE}</span>;
  }
  const band = healthBand(value);
  return (
    <span
      className={cn("inline-flex items-baseline gap-1", className)}
      title={label ? `${label}: ${HEALTH_BAND_LABEL[band]}` : HEALTH_BAND_LABEL[band]}
    >
      <span
        aria-hidden
        className={cn(
          "size-1.5 shrink-0 self-center rounded-full",
          value < 50 ? "bg-critical" : value < 70 ? "bg-caution" : "bg-brand",
        )}
      />
      <span className="font-mono text-[13px] font-medium tabular-nums text-ink">
        {Math.round(value)}
      </span>
    </span>
  );
}

const RISK_TONE: Record<RiskLevel, BadgeTone> = {
  low: "positive",
  medium: "caution",
  high: "critical",
};

const RISK_LABEL: Record<RiskLevel, string> = {
  low: "Low risk",
  medium: "Medium risk",
  high: "High risk",
};

export function RiskBadge({ level, className }: { level: RiskLevel; className?: string }) {
  return (
    <Badge tone={RISK_TONE[level]} dot className={className}>
      {RISK_LABEL[level]}
    </Badge>
  );
}
