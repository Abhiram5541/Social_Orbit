"use client";

import * as React from "react";
import { formatCompact } from "@/lib/format";

/**
 * A figure that counts up to its value once, when it first comes into view.
 *
 * The server renders the final string, so the number is correct without
 * JavaScript and for anything that reads the page; the count is only ever a
 * flourish on top. Every frame is formatted with the same compact formatter
 * as the final value — counting the digits of "2.4K" produced "0.6K" halfway,
 * which is not a number anyone has.
 */
export function CountUp({
  value,
  text,
  durationMs = 1100,
  className,
}: {
  value: number;
  text: string;
  durationMs?: number;
  className?: string;
}) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const [shown, setShown] = React.useState(text);

  React.useEffect(() => {
    const node = ref.current;
    if (!node || value <= 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        const started = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - started) / durationMs);
          const eased = 1 - Math.pow(1 - t, 3);
          setShown(t < 1 ? formatCompact(Math.round(value * eased)) : text);
          if (t < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.5 },
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value, text, durationMs]);

  return (
    <span ref={ref} className={className}>
      {shown}
    </span>
  );
}
