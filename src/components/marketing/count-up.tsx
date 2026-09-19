"use client";

import * as React from "react";

/**
 * A figure that counts up to its value once, when it first comes into view.
 *
 * The server renders the final string, so the number is correct without
 * JavaScript and for anything that reads the page; the count is only ever a
 * flourish on top. Formatting is done by the caller (`formatCompact`), which
 * is why this takes the finished text and a numeric value separately — it
 * animates the digits and keeps the suffix.
 */
export function CountUp({
  value,
  text,
  durationMs = 900,
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

    const match = text.match(/^([\d.,]+)(.*)$/);
    if (!match) return;
    const [, digits, suffix] = match;
    const decimals = (digits.split(".")[1] ?? "").length;
    const target = Number(digits.replace(/,/g, ""));
    if (!Number.isFinite(target)) return;

    let frame = 0;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        const started = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - started) / durationMs);
          const eased = 1 - Math.pow(1 - t, 3);
          const current = target * eased;
          setShown(
            current.toLocaleString("en-US", {
              minimumFractionDigits: decimals,
              maximumFractionDigits: decimals,
            }) + suffix,
          );
          if (t < 1) frame = requestAnimationFrame(tick);
          else setShown(text);
        };
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
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
