/* ---------------------------------------------------------------------------
 * Display formatting.
 *
 * Every number a user reads passes through here, so a null metric renders as an
 * em dash rather than "0" or "NaN" — a missing observation and a measured zero
 * are different claims and must never look alike.
 * ------------------------------------------------------------------------ */

/** Rendered wherever a value has not been observed. */
export const NO_VALUE = "—";

const compact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const exact = new Intl.NumberFormat("en-US");

/** 1_240_000 → "1.2M". Used in cards, tables and axis ticks. */
export function formatCompact(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return NO_VALUE;
  return compact.format(value);
}

/** 1_240_000 → "1,240,000". Used in tooltips and detail rows. */
export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return NO_VALUE;
  return exact.format(value);
}

/** 4.235 → "4.2%". `value` is already a percentage, not a ratio. */
export function formatPercent(
  value: number | null | undefined,
  fractionDigits = 1,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return NO_VALUE;
  return `${value.toFixed(fractionDigits)}%`;
}

/** A signed change: 12 → "+12%", -3.4 → "-3.4%". */
export function formatDelta(
  value: number | null | undefined,
  fractionDigits = 1,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return NO_VALUE;
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(fractionDigits)}%`;
}

export type Direction = "up" | "down" | "flat";

export function direction(value: number | null | undefined, deadband = 0.05): Direction {
  if (value === null || value === undefined || !Number.isFinite(value)) return "flat";
  if (value > deadband) return "up";
  if (value < -deadband) return "down";
  return "flat";
}

export function formatCurrency(
  value: number | null | undefined,
  currency = "INR",
  { compact: useCompact = false }: { compact?: boolean } = {},
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return NO_VALUE;
  return new Intl.NumberFormat(currency === "INR" ? "en-IN" : "en-US", {
    style: "currency",
    currency,
    notation: useCompact ? "compact" : "standard",
    maximumFractionDigits: useCompact ? 1 : 0,
  }).format(value);
}

export function formatCurrencyRange(
  low: number,
  high: number,
  currency = "INR",
): string {
  return `${formatCurrency(low, currency, { compact: true })} – ${formatCurrency(high, currency, { compact: true })}`;
}

/** 930 → "15m 30s"; 45 → "45s". */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return NO_VALUE;
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

/** 2.14 → "2.1/wk". */
export function formatFrequency(perWeek: number | null | undefined): string {
  if (perWeek === null || perWeek === undefined || !Number.isFinite(perWeek)) return NO_VALUE;
  return `${perWeek.toFixed(1)}/wk`;
}

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 60 * 60 * 1000],
  ["month", 30 * 24 * 60 * 60 * 1000],
  ["week", 7 * 24 * 60 * 60 * 1000],
  ["day", 24 * 60 * 60 * 1000],
  ["hour", 60 * 60 * 1000],
  ["minute", 60 * 1000],
];

const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/** "2 hours ago", "in 3 days". Freshness is shown everywhere in this product. */
export function formatRelativeTime(
  iso: string | null | undefined,
  now: Date = new Date(),
): string {
  if (!iso) return NO_VALUE;
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return NO_VALUE;
  const diff = then - now.getTime();
  const abs = Math.abs(diff);
  if (abs < 60_000) return "just now";
  for (const [unit, ms] of RELATIVE_UNITS) {
    if (abs >= ms) return relative.format(Math.round(diff / ms), unit);
  }
  return "just now";
}

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return NO_VALUE;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? NO_VALUE : dateFormatter.format(d);
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return NO_VALUE;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? NO_VALUE : dateTimeFormatter.format(d);
}

/** Short month + day for chart axes: "12 Mar". */
export function formatAxisDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(d);
}

/** Data older than this is treated as stale and flagged in the UI. */
export const STALE_AFTER_HOURS = 48;

export function isStale(iso: string | null | undefined, now: Date = new Date()): boolean {
  if (!iso) return true;
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return true;
  return now.getTime() - then > STALE_AFTER_HOURS * 60 * 60 * 1000;
}

/** "Aria Chen" → "AC". Avatar fallback. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** "n item" / "n items", with the count included. */
export function pluralise(count: number, singular: string, plural = `${singular}s`): string {
  return `${formatNumber(count)} ${count === 1 ? singular : plural}`;
}
