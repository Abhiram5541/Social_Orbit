import * as React from "react";
import { cn } from "@/lib/class-names";

/**
 * The SENSO mark: an S folded from one ribbon — two hooked bands and the two
 * diagonal legs that join them, each piece its own gradient, on a deep
 * violet tile. Drawn as SVG so it stays crisp from the favicon to the hero;
 * `public/brand/senso-mark.png` is the original raster for print and social.
 *
 * Gradient ids are made unique per instance: two marks on one page sharing
 * an id would paint both with whichever gradient the browser found first.
 */
export function SensoMark({
  className,
  tile = true,
}: {
  className?: string;
  /** Draw the violet rounded tile behind the ribbon. Off for dark surfaces. */
  tile?: boolean;
}) {
  const id = React.useId();
  const g = (name: string) => `${name}${id}`;

  return (
    <svg viewBox="0 0 1250 1250" className={cn("size-7", className)} aria-hidden>
      <defs>
        <linearGradient id={g("top")} x1="330" y1="330" x2="920" y2="330" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ffa41c" />
          <stop offset="1" stopColor="#ff2d6a" />
        </linearGradient>
        <linearGradient id={g("bottom")} x1="920" y1="920" x2="330" y2="920" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#1fd6ff" />
          <stop offset="1" stopColor="#5a26ff" />
        </linearGradient>
        <linearGradient id={g("legA")} x1="430" y1="460" x2="640" y2="660" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#5a1fe0" />
          <stop offset="1" stopColor="#bf4cf0" />
        </linearGradient>
        <linearGradient id={g("legB")} x1="820" y1="790" x2="610" y2="590" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ff1f66" />
          <stop offset="1" stopColor="#ff6f7e" />
        </linearGradient>
      </defs>
      {tile && <rect x="105" y="105" width="1040" height="1040" rx="185" fill="#1a0a2e" />}
      {/* The legs first, stroked in the tile colour so a hairline of dark
          separates every fold; the bands then sit over the outer half. */}
      <g stroke={tile ? "#1a0a2e" : "transparent"} strokeWidth="26" strokeLinejoin="miter">
        <path fill={`url(#${g("legA")})`} d="M 564 432 L 672 576 L 591 684 L 412 446 Z" />
        <path fill={`url(#${g("legB")})`} d="M 686 818 L 578 674 L 659 566 L 838 804 Z" />
      </g>
      <path
        fill={`url(#${g("top")})`}
        d="M 505 270 H 920 L 822 400 H 580 Q 540 400 564 432 L 412 446 C 334 342 315 270 505 270 Z"
      />
      <path
        fill={`url(#${g("bottom")})`}
        d="M 745 980 L 330 980 L 428 850 L 670 850 Q 710 850 686 818 L 838 804 C 916 908 935 980 745 980 Z"
      />
    </svg>
  );
}

export function Wordmark({
  compact = false,
  inverse = false,
  className,
}: {
  compact?: boolean;
  /** For the instrument housing and other dark surfaces. */
  inverse?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <SensoMark />
      {!compact && (
        <span className="flex flex-col leading-none">
          <span
            className={cn(
              "font-display text-md font-extrabold tracking-wide",
              inverse ? "text-instrument-ink" : "text-ink",
            )}
          >
            SENSO
          </span>
          <span
            className={cn(
              "label-caps-sm mt-0.5",
              inverse ? "text-instrument-muted" : "text-ink-subtle",
            )}
          >
            Influencer Intelligence
          </span>
        </span>
      )}
    </span>
  );
}
