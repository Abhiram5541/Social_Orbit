"use client";

import * as React from "react";
import { cn } from "@/lib/class-names";

/* ---------------------------------------------------------------------------
 * The one reveal.
 *
 * A block rises 16px and fades in over 600ms, once, the first time it enters
 * the viewport. One recipe for every marketing band — a page where each
 * section arrives differently reads as a demo of transitions, not as a
 * considered surface.
 *
 * Time-based and once-only, driven by an IntersectionObserver. The previous
 * version was a scroll-scrubbed CSS animation (`animation-timeline: view()`),
 * which tied opacity and blur to the scrollbar: a slow scroll left every band
 * half-transparent, scrolling back re-hid it, and blurring a full-width table
 * on every frame was the single most expensive thing on the page. The hidden
 * state is applied only under `@media (scripting: enabled)`, so a crawler or
 * a browser without JavaScript sees the whole page — the reason D38 moved off
 * an observer in the first place.
 *
 * Instrument entrances inside a revealed block (the score arc, component bars)
 * stay paused until the block is in view, so they play as the reader arrives
 * rather than finishing unseen on mount.
 * ------------------------------------------------------------------------ */

export function Reveal({
  children,
  delay = 0,
  load = false,
  stagger = false,
  className,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  /** Milliseconds. Sequences siblings; keep the whole stagger under ~200ms. */
  delay?: number;
  /** Play once on load instead of on scroll — for anything above the fold.
   *  Pure CSS, so it starts on first paint rather than after hydration. */
  load?: boolean;
  /** Reveal the direct children one after another instead of the block. */
  stagger?: boolean;
  className?: string;
  as?: "div" | "p" | "section" | "ol" | "ul" | "dl";
}) {
  const ref = React.useRef<HTMLElement>(null);

  React.useEffect(() => {
    const node = ref.current;
    if (!node || load) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      node.classList.add("is-in");
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        // A block already scrolled past — the page opened on an anchor, or a
        // nav link jumped over it — is shown at once rather than left hidden
        // until the reader happens to scroll back up through it.
        if (!entries.some((entry) => entry.isIntersecting || entry.boundingClientRect.bottom < 0)) return;
        node.classList.add("is-in");
        observer.disconnect();
      },
      // Fire a little before the block's top reaches the bottom edge, so it is
      // already settling as it comes into view rather than arriving late.
      { rootMargin: "0px 0px -8% 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [load]);

  return React.createElement(
    Tag,
    {
      ref,
      className: cn(load ? "reveal-load" : stagger ? "reveal-stagger" : "reveal", className),
      style: delay ? ({ "--reveal-delay": `${delay}ms` } as React.CSSProperties) : undefined,
    },
    children,
  );
}
