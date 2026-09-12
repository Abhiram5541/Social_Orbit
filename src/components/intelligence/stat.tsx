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
  // A cell of the strip, not an object of its own. Emphasis is structural —
  // the lead figure is set larger and lighter — never a brand tint: cobalt on
  // a static metric would read as interactive or verified.
  return (
    <div className={cn("min-w-0 px-4 py-4", className)}>
      <div className="flex items-center gap-1">
        <span className="label-caps-sm truncate text-ink-subtle">{label}</span>
        {hint && <InfoHint label={`About ${label}`}>{hint}</InfoHint>}
        {provenance && <ProvenanceMark provenance={provenance} className="ml-auto" />}
      </div>
      <span
        className={cn(
          "font-num mt-1.5 block leading-none text-ink",
          emphasis ? "text-metric font-medium" : "text-stat font-medium",
        )}
      >
        {value ?? NO_VALUE}
      </span>
      {(delta !== undefined || footnote) && (
        <div className="mt-1.5 flex min-h-5 flex-wrap items-center gap-x-2 gap-y-0.5">
          {delta !== undefined && (
            <Delta
              value={delta}
              suffix={deltaSuffix}
              invert={invertDelta}
              className="text-xs"
            />
          )}
          {footnote && <span className="text-xs text-ink-subtle">{footnote}</span>}
        </div>
      )}
    </div>
  );
}

/**
 * One continuous strip divided by rules, not a tray of separate boxes.
 *
 * Every dashboard in the product used to open on a row of identical bordered
 * tiles floating on grey. That reads as a template because it *is* one: six
 * objects at six equal weights, none of which can be more important than any
 * other. A strip is one instrument, which is also what lets it stay dense.
 */
export function StatRow({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  // `count` drops null, undefined and the `false` a conditional child
  // leaves behind — counting those pushed the strip to the wrong
  // column count whenever a tile was rendered conditionally.
  const count = React.Children.toArray(children).length;
  return (
    <div
      className={cn(
        "grid overflow-hidden rounded-xl border border-line bg-surface",
        // A one-metric strip must not be forced into two columns, and a
        // two-metric strip must not leave a third cell empty — both were
        // leaving a visible hole in the band.
        count === 1 ? "grid-cols-1" : "grid-cols-2",
        "divide-x divide-y divide-rule",
        // The strip must divide evenly: a stranded row of two reads as a
        // mistake rather than a grid.
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
    </div>
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
      <dt className="shrink-0 text-sm text-ink-muted">{label}</dt>
      <dd className="flex min-w-0 items-center gap-1.5">
        {provenance && <ProvenanceMark provenance={provenance} />}
        <span className="truncate font-num text-base text-ink">{value}</span>
      </dd>
    </div>
  );
}
