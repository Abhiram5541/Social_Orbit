"use client";

import * as React from "react";
import {
  BadgeCheck,
  CircleDot,
  Sigma,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Minus,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { NO_VALUE, direction, formatDelta, formatRelativeTime, isStale } from "@/lib/format";
import {
  type ConfidenceBand,
  type DataConfidence,
  type FactKind,
  type Provenance,
} from "@/lib/contracts/common";
import { Tooltip } from "@/components/ui/overlay";

/* ---------------------------------------------------------------------------
 * Provenance display — CLAUDE.md §8.
 *
 * This is the component that stops SocialOrbit from being a directory. A
 * number the YouTube API returned and a number a model guessed must never look
 * the same, so every surfaced value can carry its own tier, freshness and
 * confidence.
 * ------------------------------------------------------------------------ */

const FACT_KIND: Record<
  FactKind,
  { label: string; short: string; icon: typeof BadgeCheck; className: string; explain: string }
> = {
  verified: {
    label: "Verified",
    short: "V",
    icon: BadgeCheck,
    className: "text-verified",
    explain: "Confirmed through the creator's own authorised platform connection.",
  },
  observed: {
    label: "Observed",
    short: "O",
    icon: CircleDot,
    className: "text-observed",
    explain: "Measured directly through an official platform API.",
  },
  derived: {
    label: "Derived",
    short: "D",
    icon: Sigma,
    className: "text-ink-muted",
    explain: "Calculated by SocialOrbit from observed values using a published formula.",
  },
  estimated: {
    label: "Estimated",
    short: "E",
    icon: Sigma,
    className: "text-estimated",
    explain: "A model estimate, not a measurement. Treat it as a range, not a fact.",
  },
  inferred: {
    label: "AI inferred",
    short: "AI",
    icon: Sparkles,
    className: "text-inferred",
    explain: "Classified by a model from source material. Not a platform measurement.",
  },
};

export function ProvenanceMark({
  provenance,
  showLabel = false,
  className,
}: {
  provenance: Provenance;
  showLabel?: boolean;
  className?: string;
}) {
  const kind = FACT_KIND[provenance.kind];
  const Icon = kind.icon;
  const stale = isStale(provenance.collectedAt);

  return (
    <Tooltip
      content={
        <span className="block space-y-1">
          <span className="block font-medium">{kind.label}</span>
          <span className="block text-ink-inverse/70">{kind.explain}</span>
          <span className="block text-ink-inverse/70">
            Collected {formatRelativeTime(provenance.collectedAt)} · {provenance.confidence}%
            confidence
          </span>
          {provenance.ai && (
            <span className="block text-ink-inverse/70">
              {provenance.ai.provider} {provenance.ai.model} · prompt{" "}
              {provenance.ai.promptVersion}
            </span>
          )}
        </span>
      }
    >
      <span
        className={cn(
          "inline-flex items-center gap-1 align-middle text-[11px]",
          kind.className,
          stale && "opacity-60",
          className,
        )}
      >
        <Icon className="size-3" aria-hidden />
        {showLabel && <span>{kind.label}</span>}
        <span className="sr-only">
          {kind.label}, collected {formatRelativeTime(provenance.collectedAt)}
        </span>
      </span>
    </Tooltip>
  );
}

const BAND_STYLE: Record<ConfidenceBand, { label: string; bar: string; text: string }> = {
  high: { label: "High confidence", bar: "bg-positive", text: "text-positive" },
  good: { label: "Good confidence", bar: "bg-brand", text: "text-brand-ink" },
  moderate: { label: "Moderate confidence", bar: "bg-caution", text: "text-caution" },
  preliminary: { label: "Preliminary", bar: "bg-critical", text: "text-critical" },
};

/**
 * Confidence is rendered as its own axis, never blended into a quality score.
 * A creator can be excellent and barely observed at the same time.
 */
export function ConfidenceMeter({
  confidence,
  compact = false,
  className,
}: {
  confidence: Pick<DataConfidence, "score" | "band">;
  compact?: boolean;
  className?: string;
}) {
  const style = BAND_STYLE[confidence.band];
  if (compact) {
    return (
      <span className={cn("inline-flex items-center gap-1.5", className)}>
        <span className="h-1 w-8 overflow-hidden rounded-full bg-line" aria-hidden>
          <span
            className={cn("block h-full rounded-full", style.bar)}
            style={{ width: `${confidence.score}%` }}
          />
        </span>
        <span className="font-num text-[11px] tabular-nums text-ink-muted">
          {Math.round(confidence.score)}%
        </span>
      </span>
    );
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[12px] text-ink-muted">Data confidence</span>
        <span className={cn("font-num text-[13px] font-medium tabular-nums", style.text)}>
          {Math.round(confidence.score)}%
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-line">
        <div
          className={cn("h-full rounded-full", style.bar)}
          style={{ width: `${confidence.score}%` }}
        />
      </div>
      <p className="text-[11px] text-ink-muted">
        {style.label}
        {confidence.band === "preliminary" &&
          " — too little history to rely on these numbers yet."}
      </p>
    </div>
  );
}

/** The profile footer readout: how much of what you are reading was measured. */
export function ProvenanceMix({
  mix,
  className,
}: {
  mix: DataConfidence["mix"];
  className?: string;
}) {
  const entries = (
    [
      ["verified", "bg-verified"],
      ["observed", "bg-observed"],
      ["derived", "bg-neutral-metric"],
      ["estimated", "bg-estimated"],
      ["inferred", "bg-inferred"],
    ] as const
  ).filter(([key]) => mix[key] > 0);

  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-2", className)}>
      <div className="flex h-1.5 w-32 overflow-hidden rounded-full bg-line" aria-hidden>
        {entries.map(([key, colour]) => (
          <span key={key} className={colour} style={{ width: `${mix[key]}%` }} />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-muted">
        {entries.map(([key, colour]) => (
          <span key={key} className="inline-flex items-center gap-1">
            <span className={cn("size-1.5 rounded-full", colour)} aria-hidden />
            {FACT_KIND[key].label}{" "}
            <span className="font-num tabular-nums text-ink">{Math.round(mix[key])}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/** A signed change with meaning-bearing colour. Flat is deliberately grey. */
export function Delta({
  value,
  suffix,
  className,
  invert = false,
}: {
  value: number | null | undefined;
  suffix?: string;
  className?: string;
  /** For metrics where down is good — bot risk, inactive audience. */
  invert?: boolean;
}) {
  const dir = direction(value);
  const good = invert ? dir === "down" : dir === "up";
  const bad = invert ? dir === "up" : dir === "down";
  const Icon = dir === "up" ? TrendingUp : dir === "down" ? TrendingDown : Minus;

  if (value === null || value === undefined) {
    return <span className={cn("font-num text-ink-subtle", className)}>{NO_VALUE}</span>;
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-num text-[12px] font-medium tabular-nums",
        good && "text-positive",
        bad && "text-critical",
        !good && !bad && "text-ink-muted",
        className,
      )}
    >
      <Icon className="size-3" aria-hidden />
      {formatDelta(value)}
      {suffix && <span className="font-sans text-ink-muted">{suffix}</span>}
    </span>
  );
}

/** Freshness stamp. Turns amber once the observation is past its staleness window. */
export function Freshness({
  at,
  prefix = "Updated",
  className,
}: {
  at: string | null;
  prefix?: string;
  className?: string;
}) {
  const stale = isStale(at);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[12px]",
        stale ? "text-caution" : "text-ink-muted",
        className,
      )}
    >
      {prefix} {formatRelativeTime(at)}
      {stale && <span className="sr-only">(stale)</span>}
    </span>
  );
}
