"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { cn } from "@/lib/cn";
import { formatAxisDate, formatCompact, formatNumber, formatPercent } from "@/lib/format";

/**
 * Number formatting is named rather than passed as a function: these are
 * client components, and a server component cannot hand a closure across the
 * boundary. A name is serialisable, so the same chart works from either side.
 */
export type ValueFormat = "compact" | "integer" | "percent" | "exact";

const FORMATTERS: Record<ValueFormat, (value: number) => string> = {
  compact: (value) => formatCompact(value),
  integer: (value) => String(Math.round(value)),
  percent: (value) => formatPercent(value),
  exact: (value) => formatNumber(value),
};

/* ---------------------------------------------------------------------------
 * Chart primitives.
 *
 * Deliberate constraints, applied everywhere:
 *   · One y-axis. Two measures of different scale get two charts, never two
 *     scales on one — a dual axis lets the author imply any correlation.
 *   · 2px strokes, recessive grid, horizontal rules only.
 *   · A crosshair tooltip by default; the value is read on hover, not from a
 *     label on every point.
 *   · A single series carries no legend — the card title names it.
 *   · Text uses ink tokens, never the series colour.
 * ------------------------------------------------------------------------ */

const GRID = "var(--color-grid)";
const AXIS_TEXT = "var(--color-ink-subtle)";

const axisProps = {
  stroke: "transparent",
  tick: { fill: AXIS_TEXT, fontSize: 11 },
  tickLine: false,
  axisLine: false,
} as const;

function ChartTooltip({
  active,
  payload,
  label,
  valueLabel,
  format,
}: {
  active?: boolean;
  payload?: { value: number; dataKey?: string | number }[];
  label?: string | number;
  valueLabel: string;
  format: ValueFormat;
}) {
  if (!active || !payload?.length) return null;
  const render = FORMATTERS[format];
  return (
    <div className="rounded-md bg-ink px-2 py-1.5 text-[12px] leading-4 text-ink-inverse shadow-popover">
      <p className="text-ink-inverse/60">{formatAxisDate(String(label))}</p>
      <p className="font-num tabular-nums">
        {render(payload[0].value)}{" "}
        <span className="font-sans text-ink-inverse/60">{valueLabel}</span>
      </p>
    </div>
  );
}

export interface TrendPoint {
  date: string;
  value: number | null;
}

export function TrendChart({
  data,
  valueLabel,
  height = 180,
  format = "compact",
  variant = "area",
  className,
  ariaLabel,
}: {
  data: TrendPoint[];
  /** Names the measure in the tooltip; the card title names the series. */
  valueLabel: string;
  height?: number;
  format?: ValueFormat;
  variant?: "area" | "line";
  className?: string;
  ariaLabel: string;
}) {
  const points = data.filter((point): point is { date: string; value: number } =>
    point.value !== null,
  );

  // A y-axis anchored at zero flattens a 3% follower change into a straight
  // line. These series are about *change*, so the domain hugs the data and the
  // axis labels say what the absolute level is.
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pad = (max - min) * 0.15 || Math.max(1, max * 0.05);

  const gradientId = React.useId().replace(/:/g, "");

  return (
    <figure
      className={cn("m-0", className)}
      role="img"
      aria-label={`${ariaLabel}. ${points.length} observations from ${points[0]?.date ?? "—"} to ${points[points.length - 1]?.date ?? "—"}.`}
    >
      <ResponsiveContainer width="100%" height={height}>
        {variant === "area" ? (
          <AreaChart data={points} margin={{ top: 6, right: 6, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-series-1)" stopOpacity={0.18} />
                <stop offset="100%" stopColor="var(--color-series-1)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="date" tickFormatter={formatAxisDate} minTickGap={32} {...axisProps} />
            <YAxis
              domain={[min - pad, max + pad]}
              tickFormatter={(value: number) => FORMATTERS[format](value)}
              width={48}
              {...axisProps}
            />
            <Tooltip
              cursor={{ stroke: "var(--color-line-strong)", strokeWidth: 1 }}
              content={<ChartTooltip valueLabel={valueLabel} format={format} />}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="var(--color-series-1)"
              strokeWidth={2}
              fill={`url(#${gradientId})`}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--color-surface)" }}
            />
          </AreaChart>
        ) : (
          <LineChart data={points} margin={{ top: 6, right: 6, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="date" tickFormatter={formatAxisDate} minTickGap={32} {...axisProps} />
            <YAxis
              domain={[min - pad, max + pad]}
              tickFormatter={(value: number) => FORMATTERS[format](value)}
              width={48}
              {...axisProps}
            />
            <Tooltip
              cursor={{ stroke: "var(--color-line-strong)", strokeWidth: 1 }}
              content={<ChartTooltip valueLabel={valueLabel} format={format} />}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="var(--color-series-1)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--color-surface)" }}
            />
          </LineChart>
        )}
      </ResponsiveContainer>
    </figure>
  );
}

export interface CategoryBar {
  label: string;
  value: number;
  /** Marks the bar as outside the creator's own expected range. */
  flagged?: boolean;
}

export function CategoryBars({
  data,
  valueLabel,
  height = 180,
  format = "compact",
  className,
  ariaLabel,
}: {
  data: CategoryBar[];
  valueLabel: string;
  height?: number;
  format?: ValueFormat;
  className?: string;
  ariaLabel: string;
}) {
  const render = FORMATTERS[format];
  return (
    <figure className={cn("m-0", className)} role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: 0 }} barCategoryGap="22%">
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="label" {...axisProps} />
          <YAxis tickFormatter={(value: number) => render(value)} width={48} {...axisProps} />
          <Tooltip
            cursor={{ fill: "var(--color-sunken)" }}
            content={<ChartTooltip valueLabel={valueLabel} format={format} />}
          />
          <Bar
            dataKey="value"
            radius={[4, 4, 0, 0]}
            fill="var(--color-series-1)"
            maxBarSize={44}
          />
        </BarChart>
      </ResponsiveContainer>
    </figure>
  );
}

/**
 * A sparkline for table cells and tiles. No axes, no tooltip — it shows shape,
 * and the number beside it carries the value.
 */
export function Sparkline({
  values,
  width = 72,
  height = 20,
  className,
}: {
  values: number[];
  width?: number;
  height?: number;
  className?: string;
}) {
  if (values.length < 2) {
    return <span className={cn("inline-block text-ink-subtle", className)}>—</span>;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = width / (values.length - 1);

  const path = values
    .map((value, index) => {
      const x = index * step;
      const y = height - ((value - min) / span) * (height - 2) - 1;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const rising = values[values.length - 1] >= values[0];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={cn("overflow-visible", className)}
      aria-hidden
    >
      <path
        d={path}
        fill="none"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={rising ? "stroke-positive" : "stroke-critical"}
      />
    </svg>
  );
}
