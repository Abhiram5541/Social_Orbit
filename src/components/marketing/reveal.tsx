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
 * Built on IntersectionObserver rather than a motion library. The whole effect
 * is one CSS class plus this observer, and a scroll-animation dependency would
 * be the largest thing on a page whose argument is that the product is
 * measured rather than decorated. Scroll itself is left alone for the same
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
  const ref = React.useRef<HTMLElement>(null);

  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;

    // Anything already on screen at mount — the hero, above all — must not
    // wait for an intersection callback that has nothing to report.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.setAttribute("data-shown", "true");
            observer.unobserve(entry.target);
          }
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.05 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      data-shown="false"
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
