/* ---------------------------------------------------------------------------
 * Process-wide store for the development driver.
 *
 * Next builds route handlers and server components into separate module
 * graphs, so a plain module-level `const rows = []` is instantiated more than
 * once: a write from a route handler would be invisible to the page that
 * renders next. Anchoring the state on `globalThis` gives every bundle — and
 * every hot reload — the same object.
 *
 * This exists only because the development driver keeps state in memory. The
 * Postgres driver has a real database and deletes this file with it.
 * ------------------------------------------------------------------------ */

const REGISTRY = Symbol.for("socialorbit.dev.store");

type Registry = Map<string, unknown>;

function registry(): Registry {
  const host = globalThis as typeof globalThis & { [REGISTRY]?: Registry };
  host[REGISTRY] ??= new Map();
  return host[REGISTRY];
}

/**
 * Returns the one instance of `key`, creating it from `seed` the first time.
 * The seed runs at most once per process.
 */
export function shared<T>(key: string, seed: () => T): T {
  const store = registry();
  if (!store.has(key)) store.set(key, seed());
  return store.get(key) as T;
}

/** Test seam: drops everything so a suite can start from the seed again. */
export function __resetSharedStore(): void {
  registry().clear();
}
