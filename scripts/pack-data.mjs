import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

/*
 * Packs the ingested database for deployment.
 *
 * A serverless bundle is copied per function, so the 41MB plain file is not
 * something a deploy can carry; gzipped it is under 7MB and inflates in 62ms
 * on a cold start. `src/server/data/ingested-store.ts` prefers the plain file
 * when it exists, so this changes nothing locally — it only produces the copy
 * that ships.
 *
 * Run it after a harvest and before a deploy. Both files are gitignored: this
 * is a database, not source.
 */

const SOURCE = ".data/ingested.json";
const TARGET = `${SOURCE}.gz`;

if (!existsSync(SOURCE)) {
  console.error(`No database at ${SOURCE}. Nothing to pack.`);
  process.exit(1);
}

const raw = readFileSync(SOURCE);
const packed = gzipSync(raw, { level: 9 });
writeFileSync(TARGET, packed);

const records = JSON.parse(raw.toString("utf8"));
const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)}MB`;

console.log(
  `packed ${mb(raw.length)} -> ${mb(packed.length)}  ` +
    `(${records.influencers.length} creators, ${records.content.length} content items, ` +
    `${records.snapshots.length} snapshots)`,
);
console.log(`source mtime ${statSync(SOURCE).mtime.toISOString()}`);
