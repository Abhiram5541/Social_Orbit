import * as React from "react";
import { cn } from "@/lib/class-names";

/* ---------------------------------------------------------------------------
 * Bento chart primitives.
 *
 * The chart shapes the bento cards are built from, drawn by hand so a
 * dashboard card never ships a charting library. Honest by construction: a
 * column is a stored score or a share of one, a curve is the series it names.
 * ------------------------------------------------------------------------ */

export interface ColumnItem {
  id: string;
  label: string;
  value: number | null;
  /** Solid rather than hatched, with the value printed above it. */
  highlight?: boolean;
  /** What the bubble prints when `value` is a share rather than the figure. */
  display?: string;
  href?: string;
}

/**
 * Rounded columns on a 0–100 scale, against dotted gridlines with a labelled
 * axis. Every column but the highlighted one is hatched: the reference draws
 * context as texture and the reading as fill, which is what lets the eye find
 * the answer without a legend.
 */
export function Columns({
  items,
  height = 220,
  axis = true,
  className,
}: {
  items: ColumnItem[];
  height?: number;
  /** Gridlines at 0/25/50/75/100 with labels down the left. */
  axis?: boolean;
  className?: string;
}) {
  const ticks = [100, 75, 50, 25, 0];
  return (
    <div className={cn("flex gap-3", className)}>
      {axis && (
        <div
          className="flex shrink-0 flex-col justify-between pb-7 font-num text-2xs text-ink-subtle"
          style={{ height }}
          aria-hidden
        >
          {ticks.map((tick) => (
            <span key={tick} className="leading-none">
              {tick}
            </span>
          ))}
        </div>
      )}
      <div className="relative min-w-0 flex-1" style={{ height }}>
        {axis && (
          <div className="absolute inset-x-0 top-0 bottom-7 flex flex-col justify-between" aria-hidden>
            {ticks.map((tick) => (
              <span key={tick} className="block h-px w-full border-t border-dashed border-line-strong/70" />
            ))}
          </div>
        )}
        <div className="relative flex h-full items-end gap-2 sm:gap-3 xl:gap-5">
          {items.map((item, index) => {
            const pct = item.value === null ? 0 : Math.max(2, Math.min(100, item.value));
            const inner = (
              <>
                {/* Definite height, so the bar's percentage has something to
                    resolve against: a flex-grown span does not. */}
                <span
                  className="relative flex w-full items-end"
                  style={{ height: "calc(100% - 1.75rem)" }}
                >
                  {item.highlight && item.value !== null && (
                    <span className="absolute -top-9 left-1/2 flex -translate-x-1/2 flex-col items-center">
                      <span className="rounded-full bg-instrument px-2.5 py-1 font-num text-xs font-semibold text-instrument-ink">
                        {item.display ?? Math.round(item.value)}
                      </span>
                      <span className="mt-0.5 size-2 rounded-full border-2 border-instrument bg-surface" />
                    </span>
                  )}
                  <span
                    className={cn(
                      "animate-grow block w-full rounded-full",
                      item.value === null
                        ? "border border-dashed border-line-strong"
                        : item.highlight
                          ? "bg-brand"
                          : "hatch bg-brand-soft text-brand/45",
                    )}
                    style={{ height: `${pct}%`, "--stagger": `${index * 40}ms` } as React.CSSProperties}
                    title={
                      item.value === null
                        ? `${item.label}: not measured`
                        : `${item.label}: ${item.display ?? Math.round(item.value)}`
                    }
                  />
                </span>
                <span className="mt-2 h-5 w-full truncate text-center text-2xs font-medium text-ink-subtle sm:text-xs">
                  {item.label}
                </span>
              </>
            );
            const cls = "flex h-full min-w-0 flex-1 flex-col items-center";
            return item.href ? (
              <a key={item.id} href={item.href} className={cn(cls, "rounded-md hover:text-ink")}>
                {inner}
              </a>
            ) : (
              <div key={item.id} className={cls}>
                {inner}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * A smooth line over a soft fill — the reference's balance curve. Values are
 * plotted in the order given; the caller says what the order means. The fill
 * is the one gradient in the product, and it is a chart's, not a surface's.
 */
export function AreaCurve({
  values,
  height = 120,
  className,
  ariaLabel,
}: {
  values: number[];
  height?: number;
  className?: string;
  ariaLabel: string;
}) {
  const id = React.useId();
  const width = 320;
  const pad = 6;
  if (values.length < 2) {
    return (
      <div
        className={cn("grid place-items-center rounded-lg bg-sunken text-sm text-ink-subtle", className)}
        style={{ height }}
        role="img"
        aria-label={ariaLabel}
      >
        Not enough points to draw
      </div>
    );
  }
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const x = (i: number) => pad + (i / (values.length - 1)) * (width - pad * 2);
  const y = (v: number) => pad + (1 - (v - min) / (max - min || 1)) * (height - pad * 2);
  // Catmull-Rom → cubic Bézier, so the curve passes through every point.
  let d = `M ${x(0)} ${y(values[0])}`;
  for (let i = 0; i < values.length - 1; i++) {
    const p0 = values[Math.max(0, i - 1)];
    const p1 = values[i];
    const p2 = values[i + 1];
    const p3 = values[Math.min(values.length - 1, i + 2)];
    const c1x = x(i) + (x(i + 1) - x(Math.max(0, i - 1))) / 6;
    const c1y = y(p1) + (y(p2) - y(p0)) / 6;
    const c2x = x(i + 1) - (x(Math.min(values.length - 1, i + 2)) - x(i)) / 6;
    const c2y = y(p2) - (y(p3) - y(p1)) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x(i + 1)} ${y(p2)}`;
  }
  const area = `${d} L ${x(values.length - 1)} ${height} L ${x(0)} ${height} Z`;
  const last = values.length - 1;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={cn("block w-full", className)}
      style={{ height }}
      role="img"
      aria-label={ariaLabel}
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-brand)" stopOpacity="0.28" />
          <stop offset="100%" stopColor="var(--color-brand)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((t) => (
        <line
          key={t}
          x1={0}
          x2={width}
          y1={height * t}
          y2={height * t}
          className="stroke-line-strong/70"
          strokeDasharray="2 4"
          vectorEffect="non-scaling-stroke"
        />
      ))}
      <path d={area} fill={`url(#${id})`} />
      <path
        d={d}
        fill="none"
        className="animate-draw stroke-brand"
        strokeWidth={2.5}
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        pathLength={1}
      />
      <circle
        cx={x(last)}
        cy={y(values[last])}
        r={4}
        className="fill-surface stroke-brand"
        strokeWidth={2.5}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
