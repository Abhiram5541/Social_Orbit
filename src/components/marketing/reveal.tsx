"use client";

import * as React from "react";
import { cn } from "@/lib/class-names";

/* ---------------------------------------------------------------------------
 * The one reveal.
 *
 * A single entrance recipe used on every marketing band: a block rises a
 * little, unblurs and settles as it enters the viewport. The consistency is
 * the point — a page where each section arrives differently reads as a demo of
 * transitions, not as a considered surface.
 *
 * Built on the browser's scroll timeline (`animation-timeline: view()`)
 * rather than a motion library or an observer. The whole effect is one CSS
 * class, content is visible without JavaScript, and a scroll-animation
 * dependency would be the largest thing on a page whose argument is that the
 * product is measured rather than decorated. Scroll itself is left alone for the same
 * reason: hijacked scrolling on an enterprise page is a liability, not a
 * flourish — the browser's own scroll is already smooth and already accessible.
 *
 * `once` is implicit: an element that has arrived stays arrived. Re-animating
 * on the way back up is the tell of an effect applied for its own sake.
 * ------------------------------------------------------------------------ */

export function Reveal({
  children,
  delay = 0,
  className,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  /** Milliseconds. Sequences siblings; keep the whole stagger under ~200ms. */
  delay?: number;
  className?: string;
  as?: React.ElementType;
}) {
  // No observer any more: `.reveal` is a scroll-driven CSS animation (see
  // globals.css), so the content is visible by default and the browser does
  // the timing. This component only names the block and carries the stagger.
  return (
    <Tag
      className={cn("reveal", className)}
      style={delay ? ({ "--reveal-delay": `${delay}ms` } as React.CSSProperties) : undefined}
    >
      {children}
    </Tag>
  );
}

/**
 * A cursor-tracked wash for a dark panel.
 *
 * The `pointer-glow` utility draws a soft cobalt gradient wherever the pointer
 * is; this only feeds it coordinates. Touch never fires pointermove, so on a
 * phone the element is simply a dark panel — which is why the effect carries
 * no information and never will.
 */
export function PointerGlow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);

  return (
    <div
      ref={ref}
      onPointerMove={(event) => {
        const node = ref.current;
        if (!node || event.pointerType === "touch") return;
        const box = node.getBoundingClientRect();
        node.style.setProperty("--mx", `${((event.clientX - box.left) / box.width) * 100}%`);
        node.style.setProperty("--my", `${((event.clientY - box.top) / box.height) * 100}%`);
      }}
      className={cn("pointer-glow relative", className)}
    >
      {children}
    </div>
  );
}
