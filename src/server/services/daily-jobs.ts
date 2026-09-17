import { shared } from "@/server/data/process-store";
import {
  ensureJobsSchema,
  postgresDriver,
  readJobRun,
  writeJobRun,
  type JobRun,
} from "@/server/data/postgres";
import { PLANS } from "./discovery-plan";
import {
  CATEGORY_PLAN,
  harvest,
  refreshInstagramStale,
  refreshStale,
  type DiscoveryQuery,
  type HarvestReport,
  type StaleRefreshReport,
} from "./harvest-service";
import { sendOpsEvent } from "./notification-service";

/* ---------------------------------------------------------------------------
 * The two things the database needs done every day, and a clock to do them.
 *
 * `snapshot` re-reads every account not yet read today, which is the only
 * way a growth history is ever built. `discover` runs the next few searches
 * of a fixed rotation so new creators keep arriving without anyone sweeping
 * by hand. Both spend the shared YouTube quota, so both are capped, run at
 * most once per UTC day, and record that they ran.
 *
 * Two ways to fire them. On a long-lived server, `startScheduler` (from
 * instrumentation.ts) checks every quarter hour whether today's runs are still
 * owed — a laptop that was asleep at the scheduled hour catches up when it
 * wakes. On Vercel, the cron routes under /api/internal/cron call the same
 * functions, and the same bookkeeping stops a route and a timer doubling up.
 * ------------------------------------------------------------------------ */

/**
 * YouTube's quota resets at midnight Pacific — 07:00 or 08:00 UTC. Running
 * after that means a day's budget is whole when the jobs start.
 */
export const JOBS_HOUR_UTC = Number(process.env.SOCIALORBIT_DAILY_JOBS_HOUR_UTC ?? 9);

/**
 * Searches per day. Ten is ~1,500 units with the reads behind them; the
 * snapshot pass over 2,400 accounts is ~5,000. Both fit a 10,000 budget with
 * room for operators.
 */
const SEARCHES_PER_DAY = Number(process.env.SOCIALORBIT_DISCOVERY_SEARCHES_PER_DAY ?? 10);

/** Every query the rotation walks: the category plan, then the places, then the places by size. */
export const ROTATION: DiscoveryQuery[] = [...CATEGORY_PLAN, ...PLANS.places, ...PLANS.top];

/**
 * Today's slice of the rotation, derived from the date rather than a stored
 * cursor: two servers, or a cron and a timer, pick the same queries for the
 * same day and the bookkeeping below stops the second from spending on them.
 */
export function queriesForDay(day: string, perDay = SEARCHES_PER_DAY): DiscoveryQuery[] {
  const index = Math.floor(new Date(`${day}T00:00:00Z`).getTime() / 86_400_000);
  const start = (index * perDay) % ROTATION.length;
  return Array.from({ length: Math.min(perDay, ROTATION.length) }, (_, i) => ROTATION[(start + i) % ROTATION.length]);
}

/* --- Bookkeeping -------------------------------------------------------- */

function memoryRuns(): Map<string, JobRun> {
  return shared("job_runs", () => new Map<string, JobRun>());
}

export async function lastRun(name: string): Promise<JobRun | null> {
  if (!postgresDriver()) return memoryRuns().get(name) ?? null;
  await ensureJobsSchema();
  return readJobRun(name);
}

async function recordRun(run: JobRun): Promise<void> {
  if (!postgresDriver()) {
    memoryRuns().set(run.name, run);
    return;
  }
  await ensureJobsSchema();
  await writeJobRun(run);
}

const today = (now: Date) => now.toISOString().slice(0, 10);

/* --- Jobs --------------------------------------------------------------- */

/**
 * Re-reads every account without a reading from today. A generous budget:
 * this is the long-lived-server version, and 2,400 channels take about
 * twenty minutes. The Vercel cron passes its own, smaller one.
 */
export async function runSnapshotJob(
  now = new Date(),
  options: { budgetMs?: number; maxChannels?: number } = {},
): Promise<StaleRefreshReport | null> {
  const day = today(now);
  if ((await lastRun("snapshot"))?.ranOn === day) return null;

  const maxChannels = options.maxChannels ?? 5_000;
  const report = await refreshStale({ budgetMs: options.budgetMs ?? 40 * 60_000, maxChannels });

  if (!snapshotCutShort(report, maxChannels)) await recordRun({ name: "snapshot", ranOn: day, report });

  // Instagram accounts, when the token is configured. A separate budget (its
  // own rate limit), so it neither waits for nor competes with the YouTube pass.
  const instagram = process.env.META_IG_TOKEN ? await refreshInstagramStale() : null;

  await sendOpsEvent("Daily snapshot", [
    `${report.ingested} creators refreshed, ${report.quotaUnitsSpent} quota units spent.`,
    ...(instagram ? [`Instagram: ${instagram.ingested} refreshed, ${instagram.remaining} still due.`] : []),
    report.remaining > 0
      ? `${report.remaining} still carrying an older reading.`
      : "Every account holds a reading from today.",
    ...(report.stoppedEarly ? [`Stopped early: ${report.stoppedEarly}`] : []),
  ]);
  return report;
}

/**
 * A pass cut short — by its time budget, by an unreachable API, or by its
 * channel cap with accounts still owed — is not today's run; the next tick or
 * cron call continues it. Anything else is: done, or the quota is gone for the
 * day. (Not simply "remaining === 0": a channel that hides its subscriber
 * count is refused on every read, and would keep the job re-running all day.)
 */
export function snapshotCutShort(
  report: Pick<StaleRefreshReport, "stoppedEarly" | "discovered" | "remaining">,
  maxChannels: number,
): boolean {
  const stopped = report.stoppedEarly;
  if (stopped && !stopped.includes("quota exhausted")) return true;
  return report.discovered === maxChannels && report.remaining > 0;
}

/** Runs today's slice of the discovery rotation. */
export async function runDiscoveryJob(now = new Date()): Promise<HarvestReport | null> {
  const day = today(now);
  if ((await lastRun("discover"))?.ranOn === day) return null;

  const queries = queriesForDay(day);
  const report = await harvest({ queries, target: 500 });
  await recordRun({ name: "discover", ranOn: day, report: { ...report, queries: queries.map((q) => q.q) } });

  await sendOpsEvent("Daily discovery", [
    `${queries.length} searches: ${report.discovered} channels found, ${report.ingested} new creators added, ${report.quotaUnitsSpent} quota units spent.`,
    ...(report.stoppedEarly ? [`Stopped early: ${report.stoppedEarly}`] : []),
  ]);
  return report;
}

/* --- Clock -------------------------------------------------------------- */

const TICK_MS = 15 * 60_000;

/**
 * Starts the in-process clock. Idempotent across hot reloads — the timer
 * lives on the process-wide store — and unref'd so it never keeps a process
 * alive on its own. Only runs on a server that has a YouTube key and asked
 * for it: a test run or a fresh clone must not spend quota by surprise.
 */
export function startScheduler(): void {
  if (process.env.SOCIALORBIT_DAILY_JOBS !== "true" || !process.env.YOUTUBE_API_KEY?.trim()) return;

  const state = shared("scheduler", () => ({ timer: null as NodeJS.Timeout | null, busy: false }));
  if (state.timer) return;

  const tick = async () => {
    const now = new Date();
    if (now.getUTCHours() < JOBS_HOUR_UTC || state.busy) return;
    state.busy = true;
    try {
      const snapshot = await runSnapshotJob(now);
      if (snapshot) console.log(`[jobs] snapshot: ${snapshot.ingested} read, ${snapshot.remaining} remaining`);
      const discovery = await runDiscoveryJob(now);
      if (discovery) console.log(`[jobs] discover: ${discovery.ingested} new creators`);
    } catch (error) {
      console.error(`[jobs] daily run failed: ${String(error)}`);
    } finally {
      state.busy = false;
    }
  };

  state.timer = setInterval(tick, TICK_MS);
  state.timer.unref();
  void tick();
  console.log(`[jobs] daily scheduler armed — runs after ${String(JOBS_HOUR_UTC).padStart(2, "0")}:00 UTC, ${SEARCHES_PER_DAY} searches/day`);
}
