import * as React from "react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "link";
type Size = "sm" | "md" | "lg" | "icon";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-brand text-white shadow-raised hover:bg-brand-hover active:bg-brand-active " +
    "disabled:bg-brand/40 disabled:shadow-none",
  secondary:
    "bg-surface text-ink border border-line-strong shadow-raised hover:bg-sunken " +
    "active:bg-sunken-strong disabled:bg-surface disabled:text-ink-subtle",
  ghost:
    "text-ink-muted hover:bg-sunken hover:text-ink active:bg-sunken-strong " +
    "disabled:text-ink-subtle disabled:hover:bg-transparent",
  danger:
    "bg-critical text-white shadow-raised hover:brightness-110 active:brightness-95 " +
    "disabled:bg-critical/40",
  link: "text-brand-ink underline underline-offset-4 hover:text-brand-active disabled:text-ink-subtle",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-2.5 text-[13px] gap-1.5 rounded-md",
  md: "h-9 px-3.5 gap-2 rounded-lg",
  lg: "h-11 px-5 text-[15px] gap-2 rounded-lg",
  icon: "size-9 rounded-lg",
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
        "relative inline-flex select-none items-center justify-center whitespace-nowrap",
        "font-medium transition-colors duration-100",
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
        "inline-flex items-center rounded-lg border border-line bg-surface p-0.5",
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
        "h-7 rounded-md px-2.5 text-[13px] font-medium transition-colors",
        active
          ? "bg-brand text-white"
          : "text-ink-muted hover:bg-sunken hover:text-ink",
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
        "inline-flex select-none items-center justify-center whitespace-nowrap",
        "font-medium no-underline transition-colors duration-100",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
}
