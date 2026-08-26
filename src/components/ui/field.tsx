"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

/* ---------------------------------------------------------------------------
 * Form primitives.
 *
 * `Field` owns the id wiring so no caller can forget it: the label points at
 * the control, the control points back at its hint and error, and an invalid
 * control announces itself. Getting this wrong is the most common a11y defect
 * in dashboards, so it is not left to the call site.
 * ------------------------------------------------------------------------ */

interface FieldContextValue {
  id: string;
  hintId: string;
  errorId: string;
  invalid: boolean;
  required: boolean;
  describedBy: string | undefined;
}

const FieldContext = React.createContext<FieldContextValue | null>(null);

function useField() {
  return React.useContext(FieldContext);
}

export function Field({
  label,
  hint,
  error,
  required,
  className,
  children,
  labelSuffix,
}: {
  label: string;
  hint?: React.ReactNode;
  error?: string | null;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
  /** Rendered on the label row, right-aligned — e.g. "Forgot password?". */
  labelSuffix?: React.ReactNode;
}) {
  const id = React.useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy =
    [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined;

  return (
    <FieldContext.Provider
      value={{
        id,
        hintId,
        errorId,
        invalid: Boolean(error),
        required: Boolean(required),
        describedBy,
      }}
    >
      <div className={cn("flex flex-col gap-1.5", className)}>
        <div className="flex items-baseline justify-between gap-3">
          {/* The required marker sits OUTSIDE the <label> element. Inside it,
              the asterisk becomes part of the control's accessible name — so
              the field announces as "Password star" and any name-based query
              for "Password" misses it. */}
          <span className="flex items-baseline gap-0.5">
            <label htmlFor={id} className="text-[13px] font-medium text-ink">
              {label}
            </label>
            {required && (
              <span className="text-critical" aria-hidden>
                *
              </span>
            )}
          </span>
          {labelSuffix}
        </div>
        {children}
        {error ? (
          <p id={errorId} role="alert" className="text-[12px] text-critical">
            {error}
          </p>
        ) : hint ? (
          <p id={hintId} className="text-[12px] text-ink-muted">
            {hint}
          </p>
        ) : null}
      </div>
    </FieldContext.Provider>
  );
}

const CONTROL_BASE =
  "w-full rounded-lg border bg-surface px-3 text-[14px] text-ink transition-shadow " +
  "placeholder:text-ink-subtle " +
  "focus:outline-none focus:ring-2 focus:ring-brand/25 " +
  "disabled:cursor-not-allowed disabled:bg-sunken disabled:text-ink-subtle";

function controlClasses(invalid: boolean, className?: string) {
  return cn(
    CONTROL_BASE,
    invalid
      ? "border-critical focus:border-critical focus:ring-critical/20"
      : "border-line-strong focus:border-brand",
    className,
  );
}

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => {
  const field = useField();
  return (
    <input
      ref={ref}
      data-focus-custom
      id={props.id ?? field?.id}
      aria-invalid={field?.invalid || undefined}
      aria-required={field?.required || undefined}
      aria-describedby={props["aria-describedby"] ?? field?.describedBy}
      className={cn("h-9", controlClasses(field?.invalid ?? false, className))}
      {...props}
    />
  );
});
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => {
  const field = useField();
  return (
    <textarea
      ref={ref}
      data-focus-custom
      id={props.id ?? field?.id}
      aria-invalid={field?.invalid || undefined}
      aria-describedby={props["aria-describedby"] ?? field?.describedBy}
      className={cn("min-h-20 py-2 leading-5", controlClasses(field?.invalid ?? false, className))}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => {
  const field = useField();
  return (
    <div className="relative">
      <select
        ref={ref}
        data-focus-custom
        id={props.id ?? field?.id}
        aria-invalid={field?.invalid || undefined}
        aria-describedby={props["aria-describedby"] ?? field?.describedBy}
        className={cn(
          "h-9 appearance-none pr-8",
          controlClasses(field?.invalid ?? false, className),
        )}
        {...props}
      >
        {children}
      </select>
      <svg
        viewBox="0 0 12 12"
        aria-hidden
        className="pointer-events-none absolute right-2.5 top-1/2 size-3 -translate-y-1/2 text-ink-muted"
      >
        <path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
});
Select.displayName = "Select";

export function Checkbox({
  label,
  description,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: React.ReactNode;
  description?: string;
}) {
  const id = React.useId();
  return (
    <div className={cn("flex items-start gap-2.5", className)}>
      <input
        type="checkbox"
        id={props.id ?? id}
        className={cn(
          "mt-0.5 size-4 shrink-0 cursor-pointer rounded border-line-strong text-brand",
          "accent-brand",
        )}
        {...props}
      />
      <div className="min-w-0">
        <label htmlFor={props.id ?? id} className="cursor-pointer text-[13px] text-ink">
          {label}
        </label>
        {description && <p className="text-[12px] text-ink-muted">{description}</p>}
      </div>
    </div>
  );
}

/** A search input with a leading icon and an optional clear affordance. */
export function SearchInput({
  className,
  onClear,
  value,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { onClear?: () => void }) {
  return (
    <div className={cn("relative", className)}>
      <svg
        viewBox="0 0 16 16"
        aria-hidden
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-subtle"
      >
        <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
        <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <input
        type="search"
        value={value}
        data-focus-custom
        className={cn(
          CONTROL_BASE,
          "h-9 border-line-strong pl-9 pr-8 focus:border-brand",
          "[&::-webkit-search-cancel-button]:appearance-none",
        )}
        {...props}
      />
      {onClear && value ? (
        <button
          type="button"
          onClick={onClear}
          aria-label="Clear search"
          className="absolute right-2 top-1/2 grid size-5 -translate-y-1/2 place-items-center rounded text-ink-subtle hover:bg-sunken hover:text-ink"
        >
          <svg viewBox="0 0 12 12" className="size-3" aria-hidden>
            <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}
