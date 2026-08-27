"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/cn";

/* ---------------------------------------------------------------------------
 * High-density data table.
 *
 * A real <table> — semantics matter for screen readers and for column
 * alignment. The wrapper is the horizontal scroll container so the page body
 * never scrolls sideways on narrow viewports.
 * ------------------------------------------------------------------------ */

export function TableWrap({
  className,
  children,
  label,
}: {
  className?: string;
  children: React.ReactNode;
  /** Announced to screen readers; also used as the accessible name. */
  label: string;
}) {
  return (
    <div
      className={cn("scroll-x", className)}
      role="region"
      aria-label={label}
      tabIndex={0}
    >
      {children}
    </div>
  );
}

export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <table
      className={cn("w-full min-w-max border-collapse text-[13px]", className)}
      {...props}
    />
  );
}

export function Thead({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn("border-b border-line bg-sunken/60 text-ink-muted", className)}
      {...props}
    />
  );
}

export function Tbody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("divide-y divide-line", className)} {...props} />;
}

export function Tr({
  className,
  interactive,
  selected,
  ...props
}: React.HTMLAttributes<HTMLTableRowElement> & {
  interactive?: boolean;
  selected?: boolean;
}) {
  return (
    <tr
      aria-selected={selected || undefined}
      className={cn(
        "transition-colors",
        interactive && "cursor-pointer hover:bg-brand-softer",
        selected && "bg-brand-soft",
        className,
      )}
      {...props}
    />
  );
}

export function Th({
  className,
  numeric,
  ...props
}: React.ThHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <th
      scope="col"
      className={cn(
        "whitespace-nowrap px-2.5 py-2 text-left align-middle",
        "text-[11px] font-medium uppercase tracking-[0.05em]",
        numeric && "text-right",
        className,
      )}
      {...props}
    />
  );
}

export function Td({
  className,
  numeric,
  ...props
}: React.TdHTMLAttributes<HTMLTableCellElement> & { numeric?: boolean }) {
  return (
    <td
      className={cn(
        "px-2.5 py-2 align-middle text-ink",
        numeric && "text-right font-num tabular-nums",
        className,
      )}
      {...props}
    />
  );
}

export type SortDir = "asc" | "desc";

/**
 * A sortable header. `aria-sort` on the cell is what assistive tech reads;
 * the icon is decoration on top of it.
 */
export function SortableTh({
  label,
  active,
  direction = "desc",
  onSort,
  numeric,
  className,
}: {
  label: string;
  active: boolean;
  direction?: SortDir;
  onSort: () => void;
  numeric?: boolean;
  className?: string;
}) {
  const Icon = !active ? ChevronsUpDown : direction === "asc" ? ArrowUp : ArrowDown;
  return (
    <Th
      numeric={numeric}
      className={cn("p-0", className)}
      aria-sort={active ? (direction === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={onSort}
        className={cn(
          "flex w-full items-center gap-1 px-2.5 py-2 text-[11px] font-medium uppercase tracking-[0.05em]",
          "transition-colors hover:text-ink",
          numeric && "justify-end",
          active && "text-ink",
        )}
      >
        {label}
        <Icon className={cn("size-3", active ? "text-brand" : "text-ink-subtle")} aria-hidden />
      </button>
    </Th>
  );
}

/** Page-based pagination. Cursor pagination is used for the public API only. */
export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  className,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  className?: string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <nav
      aria-label="Pagination"
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-t border-line px-4 py-2.5",
        className,
      )}
    >
      <p className="text-[12px] text-ink-muted">
        <span className="font-num tabular-nums text-ink">{from.toLocaleString()}</span>–
        <span className="font-num tabular-nums text-ink">{to.toLocaleString()}</span> of{" "}
        <span className="font-num tabular-nums text-ink">{total.toLocaleString()}</span>
      </p>
      <div className="flex items-center gap-1">
        <PageButton onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
          Previous
        </PageButton>
        <span className="px-2 text-[12px] text-ink-muted">
          Page <span className="font-num tabular-nums text-ink">{page}</span> of{" "}
          <span className="font-num tabular-nums text-ink">{totalPages}</span>
        </span>
        <PageButton onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}>
          Next
        </PageButton>
      </div>
    </nav>
  );
}

function PageButton({
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        "h-7 rounded-md border border-line bg-surface px-2.5 text-[12px] font-medium text-ink",
        "transition-colors hover:bg-sunken",
        "disabled:cursor-not-allowed disabled:text-ink-subtle disabled:hover:bg-surface",
      )}
      {...props}
    >
      {children}
    </button>
  );
}
