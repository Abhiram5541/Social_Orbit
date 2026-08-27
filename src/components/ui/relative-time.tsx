"use client";

import * as React from "react";
import { formatDateTime, formatRelativeTime, NO_VALUE } from "@/lib/format";

/**
 * True only after hydration. `useSyncExternalStore` is the API built for this:
 * it takes separate server and client snapshots, so it needs no effect and
 * triggers no second render pass the way a mount flag in `useEffect` does.
 */
const NEVER_CHANGES = () => () => {};

function useHasHydrated(): boolean {
  return React.useSyncExternalStore(
    NEVER_CHANGES,
    () => true,
    () => false,
  );
}

/**
 * A timestamp that is safe to render on both sides of hydration.
 *
 * "3 hours ago" is computed against `Date.now()`, so the server and the client
 * evaluate it at different instants and React reports a hydration mismatch —
 * which discards and re-renders the whole subtree. The absolute form is stable,
 * so it renders first and the relative form replaces it after mount, when only
 * the client's clock is involved.
 *
 * The absolute value stays in `title` afterwards, which is the more useful
 * behaviour anyway: "3 hours ago" is easier to scan, the exact stamp is one
 * hover away, and screen readers get a real datetime either way.
 */
export function RelativeTime({
  at,
  prefix,
  className,
}: {
  at: string | null | undefined;
  /** Rendered before the value, e.g. "Updated". */
  prefix?: string;
  className?: string;
}) {
  const mounted = useHasHydrated();

  if (!at) {
    return <span className={className}>{prefix ? `${prefix} ${NO_VALUE}` : NO_VALUE}</span>;
  }

  const absolute = formatDateTime(at);
  const text = mounted ? formatRelativeTime(at) : absolute;

  return (
    <time dateTime={at} title={absolute} className={className}>
      {prefix ? `${prefix} ${text}` : text}
    </time>
  );
}
