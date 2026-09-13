import { readFileSync, writeFileSync, existsSync } from "node:fs";
import pg from "pg";

/*
 * Exports the Postgres record set to `.data/ingested.json`.
 *
 * Under the postgres driver the JSON file stops being written to, so the
 * packed copy a deploy carries (`npm run data:pack`) goes stale the moment
 * the daily jobs run. This puts the database back into the file the packer
 * reads, in the shape `ingested-store.ts` loads. Run it before `data:pack`.
 */

const TABLES = {
  influencers: "influencers",
  accounts: "accounts",
  snapshots: "snapshots",
  content: "content",
  ai: "ai_outputs",
  viewHistory: "view_history",
  grants: "oauth_grants",
  signals: "audience_signals",
  audience: "audience",
};

function envLocal() {
  if (!existsSync(".env.local")) return {};
  return Object.fromEntries(
    readFileSync(".env.local", "utf8")
      .split("\n")
      .filter((line) => line.includes("=") && !line.startsWith("#"))
      .map((line) => {
        const i = line.indexOf("=");
        return [line.slice(0, i).trim(), line.slice(i + 1).trim().replace(/^"|"$/g, "")];
      }),
  );
}

const url = process.env.DATABASE_URL ?? envLocal().DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set (env or .env.local).");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
await client.connect();
const records = { revision: 0 };
for (const [key, table] of Object.entries(TABLES)) {
  const { rows } = await client.query(`SELECT data FROM ${table} ORDER BY seq`);
  records[key] = rows.map((row) => row.data);
}
await client.end();

writeFileSync(".data/ingested.json", JSON.stringify(records));
console.log(
  `exported ${records.influencers.length} creators, ${records.content.length} content items, ` +
    `${records.snapshots.length} snapshots -> .data/ingested.json`,
);
