"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/class-names";

/* ---------------------------------------------------------------------------
 * Built on the native <dialog> element.
 *
 * Note for future edits: do NOT guard the return with `typeof document`. A
 * <dialog> renders as ordinary markup on the server; only `showModal()` needs
 * the browser, and that already lives in an effect. Branching on `document`
 * makes the server emit nothing and the client emit an element, which is a
 * hydration mismatch that throws away and re-renders the whole page subtree —
 * every screen carrying a dialog paid for it. The platform already gives us the
 * top layer, focus trapping, Escape-to-close, inert background and correct
 * `aria-modal` semantics — a headless dialog library would reimplement all of
 * that in userland and get some of it wrong.
 * ------------------------------------------------------------------------ */

const SIZES = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
} as const;

export function Dialog({
  open,
  onClose,
  title,
  description,
  size = "md",
  footer,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  size?: keyof typeof SIZES;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = React.useRef<HTMLDialogElement>(null);
  const titleId = React.useId();
  const descId = React.useId();

  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    else if (!open && node.open) node.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      // Escape and the backdrop both route through the same handler so parent
      // state can never drift from the element's real open state.
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className={cn(
        "w-[calc(100vw-2rem)] rounded-2xl bg-surface p-0 text-ink shadow-overlay",
        "backdrop:bg-ink/40 backdrop:backdrop-blur-[1px]",
        SIZES[size],
        className,
      )}
    >
      {/* Stop clicks inside the panel from reaching the backdrop handler. */}
      <div onClick={(event) => event.stopPropagation()}>
        <header className="flex items-start justify-between gap-4 border-b border-line px-4 py-3">
          <div className="min-w-0 space-y-0.5">
            <h2 id={titleId} className="text-md font-semibold">
              {title}
            </h2>
            {description && (
              <p id={descId} className="text-base text-ink-muted">
                {description}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="-mr-1 grid size-7 shrink-0 place-items-center rounded-md text-ink-muted transition-colors hover:bg-sunken hover:text-ink"
          >
            <X className="size-4" aria-hidden />
          </button>
        </header>

        <div className="max-h-[70vh] overflow-y-auto px-4 py-4">{children}</div>

        {footer && (
          <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-sunken/50 px-4 py-3">
            {footer}
          </footer>
        )}
      </div>
    </dialog>
  );
}

/**
 * A side sheet. Same native <dialog> guarantees; different geometry. Used for
 * filters on tablet and mobile, where a modal would hide the results the user
 * is filtering.
 */
export function Sheet({
  open,
  onClose,
  title,
  footer,
  children,
  tone = "surface",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  footer?: React.ReactNode;
  children: React.ReactNode;
  /**
   * `instrument` renders the sheet in the chrome's graphite. The mobile
   * navigation drawer *is* the rail, so it must be the same material rather
   * than a white panel wearing the rail's contents.
   */
  tone?: "surface" | "instrument";
}) {
  const ref = React.useRef<HTMLDialogElement>(null);
  const titleId = React.useId();

  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (open && !node.open) node.showModal();
    else if (!open && node.open) node.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      className={cn(
        "sheet-enter m-0 ml-auto h-dvh max-h-none w-[min(24rem,100vw)] max-w-none p-0 shadow-overlay",
        tone === "instrument"
          ? "bg-instrument text-instrument-ink"
          : "border-l border-line bg-surface text-ink",
      )}
    >
      <div className="flex h-full flex-col" onClick={(event) => event.stopPropagation()}>
        <header
          className={cn(
            "flex items-center justify-between gap-4 px-4 py-3",
            tone === "instrument" ? "border-b border-instrument-line" : "border-b border-line",
          )}
        >
          <h2
            id={titleId}
            className={cn("text-md font-semibold", tone === "instrument" && "sr-only")}
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            className={cn(
              "press -mr-1 ml-auto grid size-8 place-items-center rounded-md",
              tone === "instrument"
                ? "text-instrument-muted hover:bg-instrument-raised hover:text-instrument-ink"
                : "text-ink-muted hover:bg-sunken hover:text-ink",
            )}
          >
            <X className="size-4" aria-hidden />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer && (
          <footer className="flex items-center gap-2 border-t border-line bg-sunken/50 px-4 py-3">
            {footer}
          </footer>
        )}
      </div>
    </dialog>
  );
}
