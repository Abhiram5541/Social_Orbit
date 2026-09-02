import * as React from "react";
import { cn } from "@/lib/class-names";

export type BadgeTone =
  | "neutral"
  | "brand"
  | "positive"
  | "caution"
  | "critical"
  | "inferred";

const TONES: Record<BadgeTone, string> = {
  neutral: "bg-sunken text-ink-muted border-line",
  brand: "bg-brand-soft text-brand-ink border-brand-line",
  positive: "bg-positive-soft text-positive border-positive-line",
  caution: "bg-caution-soft text-caution border-caution-line",
  critical: "bg-critical-soft text-critical border-critical-line",
  inferred: "bg-inferred-soft text-inferred border-inferred-line",
};

/*
 * On the instrument panel the same chip is drawn as a hairline outline with a
 * tinted dot rather than a filled block. A pale filled chip on a dark ground
 * reads as pasted on, and it steals attention from the score, which is the one
 * thing on that panel that should be loud.
 */
const ON_INSTRUMENT: Record<BadgeTone, string> = {
  neutral: "border-instrument-line text-instrument-muted [--dot:var(--color-instrument-muted)]",
  brand: "border-brand/50 text-brand-glow [--dot:var(--color-brand-glow)]",
  positive: "border-positive/50 text-positive-line [--dot:var(--color-positive-line)]",
  caution: "border-caution/50 text-caution-line [--dot:var(--color-caution-line)]",
  critical: "border-critical/60 text-critical-line [--dot:var(--color-critical-line)]",
  inferred: "border-inferred/60 text-inferred-line [--dot:var(--color-inferred-line)]",
};

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  /** A small leading dot — useful for status without an icon. */
  dot?: boolean;
  /** Switches to the outline treatment used on the dark instrument panel. */
  onInstrument?: boolean;
}

export function Badge({
  className,
  tone = "neutral",
  dot,
  onInstrument,
  children,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-sm border px-1.5 py-0.5",
        "text-[11px] font-semibold leading-4 tracking-[0.01em] whitespace-nowrap",
        onInstrument ? ON_INSTRUMENT[tone] : TONES[tone],
        className,
      )}
      {...props}
    >
      {dot && (
        <span
          className={cn(
            "size-1 shrink-0 rounded-full",
            onInstrument ? "bg-[var(--dot)]" : "bg-current",
          )}
          aria-hidden
        />
      )}
      {children}
    </span>
  );
}

/** A removable filter chip. The label stays readable; only the ✕ is a button. */
export function FilterChip({
  label,
  value,
  onRemove,
}: {
  label: string;
  value: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-sm border border-line bg-surface py-0.5 pl-2 pr-1 text-[12px]">
      <span className="text-ink-muted">{label}</span>
      <span className="font-medium text-ink">{value}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove filter ${label} ${value}`}
        className="ml-0.5 grid size-4 place-items-center rounded text-ink-subtle transition-colors hover:bg-sunken hover:text-ink"
      >
        <svg viewBox="0 0 12 12" className="size-3" aria-hidden>
          <path
            d="M3 3l6 6M9 3l-6 6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </span>
  );
}
