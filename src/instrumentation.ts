/**
 * Runs once per server instance, before the first request is served.
 *
 * Under the Postgres driver the influencer database is loaded into the
 * process here — every read path is synchronous and scores from raw rows, so
 * the rows have to be present before a request can arrive. The development
 * driver loads its file lazily and needs nothing from this.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { warmIngestedStore } = await import("@/server/data/ingested-store");
  await warmIngestedStore();

  // Daily snapshots and discovery, when this server is the one meant to run
  // them (SOCIALORBIT_DAILY_JOBS=true). Vercel uses the cron routes instead.
  const { startScheduler } = await import("@/server/services/daily-jobs");
  startScheduler();
}
