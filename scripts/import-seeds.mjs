import { existsSync, readFileSync, writeFileSync } from "node:fs";

/*
 * Ingests channels from a seed list (scripts/seeds/*.txt) — ids, @handles or
 * URLs, one per line, `#` comments ignored. A hundred per request, so a quota
 * that runs out on the fortieth batch keeps the thirty-nine already paid for
 * and the log says where to resume.
 *
 * Cost: ~1 unit to resolve a handle (ids are free), ~2 to read each channel.
 *
 * Progress is kept in <file>.cursor so an unattended daily run (cron, after
 * the quota resets) picks up where the last one stopped; `--from N` overrides
 * it and `--limit N` caps the seeds one run may spend on.
 *
 * Usage: node scripts/import-seeds.mjs [file] [--from N] [--limit N]
 * Needs the app on APP_URL and the seed admin password in the env file.
 */

const envFile = [".env.production.local", ".env.local"].find((file) => existsSync(file)) ?? ".env.local";
const env = Object.fromEntries(
  readFileSync(envFile, "utf8")
    .split("\n")
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1).trim()]),
);
const APP_URL = process.env.APP_URL ?? env.APP_URL ?? "http://localhost:3000";
const args = process.argv.slice(2);
const file = args.find((arg) => !arg.startsWith("--") && !/^\d+$/.test(arg)) ?? "scripts/seeds/open-datasets.txt";
const cursorFile = `${file}.cursor`;
const from = args.includes("--from")
  ? Number(args[args.indexOf("--from") + 1]) || 0
  : Number(existsSync(cursorFile) ? readFileSync(cursorFile, "utf8") : 0) || 0;
const limit = args.includes("--limit") ? Number(args[args.indexOf("--limit") + 1]) || Infinity : Infinity;
const BATCH = 100;

const seeds = readFileSync(file, "utf8")
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith("#"));

async function login() {
  const response = await fetch(`${APP_URL}/api/internal/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "admin@senso360.com", password: env.DEV_SEED_PASSWORD }),
  });
  if (!response.ok) throw new Error(`login failed: ${response.status} ${await response.text()}`);
  const cookie = response.headers.get("set-cookie");
  if (!cookie) throw new Error("login set no cookie");
  return cookie.split(";")[0];
}

const cookie = await login();
let ingested = 0;
let spent = 0;

if (from >= seeds.length) {
  console.log(`done: every seed in ${file} has been imported`);
  process.exit(0);
}

for (let i = from; i < Math.min(seeds.length, from + limit); i += BATCH) {
  const started = Date.now();
  const response = await fetch(`${APP_URL}/api/internal/connectors/youtube/harvest`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ seeds: seeds.slice(i, i + BATCH), videos: 50 }),
  });
  const report = await response.json();
  if (!response.ok) {
    console.error(`[${i}] HTTP ${response.status}`, report);
    process.exit(1);
  }
  ingested += report.ingested;
  spent += report.quotaUnitsSpent;
  console.log(
    `[${i}/${seeds.length}] held ${String(report.alreadyHeld).padStart(3)}  new ${String(report.ingested).padStart(3)}  ` +
      `skipped ${String(report.skipped.length).padStart(3)}  ${String(report.quotaUnitsSpent).padStart(4)} units  ` +
      `${Math.round((Date.now() - started) / 1000)}s`,
  );
  if (report.stoppedEarly) {
    writeFileSync(cursorFile, String(i));
    console.error(`stopped: ${report.stoppedEarly}\nresume with --from ${i}`);
    break;
  }
  writeFileSync(cursorFile, String(i + BATCH));
}
console.log(`done: ${ingested} new creators, ${spent} quota units`);
