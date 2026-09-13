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
