"use client";

import * as React from "react";
import {
  BadgeCheck,
  CircleDot,
  ExternalLink,
  Sigma,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Minus,
} from "lucide-react";
import { cn } from "@/lib/class-names";
import { NO_VALUE, direction, formatDelta, formatRelativeTime, isStale } from "@/lib/format";
import {
  confidenceBand,
  type ConfidenceBand,
  type DataConfidence,
  type FactKind,
  type Provenance,
  type SourceTier,
} from "@/lib/contracts/common";
import { Popover, Tooltip } from "@/components/ui/overlay";
import { RelativeTime } from "@/components/ui/relative-time";

/* ---------------------------------------------------------------------------
 * Provenance display — CLAUDE.md §8.
 *
 * This is the component that stops SENSO from being a directory. A
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
    explain: "Calculated by SENSO from observed values using a published formula.",
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
          "inline-flex items-center gap-1 align-middle text-xs",
          kind.className,
          stale && "opacity-60",
          className,
        )}
      >
        <Icon className="size-3" aria-hidden />
        {showLabel && <span>{kind.label}</span>}
        <span className="sr-only">
          {kind.label}, collected <RelativeTime at={provenance.collectedAt} />
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
        <span className="h-[5px] w-14 overflow-hidden rounded-full bg-line" aria-hidden>
          <span
            className={cn("block h-full rounded-full", style.bar)}
            style={{ width: `${confidence.score}%` }}
          />
        </span>
        <span className="font-num text-xs text-ink-muted">
          {Math.round(confidence.score)}%
        </span>
      </span>
    );
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm text-ink-muted">Data confidence</span>
        <span className={cn("font-num text-base font-medium", style.text)}>
          {Math.round(confidence.score)}%
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-line">
        <div
          className={cn("h-full rounded-full", style.bar)}
          style={{ width: `${confidence.score}%` }}
        />
      </div>
      <p className="text-xs text-ink-muted">
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
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
        {entries.map(([key, colour]) => (
          <span key={key} className="inline-flex items-center gap-1">
            <span className={cn("size-1.5 rounded-full", colour)} aria-hidden />
            {FACT_KIND[key].label}{" "}
            <span className="font-num text-ink">{Math.round(mix[key])}%</span>
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
        "inline-flex items-center gap-1 font-num text-sm font-medium",
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
        "inline-flex items-center gap-1 text-sm",
        stale ? "text-caution" : "text-ink-muted",
        className,
      )}
    >
      <RelativeTime at={at} prefix={prefix} />
      {stale && <span className="sr-only">(stale)</span>}
    </span>
  );
}

/* ---------------------------------------------------------------------------
 * The provenance dossier.
 *
 * A tooltip is where a differentiator goes to die: it is unreachable on touch,
 * cannot be read at leisure and cannot hold a source link. Any number a user
 * might have to defend in a meeting gets this instead — a click-through panel
 * naming the source, the collection time, the method, the confidence and, for
 * a derived figure, the formula that produced it (CLAUDE.md §8, DPR §22).
 * ------------------------------------------------------------------------ */

const TIER_LABEL: Record<SourceTier, string> = {
  platform_api: "Official platform API",
  oauth_authorized: "Creator-authorised account",
  licensed_provider: "Licensed data provider",
  public_research: "Permitted public research",
  ai_inference: "AI classification",
  manual_entry: "SENSO operator",
};

/** Tier 1 is the strongest claim; the scale is what makes a tier meaningful. */
const TIER_RANK: Record<SourceTier, number> = {
  platform_api: 1,
  oauth_authorized: 1,
  licensed_provider: 3,
  public_research: 4,
  ai_inference: 5,
  manual_entry: 4,
};

export function ProvenanceChip({
  provenance,
  className,
}: {
  provenance: Provenance;
  className?: string;
}) {
  const kind = FACT_KIND[provenance.kind];
  const Icon = kind.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-1.5 py-px text-2xs font-semibold uppercase tracking-[0.06em]",
        provenance.kind === "verified" && "border-brass-line bg-brass-soft text-brass-ink",
        provenance.kind === "observed" && "border-positive-line bg-positive-soft text-observed",
        provenance.kind === "derived" && "border-line bg-sunken text-ink-muted",
        provenance.kind === "estimated" && "border-caution-line bg-caution-soft text-estimated",
        provenance.kind === "inferred" && "border-inferred-line bg-inferred-soft text-inferred",
        className,
      )}
    >
      <Icon className="size-2.5" aria-hidden />
      {kind.label}
    </span>
  );
}

/**
 * A value that can explain itself. The dotted rule under the figure is the
 * affordance — the same convention a footnote uses, and quiet enough to sit in
 * a table column without turning every row into a link.
 */
export function TrackedValue({
  label,
  value,
  provenance,
  derivation,
  className,
  valueClassName,
}: {
  /** What the figure measures. Titles the panel. */
  label: string;
  value: React.ReactNode;
  provenance: Provenance;
  /** For a derived figure: the formula, in words or notation. */
  derivation?: React.ReactNode;
  className?: string;
  valueClassName?: string;
}) {
  const kind = FACT_KIND[provenance.kind];

  return (
    <Popover
      title={`How ${label} was determined`}
      className="w-[19rem] max-w-[calc(100vw-1rem)]"
      trigger={(props) => (
        <button
          type="button"
          {...props}
          className={cn(
            "group inline-flex items-baseline gap-1.5 rounded-sm text-left",
            className,
          )}
        >
          <span
            className={cn(
              "font-num decoration-line-strong decoration-dotted underline-offset-4 group-hover:decoration-ink-subtle",
              "underline",
              valueClassName,
            )}
          >
            {value}
          </span>
          <ProvenanceMark provenance={provenance} />
          <span className="sr-only">— show source and confidence</span>
        </button>
      )}
    >
      <div className="border-b border-rule px-3 py-2.5">
        <p className="label-caps-sm text-ink-subtle">{label}</p>
        <p className="mt-1 flex items-baseline gap-2">
          <span className="font-num text-stat font-medium text-ink">{value}</span>
          <ProvenanceChip provenance={provenance} />
        </p>
      </div>

      <dl className="divide-y divide-rule px-3 text-sm">
        <ProvenanceRow term="Method" detail={kind.explain} />
        <ProvenanceRow
          term="Source"
          detail={
            <>
              {TIER_LABEL[provenance.tier]}{" "}
              <span className="text-ink-subtle">· tier {TIER_RANK[provenance.tier]} of 5</span>
              {provenance.sourceUrl && (
                <>
                  <br />
                  <a
                    href={provenance.sourceUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="inline-flex items-center gap-1 text-brand-ink hover:underline"
                  >
                    View source
                    <ExternalLink className="size-3" aria-hidden />
                  </a>
                </>
              )}
            </>
          }
        />
        <ProvenanceRow
          term="Collected"
          detail={
            <>
              <RelativeTime at={provenance.collectedAt} />
              {isStale(provenance.collectedAt) && (
                <span className="ml-1.5 text-caution">past refresh window</span>
              )}
            </>
          }
        />
        {provenance.verifiedAt && (
          <ProvenanceRow
            term="Verified"
            detail={<RelativeTime at={provenance.verifiedAt} />}
          />
        )}
        {derivation && <ProvenanceRow term="Derivation" detail={derivation} />}
        {provenance.ai && (
          <ProvenanceRow
            term="Model"
            detail={
              <>
                {provenance.ai.provider} {provenance.ai.model}
                <br />
                <span className="text-ink-subtle">
                  prompt {provenance.ai.promptVersion} · schema {provenance.ai.schemaVersion}
                </span>
              </>
            }
          />
        )}
      </dl>

      <div className="border-t border-rule px-3 py-2.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-sm text-ink-muted">Field confidence</span>
          <span className="font-num text-sm font-medium text-ink">
            {Math.round(provenance.confidence)}%
          </span>
        </div>
        <div className="mt-1 h-1 overflow-hidden rounded-full bg-sunken-strong">
          <div
            className={cn(
              "h-full rounded-full",
              BAND_STYLE[confidenceBand(provenance.confidence)].bar,
            )}
            style={{ width: `${provenance.confidence}%` }}
          />
        </div>
      </div>
    </Popover>
  );
}

function ProvenanceRow({
  term,
  detail,
}: {
  term: string;
  detail: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[5.5rem_1fr] gap-3 py-2">
      <dt className="text-ink-subtle">{term}</dt>
      <dd className="min-w-0 text-ink">{detail}</dd>
    </div>
  );
}
