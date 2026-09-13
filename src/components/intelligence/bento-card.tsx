import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/class-names";

/* ---------------------------------------------------------------------------
 * The bento card vocabulary shared by the dashboard and the creator dossier:
 * a heading row with an icon coin or a ↗, and a figure with its unit set light.
 * ------------------------------------------------------------------------ */

/** A card's heading row: title, subtitle, and either an icon coin or a ↗. */
export function CardHead({
  title,
  subtitle,
  href,
  icon: Icon,
  aside,
}: {
  title: string;
  subtitle?: React.ReactNode;
  href?: string;
  icon?: LucideIcon;
  aside?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 pb-4 pt-5">
      <div className="flex min-w-0 items-center gap-3">
        {Icon && (
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-sunken text-ink-muted">
            <Icon className="size-[1.125rem]" aria-hidden />
          </span>
        )}
        <div className="min-w-0">
          <h2 className="truncate text-md font-bold text-ink">{title}</h2>
          {subtitle && <p className="truncate text-xs text-ink-subtle">{subtitle}</p>}
        </div>
      </div>
      {aside ?? (href && <RoundLink href={href} label={`Open ${title.toLowerCase()}`} />)}
    </div>
  );
}

/** The reference's ↗ in a grey circle, top-right of a card. */
export function RoundLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="press grid size-9 shrink-0 place-items-center rounded-full bg-sunken text-ink-muted hover:bg-sunken-strong hover:text-ink"
    >
      <ArrowUpRight className="size-4" aria-hidden />
    </Link>
  );
}

/**
 * A figure with its unit set light — "$32,678" heavy, ".90" light. Splits on
 * the first non-numeric character.
 */
export function SplitFigure({ value, className }: { value: string; className?: string }) {
  const match = /^([\d.,]+)(.*)$/.exec(value);
  return (
    <p className={cn("font-num text-metric-lg font-bold leading-none tracking-tight text-ink", className)}>
      {match ? (
        <>
          {match[1]}
          <span className="font-semibold text-ink-subtle">{match[2]}</span>
        </>
      ) : (
        value
      )}
    </p>
  );
}
