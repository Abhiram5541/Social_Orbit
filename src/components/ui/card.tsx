import * as React from "react";
import { cn } from "@/lib/class-names";

/* Depth is a 1px border and a tonal step, not a shadow. Shadows are reserved
   for things that genuinely float above the page. */

export function Card({
  className,
  as: Tag = "section",
  ...props
}: React.HTMLAttributes<HTMLElement> & { as?: React.ElementType }) {
  return (
    <Tag
      className={cn(
        // `min-w-0` matters: as a flex or grid child, a card defaults to
        // `min-width: auto` and its content can push it wider than its track,
        // which is how a dense table quietly widens the whole page. Wide
        // content is the scroll container's job, never the card's.
        "min-w-0 rounded-xl border border-line bg-surface shadow-raised",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3",
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({
  className,
  as: Tag = "h2",
  ...props
}: React.HTMLAttributes<HTMLHeadingElement> & { as?: React.ElementType }) {
  return (
    <Tag className={cn("text-[15px] font-semibold text-ink", className)} {...props} />
  );
}

export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-[13px] text-ink-muted", className)} {...props} />;
}

export function CardContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4", className)} {...props} />;
}

export function CardFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 border-t border-line bg-sunken/50 px-4 py-2.5 text-[13px] text-ink-muted",
        className,
      )}
      {...props}
    />
  );
}

/** A small uppercase label used above groups and in sidebars. */
export function Eyebrow({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "text-[11px] font-medium uppercase tracking-[0.06em] text-ink-muted",
        className,
      )}
      {...props}
    />
  );
}

/**
 * The AI surface. A distinct tonal ground is how a reader tells an
 * interpretation from a measurement at a glance — CLAUDE.md §7.
 */
export function AiPanel({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-lg border border-inferred-line bg-inferred-soft/60 p-4",
        className,
      )}
      {...props}
    />
  );
}
