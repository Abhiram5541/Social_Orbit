"use client";

import * as React from "react";
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
  const [open, setOpen] = React.useState(false);

  const position = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-1.5",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-1.5",
    left: "right-full top-1/2 -translate-y-1/2 mr-1.5",
    right: "left-full top-1/2 -translate-y-1/2 ml-1.5",
  }[side];

  return (
    <span
      className={cn("relative inline-flex", className)}
      onPointerEnter={() => setOpen(true)}
      onPointerLeave={() => setOpen(false)}
      onFocusCapture={() => setOpen(true)}
      onBlurCapture={() => setOpen(false)}
    >
      {React.cloneElement(children, { "aria-describedby": open ? id : undefined })}
      {open && (
        <span
          role="tooltip"
          id={id}
          className={cn(
            "pointer-events-none absolute z-50 w-max max-w-64 rounded-md bg-ink px-2 py-1.5",
            "text-[12px] leading-4 text-ink-inverse shadow-popover",
            position,
          )}
        >
          {content}
        </span>
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
  className,
}: {
  trigger: (props: { popoverTarget: string; "aria-haspopup": "menu" }) => React.ReactNode;
  children: React.ReactNode;
  align?: "start" | "end";
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
    panel.style.top = `${Math.round(box.bottom + 4)}px`;
    panel.style.left = `${Math.round(Math.max(8, Math.min(left, window.innerWidth - width - 8)))}px`;
  }, [align, id]);

  return (
    <>
      {trigger({ popoverTarget: id, "aria-haspopup": "menu" })}
      <div
        ref={ref}
        id={id}
        popover="auto"
        role="menu"
        onToggle={(event) => {
          if ((event as unknown as { newState: string }).newState === "open") place();
        }}
        className={cn(
          "fixed m-0 min-w-44 rounded-lg border border-line bg-surface p-1 shadow-popover",
          "[&:not(:popover-open)]:hidden",
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
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px]",
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
    <p className="px-2 py-1 text-[11px] font-medium uppercase tracking-[0.05em] text-ink-subtle">
      {children}
    </p>
  );
}
