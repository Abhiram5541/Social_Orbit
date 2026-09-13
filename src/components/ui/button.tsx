import * as React from "react";
import { cn } from "@/lib/class-names";

type Variant = "primary" | "accent" | "secondary" | "ghost" | "danger" | "link";
type Size = "sm" | "md" | "lg" | "icon";

/*
 * The primary action is the brand green, drawn as a pill with a soft green
 * glow beneath it. Ink is not used for buttons: on a light, friendly surface
 * a black button reads as a warning, and the green is what the whole product
 * uses to say "go".
 */
const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-brand text-white shadow-brand hover:bg-brand-active " +
    "disabled:bg-brand/35 disabled:shadow-none",
  /* Kept for callers; identical to primary now that the primary is green. */
  accent:
    "bg-brand text-white shadow-brand hover:bg-brand-active disabled:bg-brand/35 disabled:shadow-none",
  secondary:
    "bg-surface text-ink border border-line-strong hover:border-brand-line hover:bg-brand-softer hover:text-brand-ink " +
    "active:bg-brand-soft " +
    "disabled:bg-surface disabled:text-ink-subtle disabled:hover:border-line-strong",
  ghost:
    "text-ink-muted hover:bg-sunken hover:text-ink active:bg-sunken-strong " +
    "disabled:text-ink-subtle disabled:hover:bg-transparent",
  danger:
    "bg-critical text-white hover:bg-critical-hover active:bg-critical-active " +
    "disabled:bg-critical/40",
  link: "text-brand-ink underline hover:text-brand-active disabled:text-ink-subtle",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3.5 text-base gap-1.5 rounded-full",
  md: "h-10 px-4.5 gap-2 rounded-full",
  lg: "h-12 px-6 text-md gap-2 rounded-full",
  icon: "size-10 rounded-full",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** Shows a spinner, disables the control, and keeps its width stable. */
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "secondary", size = "md", loading, disabled, children, ...props }, ref) => (
    <button
      ref={ref}
      // A control that only looks disabled is a lie to assistive tech.
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "press relative inline-flex select-none items-center justify-center whitespace-nowrap",
        "font-semibold tracking-tight",
        "disabled:pointer-events-none",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    >
      {loading ? (
        <>
          <Spinner className="absolute" />
          <span className="invisible contents">{children}</span>
        </>
      ) : (
        children
      )}
    </button>
  ),
);
Button.displayName = "Button";

export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      aria-hidden
      className={cn("size-4 animate-spin", className)}
      fill="none"
    >
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
      <path
        d="M14.5 8A6.5 6.5 0 0 0 8 1.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** A row of buttons that behaves as one segmented control. */
export function ButtonGroup({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="group"
      className={cn(
        "inline-flex items-center rounded-full bg-sunken p-1",
        className,
      )}
      {...props}
    />
  );
}

export function SegmentButton({
  active,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={cn(
        "press h-8 rounded-full px-3.5 text-base font-semibold",
        active
          ? "bg-brand text-white shadow-brand"
          : "text-ink-muted hover:text-ink",
        className,
      )}
      {...props}
    />
  );
}

/**
 * A link that looks like a button. Kept as its own component rather than a
 * polymorphic `as` prop on Button: an anchor and a button have different
 * semantics, and blurring them is how "buttons" end up unopenable in a new tab.
 */
export function LinkButton({
  className,
  variant = "secondary",
  size = "md",
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: Variant;
  size?: Size;
  href: string;
}) {
  return (
    <a
      className={cn(
        "press inline-flex select-none items-center justify-center whitespace-nowrap",
        "font-semibold tracking-tight no-underline",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
}
