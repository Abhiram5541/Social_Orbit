import { replaceShared, shared } from "./process-store";
import { encode, postgresDriver, appStateQuery } from "./postgres";

/* ---------------------------------------------------------------------------
 * Durable copy of the workspace state — shortlists, campaigns, API keys,
 * users, orgs and usage counters.
 *
 * Same shape as the influencer database (postgres.ts): the process reads
 * from memory, and every mutation is written through as the row it changed.
 * One table for every kind, keyed by (kind, id), because none of these is
 * ever queried by anything but its id and its owner, and a row count in the
 * low thousands loads in one round trip at boot.
 *
 * The write is queued rather than awaited: the repositories are synchronous
 * and sit under synchronous services, and memory — not the database — is
 * what the next request reads. Writes are chained so they land in order, and
 * a failure is logged loudly rather than thrown into a request that already
 * succeeded against memory. ponytail: a crash inside that window loses one
 * write; make the repositories async if that ever matters.
 * ------------------------------------------------------------------------ */

export type AppKind = "shortlists" | "campaigns" | "api_keys" | "users" | "orgs" | "usage" | "digests";

export const APP_KINDS: AppKind[] = ["shortlists", "campaigns", "api_keys", "users", "orgs", "usage", "digests"];

/**
 * The one array for `kind`. Under the Postgres driver this is what
 * `warmAppStore` installed; under development it is the seed, made once.
 */
export function appRows<T>(kind: AppKind, seed: () => T[]): T[] {
  return shared(`app:${kind}`, seed);
}

let queue: Promise<void> = Promise.resolve();

function enqueue(label: string, work: () => Promise<unknown>): void {
  queue = queue
    .then(work)
    .then(() => undefined)
    .catch((error: unknown) => {
      console.error(`[app-store] ${label} failed: ${String(error)}`);
    });
}

/** Writes `rows` through to the database. No-op under the development driver. */
export function persist(kind: AppKind, rows: { id: string }[]): void {
  if (!postgresDriver() || rows.length === 0) return;
  // Snapshot now: the caller may go on mutating the same object.
  const payload = encode(rows.map((row) => ({ id: row.id, data: row })));
  enqueue(`upsert ${rows.length} ${kind}`, () =>
    appStateQuery(
      `INSERT INTO app_state (kind, id, data)
       SELECT $1, id, data FROM jsonb_to_recordset($2::jsonb) AS x(id text, data jsonb)
       ON CONFLICT (kind, id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
      [kind, payload],
    ),
  );
}

export function unpersist(kind: AppKind, ids: string[]): void {
  if (!postgresDriver() || ids.length === 0) return;
  enqueue(`delete ${ids.length} ${kind}`, () =>
    appStateQuery(`DELETE FROM app_state WHERE kind = $1 AND id = ANY($2)`, [kind, ids]),
  );
}

/** Waits for every queued write. For tests and for a graceful shutdown. */
export function flushAppStore(): Promise<void> {
  return queue;
}

/**
 * Loads every kind from the database into the process, before the first
 * request. A kind with no rows yet keeps its seed and the seed is written
 * through, so the database — not the seed function — is the source from the
 * second boot on; that is what lets a seed row be edited or deleted later.
 */
export async function warmAppStore(seeds: { [K in AppKind]: () => { id: string }[] }): Promise<void> {
  if (!postgresDriver()) return;
  await appStateQuery(
    `CREATE TABLE IF NOT EXISTS app_state (
       kind text NOT NULL,
       id text NOT NULL,
       data jsonb NOT NULL,
       updated_at timestamptz NOT NULL DEFAULT now(),
       PRIMARY KEY (kind, id)
     )`,
  );
  const { rows } = await appStateQuery<{ kind: AppKind; data: { id: string } }>(
    `SELECT kind, data FROM app_state ORDER BY updated_at, id`,
  );
  const byKind = new Map<AppKind, { id: string }[]>();
  for (const row of rows) (byKind.get(row.kind) ?? byKind.set(row.kind, []).get(row.kind)!).push(row.data);

  for (const kind of APP_KINDS) {
    const stored = byKind.get(kind);
    if (stored) {
      replaceShared(`app:${kind}`, stored);
    } else {
      const seeded = seeds[kind]();
      replaceShared(`app:${kind}`, seeded);
      persist(kind, seeded);
    }
  }
  await flushAppStore();
  console.log(`[app-store] loaded ${rows.length} workspace rows from postgres`);
}
