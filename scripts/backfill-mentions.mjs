/*
 * Fills in `mentions` on content rows written before it existed.
 *
 * Nothing is deleted and nothing is overwritten: a row that already has the
 * field is skipped, and the only change is an added key. Safe to re-run, and
 * safe to interrupt — it commits in batches and picks up where it stopped.
 *
 *   DATABASE_URL=postgres://... node scripts/backfill-mentions.mjs
 *
 * Old rows only have the stored caption (400 characters) to read, which is
 * exactly what the live matcher read before this change — so this is a
 * like-for-like backfill, not a claim to have recovered the full text. New
 * rows are extracted from the whole description at ingestion.
 */
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
const BATCH = 5000;

const extract = (text) => [
  ...new Set(
    (text.match(/(?<![\p{L}\p{N}_])@[\p{L}\p{N}_.]+/gu) ?? []).map((h) =>
      h.toLowerCase().replace(/\.$/, ""),
    ),
  ),
];

let done = 0;
let withMentions = 0;
for (;;) {
  const { rows } = await pool.query(
    `SELECT id, coalesce(data->>'title','') || ' ' || coalesce(data->>'caption','') AS text
       FROM content WHERE data ? 'mentions' = false LIMIT $1`,
    [BATCH],
  );
  if (rows.length === 0) break;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const row of rows) {
      const mentions = extract(row.text);
      if (mentions.length > 0) withMentions += 1;
      await client.query(
        `UPDATE content SET data = jsonb_set(data, '{mentions}', $2::jsonb) WHERE id = $1`,
        [row.id, JSON.stringify(mentions)],
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  done += rows.length;
  console.log(`${done} rows (${withMentions} name someone)`);
}

const { rows: check } = await pool.query(
  `SELECT count(*) FILTER (WHERE data ? 'mentions') AS filled, count(*) AS total FROM content`,
);
console.log(`done: ${check[0].filled} of ${check[0].total} rows carry the field`);
await pool.end();
