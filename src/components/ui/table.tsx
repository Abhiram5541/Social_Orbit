"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/class-names";

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
      className={cn("w-full min-w-max border-collapse text-base", className)}
      {...props}
    />
  );
}

export function Thead({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead
      className={cn("border-b border-line bg-transparent text-ink-subtle", className)}
      {...props}
    />
  );
}

export function Tbody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("divide-y divide-rule", className)} {...props} />;
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
        interactive && "cursor-pointer hover:bg-sunken/70",
        selected && "bg-brand-softer",
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
        "label-caps whitespace-nowrap px-3 py-2.5 text-left align-middle",
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
        "px-3 py-2.5 align-middle text-ink",
        numeric && "text-right font-num",
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
          "label-caps flex w-full items-center gap-1 px-2.5 py-2",
          "press hover:text-ink",
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
        "flex flex-wrap items-center justify-between gap-3 border-t border-rule px-4 py-2.5",
        className,
      )}
    >
      <p className="text-sm text-ink-muted">
        <span className="font-num text-ink">{from.toLocaleString()}</span>–
        <span className="font-num text-ink">{to.toLocaleString()}</span> of{" "}
        <span className="font-num text-ink">{total.toLocaleString()}</span>
      </p>
      {/* The range statement above is the single source; the page count lives
          in the buttons' accessible names rather than being printed twice. */}
      <div className="flex items-center gap-1">
        <PageButton
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label={`Previous page, ${page - 1} of ${totalPages}`}
        >
          Previous
        </PageButton>
        <PageButton
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label={`Next page, ${page + 1} of ${totalPages}`}
        >
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
        "h-7 rounded-md border border-line bg-surface px-2.5 text-sm font-medium text-ink",
        "press hover:bg-sunken",
        "disabled:cursor-not-allowed disabled:text-ink-subtle disabled:hover:bg-surface",
      )}
      {...props}
    >
      {children}
    </button>
  );
}
