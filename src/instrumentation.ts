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

  // Workspace state — users, orgs, shortlists, campaigns, API keys, usage —
  // after the creators, because the seed rows point at creator ids.
  const { warmAppStore } = await import("@/server/data/app-store");
  const { seedUsers, seedOrgs } = await import("@/server/repositories/user-repository");
  const { seedWorkspace } = await import("@/server/repositories/workspace-repository");
  const { seedApiKeys } = await import("@/server/repositories/api-key-repository");
  const users = await seedUsers();
  await warmAppStore({
    users: () => users,
    orgs: seedOrgs,
    shortlists: seedWorkspace.shortlists,
    campaigns: seedWorkspace.campaigns,
    api_keys: seedApiKeys,
    usage: () => [],
  });

  // Daily snapshots and discovery, when this server is the one meant to run
  // them (SOCIALORBIT_DAILY_JOBS=true). Vercel uses the cron routes instead.
  const { startScheduler } = await import("@/server/services/daily-jobs");
  startScheduler();
}
