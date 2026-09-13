import * as React from "react";
import { AlertTriangle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/class-names";
import { Button } from "./button";

/* ---------------------------------------------------------------------------
 * Loading, empty, error and partial-data states.
 *
 * CLAUDE.md §9: a blank screen is a bug. Every list, chart and panel in the
 * product resolves to one of these.
 * ------------------------------------------------------------------------ */

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden
      className={cn("animate-shimmer rounded bg-sunken-strong/70", className)}
      {...props}
    />
  );
}

/**
 * Skeleton rows sized to a real table so the layout does not jump on load.
 * `widths` mirrors the table's columns (Tailwind width classes, in column
 * order) and `numeric` right-aligns the bars where figures will land, so the
 * shimmer is a true preview of the grid rather than a generic strip.
 */
export function TableSkeleton({
  rows = 8,
  columns = 6,
  widths,
  numeric,
}: {
  rows?: number;
  columns?: number;
  /** One width class per column, e.g. ["w-48", "w-16", …]. Overrides `columns`. */
  widths?: string[];
  /** Column indexes whose bars right-align, matching numeric cells. */
  numeric?: number[];
}) {
  const cols = widths ?? Array.from({ length: columns }, (_, c) => (c === 0 ? "w-48" : "w-16"));
  return (
    <div role="status" aria-label="Loading results" className="divide-y divide-line">
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex items-center gap-4 px-2.5 py-2.5">
          {cols.map((width, c) => (
            <div
              key={c}
              className={cn(
                c === 0 ? "shrink-0" : "flex-1",
                numeric?.includes(c) && "flex justify-end",
              )}
            >
              <Skeleton className={cn("h-4", width)} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className={cn("rounded-xl bg-surface card-shadow p-4", className)}
    >
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-7 w-32" />
      <Skeleton className="mt-3 h-3 w-20" />
    </div>
  );
}

/**
 * An empty database is a stated feature of this product, so its empty states
 * follow BuildingHistory's model of designed absence: say what will exist,
 * preview its shape. The centered-stack `page` variant is for full-page
 * empties only; in-panel absences take `panel` — a dashed keyline with no
 * icon coin, optionally previewing ghost rows of the data to come.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  variant = "page",
  preview,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  variant?: "page" | "panel";
  /** Panel variant: render ghost rows shaped like the data that will appear. */
  preview?: boolean;
  className?: string;
}) {
  if (variant === "panel") {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong bg-sunken/50 px-4 py-10 text-center",
          className,
        )}
      >
        <p className="text-base font-medium text-ink">{title}</p>
        {description && <p className="max-w-sm text-sm text-ink-muted">{description}</p>}
        {preview && (
          <div aria-hidden className="mt-2 w-full max-w-xs space-y-2 opacity-60">
            <div className="h-3 rounded bg-sunken-strong/60" />
            <div className="h-3 w-4/5 rounded bg-sunken-strong/50" />
            <div className="h-3 w-3/5 rounded bg-sunken-strong/40" />
          </div>
        )}
        {action}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-14 text-center",
        className,
      )}
    >
      {Icon && (
        <div className="grid size-11 place-items-center rounded-xl bg-surface card-shadow text-ink-subtle">
          <Icon className="size-5" aria-hidden />
        </div>
      )}
      <div className="max-w-sm space-y-1">
        <p className="text-md font-semibold text-ink">{title}</p>
        {description && <p className="text-base text-ink-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/**
 * Callers should say what failed and what to do about it — "Score history
 * could not be fetched — retry or check the connector status page" — rather
 * than lean on the defaults. No claim is made about logging: nothing here can
 * verify one happened.
 */
export function ErrorState({
  title = "This panel failed to load",
  description = "The request did not complete. Retry, or come back shortly.",
  onRetry,
  className,
}: {
  title?: string;
  description?: React.ReactNode;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-14 text-center",
        className,
      )}
    >
      <div className="grid size-11 place-items-center rounded-xl border border-critical-line bg-critical-soft text-critical">
        <AlertTriangle className="size-5" aria-hidden />
      </div>
      <div className="max-w-sm space-y-1">
        <p className="text-md font-semibold text-ink">{title}</p>
        <p className="text-base text-ink-muted">{description}</p>
      </div>
      {onRetry && (
        <Button size="sm" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export type NoticeTone = "info" | "caution" | "critical" | "positive";

const NOTICE_TONES: Record<NoticeTone, string> = {
  info: "border-brand-line bg-brand-softer text-ink",
  caution: "border-caution-line bg-caution-soft text-ink",
  critical: "border-critical-line bg-critical-soft text-ink",
  positive: "border-positive-line bg-positive-soft text-ink",
};

const NOTICE_ICON_TONES: Record<NoticeTone, string> = {
  info: "text-brand",
  caution: "text-caution",
  critical: "text-critical",
  positive: "text-positive",
};

/** An inline message attached to content — quota warnings, stale data, conflicts. */
export function Notice({
  tone = "info",
  icon: Icon = AlertTriangle,
  title,
  children,
  action,
  className,
}: {
  tone?: NoticeTone;
  icon?: LucideIcon;
  title?: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === "critical" ? "alert" : "status"}
      className={cn(
        "flex flex-wrap items-start gap-3 rounded-lg border px-3.5 py-3 text-base",
        NOTICE_TONES[tone],
        className,
      )}
    >
      <Icon className={cn("mt-0.5 size-4 shrink-0", NOTICE_ICON_TONES[tone])} aria-hidden />
      <div className="min-w-0 flex-1 space-y-0.5">
        {title && <p className="font-medium text-ink">{title}</p>}
        {children && <div className="text-ink-muted">{children}</div>}
      </div>
      {action}
    </div>
  );
}

/**
 * The "history still building" state — DPR §10.2 makes this formal behaviour
 * rather than a placeholder string. It states what exists and what is needed.
 */
export function BuildingHistory({
  observed,
  required,
  className,
}: {
  observed: number;
  required: number;
  className?: string;
}) {
  const pct = required > 0 ? Math.min(100, Math.round((observed / required) * 100)) : 0;
  return (
    <div
      className={cn(
        "flex h-full min-h-32 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong bg-sunken/50 px-4 py-6 text-center",
        className,
      )}
    >
      <p className="text-base font-medium text-ink">Growth history still building</p>
      <p className="max-w-xs text-sm text-ink-muted">
        <span className="font-num">{observed}</span> of{" "}
        <span className="font-num">{required}</span> snapshots collected. A trend is shown once
        there is enough history to read one honestly.
      </p>
      <div className="h-1 w-32 overflow-hidden rounded-full bg-line">
        <div className="animate-extend h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
