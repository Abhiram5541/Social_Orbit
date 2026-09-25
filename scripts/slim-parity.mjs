/*
 * Proves slim content loading loses nothing.
 *
 * For every stored post it rebuilds the link and the thumbnail the way the
 * running process would with `caption`, `url` and `thumbnailUrl` dropped from
 * memory — deriving the rule, holding the exceptions — and compares against
 * what is actually stored. Any mismatch is a link the product would render
 * wrongly, so this must read zero before SENSO_SLIM_CONTENT is turned on.
 *
 *   DATABASE_URL=postgres://... node scripts/slim-parity.mjs
 */
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });
const v = `right(id, length(id) - length(data->>'accountId') - 1)`;

// Exactly the query the boot path uses.
const { rows: overrideRows } = await pool.query(
  `SELECT id, data->>'url' AS url, data->>'thumbnailUrl' AS thumbnail_url
     FROM content
    WHERE data->>'platform' <> 'youtube'
       OR id NOT LIKE (data->>'accountId') || '\\_%'
       OR coalesce(data->>'url','') <> 'https://www.youtube.com/watch?v=' || ${v}
       OR coalesce(data->>'thumbnailUrl','') <> 'https://i.ytimg.com/vi/' || ${v} || '/mqdefault.jpg'`,
);
const overrides = new Map(
  overrideRows.map((r) => [r.id, { url: r.url ?? undefined, thumbnailUrl: r.thumbnail_url ?? undefined }]),
);
console.log(`overrides held: ${overrides.size}`);

// Exactly the derivation the process uses.
const videoIdOf = (id, accountId) => (id.startsWith(`${accountId}_`) ? id.slice(accountId.length + 1) : null);
const url = (row) => {
  const o = overrides.get(row.id)?.url;
  if (o) return o;
  const vid = row.platform === "youtube" ? videoIdOf(row.id, row.accountId) : null;
  return vid ? `https://www.youtube.com/watch?v=${vid}` : "";
};
const thumb = (row) => {
  const o = overrides.get(row.id);
  if (o) return o.thumbnailUrl ?? null;
  const vid = row.platform === "youtube" ? videoIdOf(row.id, row.accountId) : null;
  return vid ? `https://i.ytimg.com/vi/${vid}/mqdefault.jpg` : null;
};

const { rows } = await pool.query("SELECT data FROM content");
let badUrl = 0;
let badThumb = 0;
const examples = [];
for (const { data } of rows) {
  const slim = { id: data.id, accountId: data.accountId, platform: data.platform };
  if (url(slim) !== (data.url ?? "")) {
    badUrl += 1;
    if (examples.length < 3) examples.push({ id: data.id, stored: data.url, rebuilt: url(slim) });
  }
  if (thumb(slim) !== (data.thumbnailUrl ?? null)) badThumb += 1;
}

console.log(`rows checked: ${rows.length}`);
console.log(`url mismatches: ${badUrl}`);
console.log(`thumbnail mismatches: ${badThumb}`);
for (const e of examples) console.log("  ", e);
console.log(badUrl + badThumb === 0 ? "SLIM PARITY OK — nothing is lost" : "SLIM PARITY BROKEN");
process.exitCode = badUrl + badThumb === 0 ? 0 : 1;
await pool.end();
