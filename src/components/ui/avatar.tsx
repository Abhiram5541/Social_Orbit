import * as React from "react";
import { BadgeCheck } from "lucide-react";
import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";
import type { VerificationStatus } from "@/lib/contracts/common";

const SIZES = {
  xs: "size-6 text-[10px]",
  sm: "size-8 text-[11px]",
  md: "size-10 text-[13px]",
  lg: "size-14 text-[16px]",
  xl: "size-20 text-[22px]",
} as const;

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
  /** Renders the SocialOrbit Verified mark — only ever for `verified`. */
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
          className={cn(
            "rounded-full border border-line bg-sunken object-cover",
            SIZES[size],
          )}
        />
      ) : (
        <span
          aria-hidden
          className={cn(
            "grid place-items-center rounded-full border border-line bg-sunken font-medium text-ink-muted",
            SIZES[size],
          )}
        >
          {initials(name)}
        </span>
      )}
      {verification === "verified" && (
        <span
          className="absolute -bottom-0.5 -right-0.5 grid place-items-center rounded-full bg-surface"
          title="SocialOrbit Verified"
        >
          <BadgeCheck className="size-4 text-verified" aria-label="SocialOrbit Verified" />
        </span>
      )}
    </div>
  );
}
