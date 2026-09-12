import * as React from "react";
import { cn } from "@/lib/class-names";

/* Depth is a 1px border and a tonal step, not a shadow. Shadows are reserved
   for things that genuinely float above the page.

   Card law, applied product-wide:
     · Rows tint on hover (hover:bg-sunken/70). Clickable cards lift
       (.lift). Static cards get no hover motion at all.
     · Tiles (StatTile, list-item cards) are rounded-lg; panels (Card and its
       structural siblings) are rounded-xl. */

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
        "min-w-0 rounded-xl border border-line bg-surface",
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
        "flex flex-wrap items-center justify-between gap-3 border-b border-rule px-4 py-2.5",
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
    <Tag className={cn("text-md font-semibold text-ink", className)} {...props} />
  );
}

export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-base text-ink-muted", className)} {...props} />;
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
        "flex flex-wrap items-center gap-3 border-t border-rule bg-sunken/50 px-4 py-2 text-sm text-ink-muted",
        className,
      )}
      {...props}
    />
  );
}

/** A small uppercase label used above groups and in sidebars. */
export function Eyebrow({
  className,
  as: Tag = "span",
  ...props
}: React.HTMLAttributes<HTMLElement> & { as?: React.ElementType }) {
  return <Tag className={cn("label-caps text-ink-muted", className)} {...props} />;
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
