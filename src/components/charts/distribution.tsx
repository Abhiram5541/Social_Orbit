"use client";

import * as React from "react";
import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { cn } from "@/lib/class-names";
import { formatCompact, formatPercent } from "@/lib/format";
import type { DistributionTone } from "./distribution-bars";

/* ---------------------------------------------------------------------------
 * Position charts.
 *
 * These answer a different question from a trend line: not "what happened over
 * time" but "where does this sit against everything else" — which is the
 * question a shortlist is actually built to answer.
 *
 * The labelled-bar components live in `distribution-bars.tsx`: they draw with
 * tokens alone, and keeping them here meant every importer shipped Recharts.
 * ------------------------------------------------------------------------ */

export interface PositionPoint {
  id: string;
  name: string;
  /** Audience size. Plotted on a log axis — creator sizes span four orders. */
  x: number;
  /** Engagement rate, percent. */
  y: number;
  tone: DistributionTone;
  /** Any third figure worth reading in the tooltip. */
  detail?: string;
}

const DOT_FILL: Record<DistributionTone, string> = {
  positive: "var(--color-positive)",
  brand: "var(--color-series-1)",
  caution: "var(--color-caution)",
  critical: "var(--color-critical)",
  neutral: "var(--color-neutral-metric)",
  inferred: "var(--color-inferred)",
};

/**
 * Audience size against engagement quality.
 *
 * The plot that makes a roster legible at a glance: reach on a log x-axis,
 * because creator sizes span four orders of magnitude and a linear axis
 * collapses everyone below a million into the origin. Colour carries the
 * health band, so an outlier is visible as an outlier before it is read.
 */
export function ReachQualityPlot({
  points,
  height = 260,
  ariaLabel,
  className,
}: {
  points: PositionPoint[];
  height?: number;
  ariaLabel: string;
  className?: string;
}) {
  const plottable = points.filter(
    (point) => Number.isFinite(point.x) && point.x > 0 && Number.isFinite(point.y),
  );

  if (plottable.length === 0) {
    return (
      <p className={cn("text-sm text-ink-subtle", className)}>
        No creator in this set has both an observed audience size and an observed
        engagement rate.
      </p>
    );
  }

  // Grouped by tone so each band is one series and gets one fill, which is
  // also what lets a legend mean something.
  const groups = Array.from(new Set(plottable.map((point) => point.tone)));

  return (
    <figure className={cn("m-0", className)} role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height={height}>
        <ScatterChart margin={{ top: 8, right: 12, bottom: 4, left: 0 }}>
          <CartesianGrid stroke="var(--color-grid)" vertical={false} />
          <XAxis
            type="number"
            dataKey="x"
            scale="log"
            domain={["auto", "auto"]}
            name="Audience"
            tickFormatter={(value: number) => formatCompact(value)}
            stroke="transparent"
            tick={{ fill: "var(--color-ink-subtle)", fontSize: 11, fontFamily: "var(--font-num)" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            type="number"
            dataKey="y"
            name="Engagement"
            tickFormatter={(value: number) => `${value.toFixed(1)}%`}
            width={44}
            stroke="transparent"
            tick={{ fill: "var(--color-ink-subtle)", fontSize: 11, fontFamily: "var(--font-num)" }}
            tickLine={false}
            axisLine={false}
          />
          <ZAxis range={[70, 70]} />
          <Tooltip
            cursor={{ stroke: "var(--color-line-strong)", strokeDasharray: "3 3" }}
            content={<PositionTooltip />}
          />
          {groups.map((tone) => (
            <Scatter
              key={tone}
              data={plottable.filter((point) => point.tone === tone)}
              fill={DOT_FILL[tone]}
              fillOpacity={0.85}
              isAnimationActive={false}
            />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
    </figure>
  );
}

function PositionTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: PositionPoint }[];
}) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div className="rounded-md bg-ink px-2.5 py-2 text-sm text-ink-inverse shadow-popover">
      <p className="font-medium">{point.name}</p>
      <p className="mt-0.5 font-num text-ink-inverse/75">
        {formatCompact(point.x)} followers
        <span aria-hidden> · </span>
        {formatPercent(point.y)} engagement
      </p>
      {point.detail && (
        <p className="mt-0.5 text-ink-inverse/60">{point.detail}</p>
      )}
    </div>
  );
}

/**
 * Two 0–100 scores against each other.
 *
 * The analytical view the product could not previously draw: quality on one
 * axis, how much of it was actually measured on the other. A cluster low and
 * left is a thin database; a cluster high and left is a database confidently
 * asserting things it has not observed, which is the failure mode this whole
 * product exists to prevent.
 */
export function CorrelationPlot({
  points,
  xLabel,
  yLabel,
  height = 300,
  ariaLabel,
  className,
}: {
  points: PositionPoint[];
  xLabel: string;
  yLabel: string;
  height?: number;
  ariaLabel: string;
  className?: string;
}) {
  if (points.length === 0) {
    return (
      <p className={cn("text-sm text-ink-subtle", className)}>
        Nothing scored yet.
      </p>
    );
  }

  const groups = Array.from(new Set(points.map((point) => point.tone)));

  return (
    <figure className={cn("m-0", className)} role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height={height}>
        <ScatterChart margin={{ top: 8, right: 16, bottom: 18, left: 0 }}>
          <CartesianGrid stroke="var(--color-grid)" />
          <XAxis
            type="number"
            dataKey="x"
            domain={[0, 100]}
            ticks={[0, 25, 50, 75, 100]}
            name={xLabel}
            label={{
              value: xLabel,
              position: "insideBottom",
              offset: -12,
              style: { fill: "var(--color-ink-subtle)", fontSize: 11, fontFamily: "var(--font-num)" },
            }}
            stroke="transparent"
            tick={{ fill: "var(--color-ink-subtle)", fontSize: 11, fontFamily: "var(--font-num)" }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            type="number"
            dataKey="y"
            domain={[0, 100]}
            ticks={[0, 25, 50, 75, 100]}
            name={yLabel}
            width={52}
            label={{
              value: yLabel,
              angle: -90,
              position: "insideLeft",
              style: {
                fill: "var(--color-ink-subtle)",
                fontSize: 11,
                textAnchor: "middle",
              },
            }}
            stroke="transparent"
            tick={{ fill: "var(--color-ink-subtle)", fontSize: 11, fontFamily: "var(--font-num)" }}
            tickLine={false}
            axisLine={false}
          />
          <ZAxis range={[26, 26]} />
          <Tooltip
            cursor={{ stroke: "var(--color-line-strong)", strokeDasharray: "3 3" }}
            content={<ScorePairTooltip xLabel={xLabel} yLabel={yLabel} />}
          />
          {groups.map((tone) => (
            <Scatter
              key={tone}
              data={points.filter((point) => point.tone === tone)}
              fill={DOT_FILL[tone]}
              fillOpacity={0.5}
              isAnimationActive={false}
            />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
    </figure>
  );
}

function ScorePairTooltip({
  active,
  payload,
  xLabel,
  yLabel,
}: {
  active?: boolean;
  payload?: { payload: PositionPoint }[];
  xLabel: string;
  yLabel: string;
}) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <div className="rounded-md bg-ink px-2.5 py-2 text-sm text-ink-inverse shadow-popover">
      <p className="font-medium">{point.name}</p>
      <p className="mt-0.5 font-num text-ink-inverse/75">
        {xLabel} {Math.round(point.x)}
        <span aria-hidden> · </span>
        {yLabel} {Math.round(point.y)}
      </p>
      {point.detail && <p className="mt-0.5 text-ink-inverse/60">{point.detail}</p>}
    </div>
  );
}
