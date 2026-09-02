"use client";

import * as React from "react";
import { cn } from "@/lib/class-names";
import { NO_VALUE } from "@/lib/format";
import type { Provenance } from "@/lib/contracts/common";
import { InfoHint } from "@/components/ui/overlay";
import { Delta, ProvenanceMark } from "./provenance";

/* ---------------------------------------------------------------------------
 * The metric tile. Used across every dashboard, so it carries the whole
 * grammar of a SocialOrbit number: label, value, change, and where it came
 * from — in that reading order, every time.
 * ------------------------------------------------------------------------ */

export function StatTile({
  label,
  value,
  delta,
  deltaSuffix,
  invertDelta,
  hint,
  provenance,
  footnote,
  emphasis = false,
  className,
}: {
  label: string;
  value: React.ReactNode;
  delta?: number | null;
  deltaSuffix?: string;
  invertDelta?: boolean;
  hint?: React.ReactNode;
  provenance?: Provenance;
  footnote?: React.ReactNode;
  /** Marks the one tile on a row that carries the headline number. */
  emphasis?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-1 rounded-lg border p-3",
        emphasis ? "border-brand-line bg-brand-softer" : "border-line bg-surface",
        className,
      )}
    >
      <div className="flex items-center gap-1">
        <span className="truncate text-[11px] font-medium uppercase tracking-[0.05em] text-ink-muted">
          {label}
        </span>
        {hint && <InfoHint label={`About ${label}`}>{hint}</InfoHint>}
        {provenance && <ProvenanceMark provenance={provenance} className="ml-auto" />}
      </div>
      <span
        className={cn(
          "font-num font-semibold tabular-nums leading-tight text-ink",
          emphasis ? "text-[22px]" : "text-[19px]",
        )}
      >
        {value ?? NO_VALUE}
      </span>
      {(delta !== undefined || footnote) && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          {delta !== undefined && (
            <Delta value={delta} suffix={deltaSuffix} invert={invertDelta} />
          )}
          {footnote && <span className="text-[11px] text-ink-muted">{footnote}</span>}
        </div>
      )}
    </div>
  );
}

/** A responsive row of tiles that keeps them readable rather than shrinking them. */
export function StatRow({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rise-stagger grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(9.5rem,1fr))]",
        className,
      )}
      {...props}
    />
  );
}

/** Label/value pair for dense definition lists inside panels. */
export function DataRow({
  label,
  value,
  provenance,
  className,
}: {
  label: string;
  value: React.ReactNode;
  provenance?: Provenance;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-4 border-b border-line py-1.5 last:border-0",
        className,
      )}
    >
      <dt className="shrink-0 text-[12px] text-ink-muted">{label}</dt>
      <dd className="flex min-w-0 items-center gap-1.5">
        {provenance && <ProvenanceMark provenance={provenance} />}
        <span className="truncate font-num text-[13px] tabular-nums text-ink">{value}</span>
      </dd>
    </div>
  );
}
