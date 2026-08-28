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
      className={cn("animate-pulse rounded bg-sunken-strong/70", className)}
      {...props}
    />
  );
}

/** Skeleton rows sized to a real table so the layout does not jump on load. */
export function TableSkeleton({ rows = 8, columns = 6 }: { rows?: number; columns?: number }) {
  return (
    <div role="status" aria-label="Loading results" className="divide-y divide-line">
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex items-center gap-4 px-4 py-3">
          {Array.from({ length: columns }, (_, c) => (
            <Skeleton
              key={c}
              className={cn("h-4", c === 0 ? "w-48" : "w-16", c === 0 && "shrink-0")}
            />
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
      className={cn("rounded-xl border border-line bg-surface p-4", className)}
    >
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-7 w-32" />
      <Skeleton className="mt-3 h-3 w-20" />
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-14 text-center",
        className,
      )}
    >
      {Icon && (
        <div className="grid size-10 place-items-center rounded-lg border border-line bg-sunken text-ink-subtle">
          <Icon className="size-5" aria-hidden />
        </div>
      )}
      <div className="max-w-sm space-y-1">
        <p className="text-[15px] font-semibold text-ink">{title}</p>
        {description && <p className="text-[13px] text-ink-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  description = "We could not load this. The problem has been logged.",
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
      <div className="grid size-10 place-items-center rounded-lg border border-critical-line bg-critical-soft text-critical">
        <AlertTriangle className="size-5" aria-hidden />
      </div>
      <div className="max-w-sm space-y-1">
        <p className="text-[15px] font-semibold text-ink">{title}</p>
        <p className="text-[13px] text-ink-muted">{description}</p>
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
        "flex flex-wrap items-start gap-3 rounded-lg border px-3 py-2.5 text-[13px]",
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
        "flex h-full min-h-32 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line bg-sunken/40 px-4 py-6 text-center",
        className,
      )}
    >
      <p className="text-[13px] font-medium text-ink">Growth history still building</p>
      <p className="max-w-xs text-[12px] text-ink-muted">
        {observed} of {required} snapshots collected. A trend is shown once there is enough
        history to read one honestly.
      </p>
      <div className="h-1 w-32 overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
