"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/class-names";

/* ---------------------------------------------------------------------------
 * Tooltip
 *
 * Hover AND focus, because a tooltip only reachable with a mouse does not
 * exist for keyboard users. The content is also wired through
 * `aria-describedby` so it is announced rather than merely drawn.
 * ------------------------------------------------------------------------ */

export function Tooltip({
  content,
  side = "top",
  children,
  className,
}: {
  content: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  children: React.ReactElement<{ "aria-describedby"?: string }>;
  className?: string;
}) {
  const id = React.useId();
  const anchor = React.useRef<HTMLSpanElement>(null);
  const [rect, setRect] = React.useState<DOMRect | null>(null);
  const timer = React.useRef<number | undefined>(undefined);

  React.useEffect(() => () => window.clearTimeout(timer.current), []);

  // Hover waits ~250ms so the tip does not pop on every incidental pointer
  // pass; focus opens immediately — keyboard users asked for it deliberately.
  function show() {
    setRect(anchor.current?.getBoundingClientRect() ?? null);
  }
  function openAfterDelay() {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(show, 250);
  }
  function close() {
    window.clearTimeout(timer.current);
    setRect(null);
  }

  // Closed on scroll rather than repositioned: the anchor moves, the tip
  // would lag, and a hover tip has no business surviving a scroll anyway.
  React.useEffect(() => {
    if (!rect) return;
    window.addEventListener("scroll", close, true);
    return () => window.removeEventListener("scroll", close, true);
  }, [rect]);

  const open = rect !== null;
  const gap = 6;
  // Fixed coordinates from the anchor's viewport rect, rendered in a portal
  // so no scrolling or clipping ancestor (the navigation rail, a table
  // viewport) can cut the tip off.
  const style: React.CSSProperties | undefined = rect
    ? {
        top: {
          top: rect.top - gap,
          bottom: rect.bottom + gap,
          left: rect.top + rect.height / 2,
          right: rect.top + rect.height / 2,
        }[side],
        left: {
          top: rect.left + rect.width / 2,
          bottom: rect.left + rect.width / 2,
          left: rect.left - gap,
          right: rect.right + gap,
        }[side],
      }
    : undefined;
  const translate = {
    top: "-translate-x-1/2 -translate-y-full",
    bottom: "-translate-x-1/2",
    left: "-translate-x-full -translate-y-1/2",
    right: "-translate-y-1/2",
  }[side];

  return (
    <span
      ref={anchor}
      className={cn("relative inline-flex", className)}
      onPointerEnter={openAfterDelay}
      onPointerLeave={close}
      onFocusCapture={() => {
        window.clearTimeout(timer.current);
        show();
      }}
      onBlurCapture={close}
    >
      {React.cloneElement(children, { "aria-describedby": open ? id : undefined })}
      {open &&
        createPortal(
          <span
            role="tooltip"
            id={id}
            style={style}
            className={cn(
              "pointer-events-none fixed z-50 w-max max-w-64 rounded-md bg-ink px-2 py-1.5",
              "text-sm text-ink-inverse shadow-popover",
              // Arrives rather than pops — opacity only, the transform is
              // spent on positioning.
              "opacity-100 transition-opacity duration-(--duration-fast) ease-(--ease-out-quick) starting:opacity-0",
              translate,
            )}
          >
            {content}
          </span>,
          document.body,
        )}
    </span>
  );
}

/** An info affordance next to a metric label. Keyboard reachable by design. */
export function InfoHint({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <Tooltip content={children}>
      <button
        type="button"
        aria-label={label}
        className="grid size-4 place-items-center rounded-full text-ink-subtle transition-colors hover:text-ink-muted"
      >
        <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden>
          <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1.3" fill="none" />
          <path d="M8 7.2v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="8" cy="4.9" r="0.85" fill="currentColor" />
        </svg>
      </button>
    </Tooltip>
  );
}

/* ---------------------------------------------------------------------------
 * Menu
 *
 * Uses the platform popover so it renders in the top layer, closes on Escape
 * and on outside click without a global listener, and is never clipped by an
 * ancestor's overflow.
 * ------------------------------------------------------------------------ */

export function Menu({
  trigger,
  children,
  align = "end",
  side = "bottom",
  className,
}: {
  trigger: (props: { popoverTarget: string; "aria-haspopup": "menu" }) => React.ReactNode;
  children: React.ReactNode;
  align?: "start" | "end";
  /** `top` opens upward — for a trigger that sits at the foot of the rail. */
  side?: "bottom" | "top";
  className?: string;
}) {
  const rawId = React.useId();
  const id = `menu${rawId.replace(/:/g, "")}`;
  const ref = React.useRef<HTMLDivElement>(null);

  // The popover lives in the top layer, so it must be positioned against the
  // trigger's viewport box rather than an offset parent.
  const place = React.useCallback(() => {
    const panel = ref.current;
    if (!panel) return;
    const trigger = document.querySelector<HTMLElement>(`[popovertarget="${id}"]`);
    if (!trigger) return;
    const box = trigger.getBoundingClientRect();
    const width = panel.offsetWidth;
    const left = align === "end" ? box.right - width : box.left;
    const top = side === "top" ? box.top - panel.offsetHeight - 4 : box.bottom + 4;
    panel.style.top = `${Math.round(Math.max(8, top))}px`;
    panel.style.left = `${Math.round(Math.max(8, Math.min(left, window.innerWidth - width - 8)))}px`;
  }, [align, id, side]);

  // The panel is positioned against a viewport box that scrolling invalidates;
  // closing on the first scroll is honest — a menu is a momentary choice.
  React.useEffect(() => {
    const onScroll = () => {
      const panel = ref.current;
      if (panel?.matches(":popover-open")) panel.hidePopover();
    };
    window.addEventListener("scroll", onScroll, { capture: true });
    return () => window.removeEventListener("scroll", onScroll, { capture: true });
  }, []);

  // role="menu" promises the ARIA keyboard model, so the panel delivers it:
  // roving focus among menuitems, same pattern as tabs.
  function onKeyDown(event: React.KeyboardEvent) {
    const panel = ref.current;
    if (!panel) return;
    const items = Array.from(
      panel.querySelectorAll<HTMLElement>('[role="menuitem"]:not(:disabled)'),
    );
    if (items.length === 0) return;
    const index = items.indexOf(document.activeElement as HTMLElement);
    let next: number;
    if (event.key === "ArrowDown") next = (index + 1) % items.length;
    else if (event.key === "ArrowUp") next = (index - 1 + items.length) % items.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = items.length - 1;
    else return;
    event.preventDefault();
    items[next].focus();
  }

  return (
    <>
      {trigger({ popoverTarget: id, "aria-haspopup": "menu" })}
      <div
        ref={ref}
        id={id}
        popover="auto"
        role="menu"
        onKeyDown={onKeyDown}
        onToggle={(event) => {
          if ((event as unknown as { newState: string }).newState === "open") {
            place();
            ref.current
              ?.querySelector<HTMLElement>('[role="menuitem"]:not(:disabled)')
              ?.focus();
          }
        }}
        className={cn(
          "fixed m-0 min-w-48 rounded-lg bg-surface p-1 shadow-popover",
          "[&:not(:popover-open)]:hidden",
          // Same entrance the dialog gets, tuned smaller: menus should arrive,
          // not pop. @starting-style animates from the pre-open frame.
          "opacity-0 translate-y-1 transition-[opacity,translate] duration-(--duration-fast) ease-(--ease-out-quick)",
          "[&:popover-open]:opacity-100 [&:popover-open]:translate-y-0",
          "starting:[&:popover-open]:opacity-0 starting:[&:popover-open]:translate-y-1",
          className,
        )}
      >
        {children}
      </div>
    </>
  );
}

export function MenuItem({
  className,
  destructive,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { destructive?: boolean }) {
  return (
    <button
      type="button"
      role="menuitem"
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-base",
        "transition-colors hover:bg-sunken",
        destructive ? "text-critical hover:bg-critical-soft" : "text-ink",
        "disabled:cursor-not-allowed disabled:text-ink-subtle disabled:hover:bg-transparent",
        className,
      )}
      {...props}
    />
  );
}

export function MenuSeparator() {
  return <div role="separator" className="my-1 h-px bg-line" />;
}

export function MenuLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="label-caps px-2 py-1 text-ink-subtle">{children}</p>
  );
}

/* ---------------------------------------------------------------------------
 * Popover — a panel of arbitrary content anchored to its trigger.
 *
 * `Menu` above is `role="menu"`, which promises menuitem children and the
 * arrow-key model that goes with them. A panel of checkboxes is not a menu, and
 * announcing it as one sends a screen-reader user looking for commands. This is
 * the same platform popover, labelled as a dialog.
 * ------------------------------------------------------------------------ */

export function Popover({
  trigger,
  title,
  children,
  align = "start",
  className,
  onOpenChange,
}: {
  trigger: (props: { popoverTarget: string; "aria-haspopup": "dialog" }) => React.ReactNode;
  title: string;
  children: React.ReactNode;
  align?: "start" | "end";
  className?: string;
  /** Lets a caller mount heavy content only while the panel is open. */
  onOpenChange?: (open: boolean) => void;
}) {
  const rawId = React.useId();
  const id = `popover${rawId.replace(/:/g, "")}`;
  const titleId = `${id}title`;
  const ref = React.useRef<HTMLDivElement>(null);

  // Positioned against the trigger's viewport box: the top layer has no
  // offset parent to lay out against.
  const place = React.useCallback(() => {
    const panel = ref.current;
    if (!panel) return;
    const trigger = document.querySelector<HTMLElement>(`[popovertarget="${id}"]`);
    if (!trigger) return;

    const box = trigger.getBoundingClientRect();
    const width = panel.offsetWidth;
    const left = align === "end" ? box.right - width : box.left;

    panel.style.top = `${Math.round(box.bottom + 6)}px`;
    panel.style.left = `${Math.round(Math.max(8, Math.min(left, window.innerWidth - width - 8)))}px`;
    // Never taller than the space below the trigger; the content scrolls.
    panel.style.maxHeight = `${Math.round(window.innerHeight - box.bottom - 24)}px`;
  }, [align, id]);

  // Re-placed on resize AND scroll — the anchor's viewport box moves with
  // both, and a detached panel floats over the wrong content. Scroll is
  // capture-phase so inner scroll containers report too.
  React.useEffect(() => {
    const onMove = () => {
      if (ref.current?.matches(":popover-open")) place();
    };
    window.addEventListener("resize", onMove);
    window.addEventListener("scroll", onMove, { capture: true });
    return () => {
      window.removeEventListener("resize", onMove);
      window.removeEventListener("scroll", onMove, { capture: true });
    };
  }, [place]);

  return (
    <>
      {trigger({ popoverTarget: id, "aria-haspopup": "dialog" })}
      <div
        ref={ref}
        id={id}
        popover="auto"
        role="dialog"
        aria-labelledby={titleId}
        onToggle={(event) => {
          const open = (event as unknown as { newState: string }).newState === "open";
          if (open) place();
          onOpenChange?.(open);
        }}
        className={cn(
          "fixed m-0 flex flex-col overflow-hidden rounded-xl bg-surface shadow-popover",
          "[&:not(:popover-open)]:hidden",
          className,
        )}
      >
        <h2 id={titleId} className="sr-only">
          {title}
        </h2>
        {children}
      </div>
    </>
  );
}
