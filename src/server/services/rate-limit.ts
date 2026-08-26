/* ---------------------------------------------------------------------------
 * Rate limiting.
 *
 * A fixed-window counter held in process memory. That is genuinely enough for
 * a single instance and it removes a Redis dependency from the critical path
 * of signing in.
 *
 * ponytail: per-process counters, so N instances allow N× the limit. Move the
 * counter to Redis (INCR + EXPIRE, same interface) when the app runs on more
 * than one instance — the call sites do not change.
 * ------------------------------------------------------------------------ */

import { shared } from "@/server/data/store";

interface Window {
  count: number;
  resetsAt: number;
}

const windows = shared("rate-limit-windows", () => new Map<string, Window>());

/** Keeps the map from growing without bound on a long-lived process. */
function sweep(now: number): void {
  if (windows.size < 5_000) return;
  for (const [key, window] of windows) {
    if (window.resetsAt <= now) windows.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export function checkRateLimit(
  key: string,
  { max, windowMs }: { max: number; windowMs: number },
  now: number = Date.now(),
): RateLimitResult {
  sweep(now);

  const existing = windows.get(key);
  if (!existing || existing.resetsAt <= now) {
    windows.set(key, { count: 1, resetsAt: now + windowMs });
    return { allowed: true, remaining: max - 1, retryAfterMs: 0 };
  }

  if (existing.count >= max) {
    return { allowed: false, remaining: 0, retryAfterMs: existing.resetsAt - now };
  }

  existing.count += 1;
  return { allowed: true, remaining: max - existing.count, retryAfterMs: 0 };
}

export function __resetRateLimits(): void {
  windows.clear();
}
