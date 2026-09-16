import * as React from "react";
import { BadgeCheck } from "lucide-react";
import { cn } from "@/lib/class-names";
import { initials } from "@/lib/format";
import type { VerificationStatus } from "@/lib/contracts/common";

const SIZES = {
  xs: "size-6 text-2xs",
  sm: "size-8 text-xs",
  md: "size-10 text-base",
  lg: "size-14 text-md",
  xl: "size-20 text-stat-lg",
  "2xl": "size-24 text-title",
} as const;

/*
 * Initials fallbacks take a quiet tint derived from the name, so a screen of
 * imageless creators reads as a set of distinct people rather than a column
 * of identical grey coins. Tints carry no status meaning: the dedicated
 * decorative tokens plus brand and inferred — never the amber or green the
 * system reserves for measured caution and growth, one cell from genuine
 * badges in the same row.
 */
const TINTS = [
  "bg-sunken text-ink-muted",
  "bg-brand-soft text-brand-ink",
  "bg-inferred-soft text-inferred",
  "bg-tint-slate-soft text-tint-slate",
  "bg-tint-teal-soft text-tint-teal",
] as const;

const MARK_SIZES: Record<keyof typeof SIZES, string> = {
  xs: "size-3",
  sm: "size-3.5",
  md: "size-4",
  lg: "size-5",
  xl: "size-6",
  "2xl": "size-7",
};

function tintOf(name: string): string {
  let hash = 0;
  for (const character of name) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return TINTS[hash % TINTS.length];
}

export function Avatar({
  name,
  src,
  size = "md",
  verification,
  className,
}: {
  name: string;
  src?: string | null;
  size?: keyof typeof SIZES;
  /** Renders the SENSO Verified mark — only ever for `verified`. */
  verification?: VerificationStatus;
  className?: string;
}) {
  return (
    <div className={cn("relative shrink-0", className)}>
      {src ? (
        // Remote creator avatars come from arbitrary CDNs; a plain img avoids
        // routing every one of them through the optimiser.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          // Google's avatar CDN refuses hotlinked requests that carry a
          // referrer, and the browser reports it as ERR_BLOCKED_BY_ORB rather
          // than a 403 — so every creator avatar rendered as a broken image.
          referrerPolicy="no-referrer"
          className={cn(
            "rounded-full bg-sunken object-cover ring-2 ring-surface",
            SIZES[size],
          )}
        />
      ) : (
        <span
          aria-hidden
          // Joined rather than cn(): tailwind-merge reads the non-t-shirt size
          // classes (text-stat-lg) as colours and would drop the tint.
          className={`grid place-items-center rounded-full font-display font-bold ${tintOf(name)} ${SIZES[size]}`}
        >
          {initials(name)}
        </span>
      )}
      {verification === "verified" && (
        <span
          className="absolute -bottom-0.5 -right-0.5 grid place-items-center rounded-full bg-surface"
          title="SENSO Verified"
        >
          {/* Scales with the avatar: a fixed 16px mark covered a third of the
              small size and shrank to a speck on the profile header. */}
          <BadgeCheck
            className={cn("text-verified", MARK_SIZES[size])}
            aria-label="SENSO Verified"
          />
        </span>
      )}
    </div>
  );
}
