import * as React from "react";
import { cn } from "@/lib/class-names";

/* ---------------------------------------------------------------------------
 * Search-allowance gauge — Arch §3.
 *
 * A film-frame counter, not a progress bar: at metered limits every search is
 * an individually countable spend, so each one gets its own frame. Filled
 * frames are spent, open frames remain, and the open frames turn caution when
 * two or fewer are left — the warning arrives before the block, not after.
 *
 * Light-chrome instrument language throughout. No animation of its own, so it
 * is reduced-motion safe by construction; the frame fills move on the global
 * fast transition, which reduced-motion neutralises.
 * ------------------------------------------------------------------------ */

/** Above this the strip stops being one-frame-per-search and fills ten
    frames proportionally — forty hairlines is a barcode, not a counter. */
const FRAME_CAP = 10;

export function QuotaMeter({
  spent,
  limit,
  label,
  variant = "compact",
  className,
}: {
  /** Searches counted against the period, server-authoritative. */
  spent: number;
  /** The period's allowance. Unlimited plans render no meter — do not call. */
  limit: number;
  /** Labelled variant only: names the allowance, e.g. "Full searches". */
  label?: string;
  /** `compact` is the strip + count for footers and chrome; `labelled` adds
      the caps label and the spelled-out remainder. */
  variant?: "compact" | "labelled";
  className?: string;
}) {
  const remaining = Math.max(0, limit - spent);
  const exhausted = remaining <= 0;
  const low = !exhausted && remaining <= 2;

  const frames = Math.min(limit, FRAME_CAP);
  const filled =
    limit <= FRAME_CAP
      ? Math.min(spent, limit)
      : Math.round((Math.min(spent, limit) / limit) * frames);

  const reading = `${remaining} of ${limit} searches remaining this month`;

  const strip = (
    <span
      className={cn("inline-flex items-center gap-2", variant === "compact" && className)}
      role="img"
      aria-label={reading}
    >
      <span aria-hidden className="flex items-center gap-0.75">
        {Array.from({ length: frames }, (_, i) => (
          <span
            key={i}
            className={cn(
              "h-3 w-1 rounded-[1px] transition-colors",
              i < filled
                ? exhausted
                  ? "bg-critical"
                  : "bg-ink"
                : low
                  ? "bg-caution"
                  : "bg-sunken-strong",
            )}
          />
        ))}
      </span>
      <span
        aria-hidden
        className={cn(
          "font-num text-sm font-medium",
          exhausted ? "text-critical" : low ? "text-caution" : "text-ink",
        )}
      >
        {remaining}
      </span>
    </span>
  );

  if (variant === "compact") return strip;

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      {label && <span className="label-caps-sm text-ink-subtle">{label}</span>}
      <div className="flex items-center gap-2.5">
        {strip}
        <span className="text-sm text-ink-muted">
          of <span className="font-num text-ink">{limit}</span> remaining this month
        </span>
      </div>
    </div>
  );
}
