/*
 * Proves the SQL content matcher and the in-memory one agree.
 *
 * Attribution decides what a client is told they paid for, so both paths that
 * can answer it must return the same posts. Run against a real database
 * before turning any SQL read path on:
 *
 *   DATABASE_URL=postgres://... node scripts/content-parity.mjs
 *
 * It found the one difference that mattered: Postgres reads [[:alnum:]] as
 * Unicode and JavaScript reads \\w as ASCII, so a hashtag preceded by a
 * Telugu character matched in memory and not in SQL.
 */
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL ?? "postgres://user:password@localhost:5432/socialorbit", max: 2 });

// The in-memory rule, copied verbatim from attribution-service.
const escape = (v) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const carriesTagMemory = (item, tag) => {
  if ((item.hashtags ?? []).some((e) => e.trim().replace(/^#+/, "").toLowerCase() === tag)) return true;
  const text = `${item.title ?? ""} ${item.caption ?? ""}`.toLowerCase();
  return new RegExp(`(^|[^\\w])#${escape(tag)}([^\\w]|$)`).test(text);
};

const TAGS = ["biryani", "shorts", "food", "trending", "vlog"];
const WINDOW = { from: "2000-01-01", to: "2099-01-01" };

const { rows: all } = await pool.query("SELECT data FROM content");
const memory = all.map((r) => r.data);
console.log(`rows in memory: ${memory.length}`);

let mismatches = 0;
for (const tag of TAGS) {
  const mem = new Set(memory.filter((item) => carriesTagMemory(item, tag)).map((i) => i.id));

  // SQL: structured hashtag OR the same word-boundary rule over title+caption.
  const { rows } = await pool.query(
    `SELECT data->>'id' AS id FROM content
       WHERE data->'hashtags' @> $1::jsonb
          OR lower(coalesce(data->>'title','') || ' ' || coalesce(data->>'caption',''))
             ~ ('(^|[^A-Za-z0-9_])#' || $2 || '([^A-Za-z0-9_]|$)')`,
    [JSON.stringify([`#${tag}`]), tag],
  );
  const sql = new Set(rows.map((r) => r.id));

  const onlyMem = [...mem].filter((id) => !sql.has(id));
  const onlySql = [...sql].filter((id) => !mem.has(id));
  mismatches += onlyMem.length + onlySql.length;
  console.log(`#${tag}: memory ${mem.size}, sql ${sql.size}, only-memory ${onlyMem.length}, only-sql ${onlySql.length}`);
  if (onlyMem.length) console.log("   e.g. only-memory:", onlyMem.slice(0, 2));
  if (onlySql.length) console.log("   e.g. only-sql:", onlySql.slice(0, 2));
}
console.log(mismatches === 0 ? "PARITY OK" : `PARITY BROKEN: ${mismatches}`);
process.exitCode = mismatches === 0 ? 0 : 1;
await pool.end();
