import { readFileSync } from "node:fs";

/*
 * Sweeps YouTube for creators working out of Hyderabad, Bengaluru and
 * Rajahmundry, one search per request so a quota that runs out on the
 * thirtieth search keeps the twenty-nine already paid for and the log says
 * where to resume.
 *
 * The queries themselves live in src/server/services/discovery-plan.ts — the
 * same list the daily scheduler rotates through — so this and the scheduler
 * cannot disagree about what "the places" are.
 *
 * Usage: node scripts/harvest-places.mjs [--top] [--from N]
 *   --top   the view-count-ranked plan: the biggest channels that keep making
 *           content about the place. A second pass, not a first.
 * Needs the dev server on APP_URL and the seed admin password in .env.local.
 */

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => [line.slice(0, line.indexOf("=")), line.slice(line.indexOf("=") + 1).trim()]),
);
const APP_URL = env.APP_URL ?? "http://localhost:3000";
const plan = process.argv.includes("--top") ? "top" : "places";

async function login() {
  const response = await fetch(`${APP_URL}/api/internal/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "admin@socialorbit.io", password: env.DEV_SEED_PASSWORD }),
  });
  if (!response.ok) throw new Error(`login failed: ${response.status} ${await response.text()}`);
  const cookie = response.headers.get("set-cookie");
  if (!cookie) throw new Error("login set no cookie");
  return cookie.split(";")[0];
}

const from = Number(process.argv[process.argv.indexOf("--from") + 1] || 0) || 0;
const cookie = await login();
let ingested = 0;
let spent = 0;

for (let i = from; ; i += 1) {
  const started = Date.now();
  const response = await fetch(`${APP_URL}/api/internal/connectors/youtube/harvest`, {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({ plan, offset: i, limit: 1, target: 200, videos: 50 }),
  });
  const report = await response.json();
  if (!response.ok) {
    console.error(`[${i}] HTTP ${response.status}`, report);
    process.exit(1);
  }
  ingested += report.ingested;
  spent += report.quotaUnitsSpent;
  console.log(
    `[${i}] found ${String(report.discovered).padStart(3)}  new ${String(report.ingested).padStart(3)}  ` +
      `skipped ${report.skipped.length}  units ${report.quotaUnitsSpent}  ${((Date.now() - started) / 1000).toFixed(0)}s`,
  );
  if (report.stoppedEarly) {
    console.log(`stopped: ${report.stoppedEarly}`);
    console.log(`resume with: node scripts/harvest-places.mjs ${plan === "top" ? "--top " : ""}--from ${i}`);
    break;
  }
  if (report.planRemaining === 0) break;
}
console.log(`total new creators ${ingested}, quota units ${spent}`);
