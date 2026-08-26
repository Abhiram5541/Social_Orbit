import * as React from "react";
import { cn } from "@/lib/cn";

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

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  /** A small leading dot — useful for status without an icon. */
  dot?: boolean;
}

export function Badge({ className, tone = "neutral", dot, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded border px-1.5 py-0.5",
        "text-[11px] font-medium leading-4 whitespace-nowrap",
        TONES[tone],
        className,
      )}
      {...props}
    >
      {dot && <span className="size-1.5 shrink-0 rounded-full bg-current" aria-hidden />}
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
    <span className="inline-flex items-center gap-1 rounded border border-line bg-surface py-0.5 pl-2 pr-1 text-[12px]">
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
