import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  CircleAlert,
  Info,
  Minus,
  OctagonAlert,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/class-names";
import { RowList } from "@/components/ui/panel";

/* ---------------------------------------------------------------------------
 * The intelligence feed.
 *
 * The difference between a dashboard and an intelligence product is whether
 * the screen tells you what happened or leaves you to derive it from tiles.
 * An Insight is a sentence with a number in it, evidence under it and a way
 * to act on it — which is the shape a finding actually has.
 *
 * A feed row is never decorative. Every one of these must be generated from
 * a measured change; there is no "welcome to SocialOrbit" row.
 * ------------------------------------------------------------------------ */

export type InsightKind = "positive" | "caution" | "critical" | "neutral" | "brand";

/*
 * A distinct icon per kind, not one shape recoloured. Colour alone cannot
 * carry severity — it fails for a colour-blind reader and it fails again on a
 * printed report — and a triangle pointing up read as "improvement" on rows
 * that were warnings.
 */
const GLYPH: Record<InsightKind, { icon: LucideIcon; className: string; label: string }> = {
  positive: { icon: TrendingUp, className: "text-positive", label: "Improvement" },
  caution: { icon: CircleAlert, className: "text-caution", label: "Needs attention" },
  critical: { icon: OctagonAlert, className: "text-critical", label: "Risk" },
  neutral: { icon: Minus, className: "text-ink-subtle", label: "Change" },
  brand: { icon: Info, className: "text-brand", label: "Signal" },
};

export function InsightFeed({
  className,
  ...props
}: React.HTMLAttributes<HTMLUListElement>) {
  return <RowList className={cn("min-w-0", className)} {...props} />;
}

export function Insight({
  kind = "neutral",
  headline,
  evidence,
  meta,
  href,
  actionLabel,
  className,
}: {
  kind?: InsightKind;
  /** The finding, with its figure inline. Wrap numerals in `font-num`. */
  headline: React.ReactNode;
  /** What supports it — the comparison, the cohort, the window. */
  evidence?: React.ReactNode;
  /** Confidence, timestamp or source. Right-aligned, recessive. */
  meta?: React.ReactNode;
  href?: string;
  actionLabel?: string;
  className?: string;
}) {
  const glyph = GLYPH[kind];
  const Icon = glyph.icon;

  const body = (
    <>
      <Icon
        aria-hidden
        className={cn("mt-0.5 size-3.5 shrink-0", glyph.className)}
      />
      <span className="min-w-0 flex-1">
        <span className="block text-base font-medium text-ink">
          <span className="sr-only">{glyph.label}: </span>
          {headline}
        </span>
        {evidence && (
          <span className="mt-0.5 block text-sm text-ink-muted">{evidence}</span>
        )}
      </span>
      {meta && (
        <span className="hidden shrink-0 self-center text-sm text-ink-subtle sm:block">
          {meta}
        </span>
      )}
      {href && (
        <span className="flex shrink-0 items-center gap-1 self-center text-sm font-medium text-brand-ink">
          {actionLabel && <span className="hidden md:inline">{actionLabel}</span>}
          <ArrowRight
            className="size-3.5 transition-transform group-hover:translate-x-0.5"
            aria-hidden
          />
        </span>
      )}
    </>
  );

  return (
    <li className={cn("min-w-0", className)}>
      {href ? (
        <Link
          href={href}
          className="group flex gap-3 px-4 py-3 transition-colors hover:bg-sunken/70"
        >
          {body}
        </Link>
      ) : (
        <div className="flex gap-3 px-4 py-3">{body}</div>
      )}
    </li>
  );
}

/**
 * The link that closes a feed or queue: "everything else lives here".
 * Its own row rather than a header action, so the reader reaches it after the
 * findings rather than instead of them.
 */
export function FeedFooterLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between gap-2 border-t border-rule px-4 py-2.5 text-sm font-medium text-brand-ink transition-colors hover:bg-sunken/70"
    >
      {children}
      <ArrowUpRight className="size-3.5" aria-hidden />
    </Link>
  );
}
