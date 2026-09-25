import { Pool } from "pg";
import type { IngestedRecords } from "./ingested-store";

/* ---------------------------------------------------------------------------
 * PostgreSQL driver.
 *
 * Postgres is the durable copy of the influencer database; the process still
 * works from the in-memory record set it loads at boot (see `warmIngestedStore`
 * in ingested-store.ts). Every read path in the product is synchronous and
 * scores from raw rows on request, so the database is written through to on
 * every mutation and read from once per server start — the same shape the
 * JSON file had, with a store that survives a deploy and can be added to from
 * more than one machine.
 *
 * One table per record kind, each holding the record as `jsonb` beside the two
 * columns writes are addressed by: the row key and the id a whole set of rows
 * is replaced under (the creator, or the account for snapshots).
 *
 * ponytail: jsonb rows keep the record↔row mapping to one function for nine
 * kinds. Promote a field to a real column (a generated column over `data` will
 * do) the first time a query needs an index on it. Loading everything at boot
 * holds at ~10k creators; past that, reads have to become queries.
 * ------------------------------------------------------------------------ */

export type Table = Exclude<keyof IngestedRecords, "revision">;

const TABLE: Record<Table, { name: string; key: (row: never) => string; owner: (row: never) => string }> = {
  influencers: { name: "influencers", key: (r: { id: string }) => r.id, owner: (r: { id: string }) => r.id },
  accounts: {
    name: "accounts",
    key: (r: { id: string }) => r.id,
    owner: (r: { influencerId: string }) => r.influencerId,
  },
  snapshots: {
    name: "snapshots",
    key: (r: { accountId: string; date: string }) => `${r.accountId}@${r.date}`,
    owner: (r: { accountId: string }) => r.accountId,
  },
  content: {
    name: "content",
    key: (r: { id: string }) => r.id,
    owner: (r: { influencerId: string }) => r.influencerId,
  },
  ai: {
    name: "ai_outputs",
    key: (r: { influencerId: string }) => r.influencerId,
    owner: (r: { influencerId: string }) => r.influencerId,
  },
  viewHistory: {
    name: "view_history",
    key: (r: { accountId: string; videoId: string }) => `${r.accountId}:${r.videoId}`,
    owner: (r: { influencerId: string }) => r.influencerId,
  },
  grants: {
    name: "oauth_grants",
    key: (r: { accountId: string }) => r.accountId,
    owner: (r: { influencerId: string }) => r.influencerId,
  },
  signals: {
    name: "audience_signals",
    key: (r: { influencerId: string }) => r.influencerId,
    owner: (r: { influencerId: string }) => r.influencerId,
  },
  audience: {
    name: "audience",
    key: (r: { influencerId: string }) => r.influencerId,
    owner: (r: { influencerId: string }) => r.influencerId,
  },
};

export const TABLES = Object.keys(TABLE) as Table[];

/**
 * One mutation of the in-memory store, expressed for the database. A store
 * function mutates memory, then commits the list of these that describes what
 * it did; they are applied in one transaction, in order.
 */
export type WriteOp =
  | { table: Table; upsert: unknown[] }
  | { table: Table; deleteOwners: string[] }
  | { table: Table; deleteKeys: string[] }
  | { table: Table; truncate: true };

export function postgresDriver(): boolean {
  return process.env.SOCIALORBIT_DATA_DRIVER === "postgres";
}

let pool: Pool | null = null;

function db(): Pool {
  if (pool) return pool;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("SOCIALORBIT_DATA_DRIVER is postgres but DATABASE_URL is not set.");
  }
  pool = new Pool({ connectionString: url, max: 4 });
  return pool;
}

/** Idempotent, so it runs on every boot and a fresh database needs no setup step. */
export async function ensureSchema(): Promise<void> {
  const client = await db().connect();
  try {
    for (const table of TABLES) {
      const { name } = TABLE[table];
      await client.query(
        `CREATE TABLE IF NOT EXISTS ${name} (
           seq bigserial,
           id text PRIMARY KEY,
           owner_id text NOT NULL,
           data jsonb NOT NULL,
           updated_at timestamptz NOT NULL DEFAULT now()
         )`,
      );
      await client.query(`CREATE INDEX IF NOT EXISTS ${name}_owner_idx ON ${name} (owner_id)`);
    }

    /* Content is 84% of the resident record set and the only table anything
     * scans, so it is the one that gets real columns. They are GENERATED from
     * `data`, which means: nothing is copied, nothing can drift out of step
     * with the row, and no write path changes — the jsonb row stays the
     * single source of truth and these are just indexable views onto it.
     *
     * Adding a generated column rewrites the table once. That is why they are
     * added one at a time and guarded: a half-finished migration leaves the
     * earlier ones in place and the next boot continues. */
    for (const [column, definition] of [
      ["influencer_id", `text GENERATED ALWAYS AS (data->>'influencerId') STORED`],
      ["account_id", `text GENERATED ALWAYS AS (data->>'accountId') STORED`],
      ["platform", `text GENERATED ALWAYS AS (data->>'platform') STORED`],
      // Kept as the ISO text the platforms return. A timestamptz cast is not
      // immutable (it reads DateStyle and TimeZone), so Postgres refuses it in
      // a generated column — and ISO-8601 UTC sorts lexicographically anyway,
      // which is exactly how every date comparison in this codebase already
      // works.
      ["published_at", `text GENERATED ALWAYS AS (data->>'publishedAt') STORED`],
      ["views", `bigint GENERATED ALWAYS AS ((data->>'views')::bigint) STORED`],
    ] as const) {
      await client.query(
        `ALTER TABLE content ADD COLUMN IF NOT EXISTS ${column} ${definition}`,
      );
    }

    await client.query(
      `CREATE INDEX IF NOT EXISTS content_creator_published_idx
         ON content (influencer_id, published_at DESC)`,
    );
    await client.query(
      `CREATE INDEX IF NOT EXISTS content_published_idx ON content (published_at DESC)`,
    );
    // Hashtag lookups are the campaign tracker's hot path: a GIN index over
    // the jsonb array turns "every post carrying #launch" from a scan of
    // everything into a lookup.
    await client.query(
      `CREATE INDEX IF NOT EXISTS content_hashtags_idx ON content USING gin ((data->'hashtags'))`,
    );
    // Free-text over the words creators wrote. Used by listening and by the
    // caption search behind attribution.
    await client.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`).catch(() => {
      // Not every managed Postgres allows extensions. Without it the text
      // queries still run, just as scans — correctness is unaffected.
    });
    await client.query(
      `CREATE INDEX IF NOT EXISTS content_text_idx ON content USING gin (
         (coalesce(data->>'title','') || ' ' || coalesce(data->>'caption','')) gin_trgm_ops
       )`,
    ).catch(() => {});
  } finally {
    client.release();
  }
}

/** Every row of every table, in insertion order — the array order the JSON file had. */
export async function loadAll(): Promise<IngestedRecords> {
  const records = { revision: 0 } as IngestedRecords;
  for (const table of TABLES) {
    const { rows } = await db().query<{ data: unknown }>(
      `SELECT data FROM ${TABLE[table].name} ORDER BY seq`,
    );
    (records as unknown as Record<Table, unknown[]>)[table] = rows.map((row) => row.data);
  }
  return records;
}

/* --- Reading content without loading it ----------------------------------
 * The queries the product needs over posts, answered by the database rather
 * than by a scan of everything in memory. Each one is indexed; see
 * `ensureSchema`.
 * ---------------------------------------------------------------------- */

/** The full stored rows for these ids, display fields included. */
export async function contentByIds(ids: string[]): Promise<Record<string, unknown>[]> {
  if (ids.length === 0) return [];
  const { rows } = await db().query<{ data: Record<string, unknown> }>(
    `SELECT data FROM content WHERE id = ANY($1)`,
    [ids],
  );
  return rows.map((row) => row.data);
}

/** A creator's posts, newest first. */
export async function contentForCreator(
  influencerId: string,
  limit = 50,
): Promise<Record<string, unknown>[]> {
  const { rows } = await db().query<{ data: Record<string, unknown> }>(
    `SELECT data FROM content
       WHERE influencer_id = $1
       ORDER BY published_at DESC
       LIMIT $2`,
    [influencerId, limit],
  );
  return rows.map((row) => row.data);
}

/** Posts inside a window, optionally on given platforms. */
export async function contentInWindow(window: {
  from: string;
  to: string;
  platforms?: string[];
  limit?: number;
}): Promise<Record<string, unknown>[]> {
  const { rows } = await db().query<{ data: Record<string, unknown> }>(
    `SELECT data FROM content
       WHERE published_at >= $1 AND published_at <= $2
         AND ($3::text[] IS NULL OR platform = ANY($3))
       ORDER BY published_at DESC
       LIMIT $4`,
    [window.from, window.to, window.platforms?.length ? window.platforms : null, window.limit ?? 5000],
  );
  return rows.map((row) => row.data);
}

/**
 * Posts whose own words contain `term`, as a whole token.
 *
 * The SQL mirrors the in-memory rule exactly — word boundary either side —
 * so a campaign attributes the same posts whichever path answered. A
 * detection rule with two implementations that disagree is worse than one
 * that is slow.
 *
 * The boundary class is spelled out as ASCII rather than written
 * `[[:alnum:]]`, because Postgres reads that as Unicode and JavaScript reads
 * `\w` as ASCII. On a database of Indian creators that difference is not
 * academic: `…ఉన్నాయి#shorts` matched in memory and did not match in SQL,
 * and a parity check over 55,000 matches found exactly this, thirteen times.
 */
export async function contentMatchingText(
  term: string,
  window: { from: string; to: string; platforms?: string[]; limit?: number },
): Promise<Record<string, unknown>[]> {
  const { rows } = await db().query<{ data: Record<string, unknown> }>(
    `SELECT data FROM content
       WHERE published_at >= $1 AND published_at <= $2
         AND ($3::text[] IS NULL OR platform = ANY($3))
         AND (coalesce(data->>'title','') || ' ' || coalesce(data->>'caption',''))
             ~* ('(^|[^A-Za-z0-9_])' || $4 || '([^A-Za-z0-9_]|$)')
       ORDER BY published_at DESC
       LIMIT $5`,
    [
      window.from,
      window.to,
      window.platforms?.length ? window.platforms : null,
      term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      window.limit ?? 5000,
    ],
  );
  return rows.map((row) => row.data);
}

/** Posts carrying a structured hashtag. Served by the GIN index. */
export async function contentWithHashtag(
  tag: string,
  window: { from: string; to: string; limit?: number },
): Promise<Record<string, unknown>[]> {
  const { rows } = await db().query<{ data: Record<string, unknown> }>(
    `SELECT data FROM content
       WHERE data->'hashtags' @> $1::jsonb
         AND published_at >= $2 AND published_at <= $3
       ORDER BY published_at DESC
       LIMIT $4`,
    [JSON.stringify([`#${tag}`]), window.from, window.to, window.limit ?? 5000],
  );
  return rows.map((row) => row.data);
}

/** How many posts each creator has, for reporting without loading them. */
export async function contentCounts(): Promise<{ total: number; byPlatform: Record<string, number> }> {
  const { rows } = await db().query<{ platform: string; count: string }>(
    `SELECT platform, count(*)::text AS count FROM content GROUP BY platform`,
  );
  const byPlatform: Record<string, number> = {};
  let total = 0;
  for (const row of rows) {
    const count = Number(row.count);
    byPlatform[row.platform ?? "unknown"] = count;
    total += count;
  }
  return { total, byPlatform };
}

/* --- Scheduled-job bookkeeping -------------------------------------------
 *
 * A job that ran today must not run again today: both spend API quota, and
 * the snapshot one is only idempotent because the harvest code checks dates.
 * One row per job, overwritten on each run.
 * ---------------------------------------------------------------------- */

export interface JobRun {
  name: string;
  ranOn: string;
  report: unknown;
}

export async function ensureJobsSchema(): Promise<void> {
  await db().query(
    `CREATE TABLE IF NOT EXISTS job_runs (
       name text PRIMARY KEY,
       ran_on text NOT NULL,
       report jsonb,
       updated_at timestamptz NOT NULL DEFAULT now()
     )`,
  );
}

export async function readJobRun(name: string): Promise<JobRun | null> {
  const { rows } = await db().query<{ name: string; ran_on: string; report: unknown }>(
    `SELECT name, ran_on, report FROM job_runs WHERE name = $1`,
    [name],
  );
  const row = rows[0];
  return row ? { name: row.name, ranOn: row.ran_on, report: row.report } : null;
}

export async function writeJobRun(run: JobRun): Promise<void> {
  await db().query(
    `INSERT INTO job_runs (name, ran_on, report) VALUES ($1, $2, $3::jsonb)
     ON CONFLICT (name) DO UPDATE SET ran_on = EXCLUDED.ran_on, report = EXCLUDED.report, updated_at = now()`,
    [run.name, run.ranOn, encode(run.report ?? null)],
  );
}

/** A query against the workspace-state table (see app-store.ts). */
export function appStateQuery<R extends object = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<{ rows: R[] }> {
  return db().query<R>(text, params);
}

export async function countInfluencersStored(): Promise<number> {
  const { rows } = await db().query<{ n: string }>(`SELECT count(*) AS n FROM influencers`);
  return Number(rows[0]?.n ?? 0);
}

/**
 * jsonb cannot hold U+0000, and rejects a lone surrogate — which a bio cut at
 * 400 characters through the middle of an emoji produces. One bad character
 * would fail the whole batch, so both are repaired here rather than upstream:
 * every connector would otherwise need to know a storage engine's rules.
 */
export function encode(value: unknown): string {
  return JSON.stringify(value, (_key, value: unknown) =>
    typeof value === "string" ? value.toWellFormed().replaceAll("\u0000", "") : value,
  );
}

/** Rows per statement. 5,000 jsonb records is a few MB — well under any limit, few round trips. */
const CHUNK = 5_000;

export async function applyWrites(ops: WriteOp[]): Promise<void> {
  if (ops.length === 0) return;
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    for (const op of ops) {
      const { name, key, owner } = TABLE[op.table];
      if ("truncate" in op) {
        await client.query(`TRUNCATE ${name}`);
      } else if ("deleteOwners" in op) {
        if (op.deleteOwners.length > 0) {
          await client.query(`DELETE FROM ${name} WHERE owner_id = ANY($1)`, [op.deleteOwners]);
        }
      } else if ("deleteKeys" in op) {
        if (op.deleteKeys.length > 0) {
          await client.query(`DELETE FROM ${name} WHERE id = ANY($1)`, [op.deleteKeys]);
        }
      } else {
        for (let i = 0; i < op.upsert.length; i += CHUNK) {
          const rows = op.upsert.slice(i, i + CHUNK).map((row) => ({
            id: key(row as never),
            owner_id: owner(row as never),
            data: row,
          }));
          await client.query(
            `INSERT INTO ${name} (id, owner_id, data)
             SELECT id, owner_id, data
             FROM jsonb_to_recordset($1::jsonb) AS x(id text, owner_id text, data jsonb)
             ON CONFLICT (id) DO UPDATE
               SET owner_id = EXCLUDED.owner_id, data = EXCLUDED.data, updated_at = now()`,
            [encode(rows)],
          );
        }
      }
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
