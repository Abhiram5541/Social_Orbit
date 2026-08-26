import { cn } from "@/lib/cn";

/**
 * The mark is an orbit: a body, its path, and a satellite on that path —
 * creators moving around a brand. Drawn rather than imported so it inherits
 * colour and stays crisp at rail size.
 */
export function OrbitMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" className={cn("size-7", className)} aria-hidden>
      <rect width="28" height="28" rx="7" className="fill-brand" />
      <ellipse
        cx="14"
        cy="14"
        rx="9"
        ry="4.6"
        transform="rotate(-30 14 14)"
        fill="none"
        stroke="white"
        strokeOpacity="0.55"
        strokeWidth="1.5"
      />
      <circle cx="14" cy="14" r="3.4" fill="white" />
      <circle cx="21.2" cy="9.4" r="2" fill="white" />
    </svg>
  );
}

export function Wordmark({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <OrbitMark />
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="text-[15px] font-semibold tracking-[-0.01em] text-ink">
            SocialOrbit
          </span>
          <span className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-ink-subtle">
            Influencer Intelligence
          </span>
        </span>
      )}
    </span>
  );
}
