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

  // One process, by design (CLAUDE.md D29/D42): the workspace read model,
  // sessions' rate limits and the scheduler all live in this process's
  // memory, and a second instance would answer from a copy that never sees
  // the first one's writes. PM2 numbers cluster workers from 0; refuse to be
  // anything but the first rather than serve stale data quietly.
  if (Number(process.env.NODE_APP_INSTANCE ?? 0) > 0) {
    throw new Error(
      "SENSO runs as a single process: its read model is in memory. Run one PM2 instance (fork mode); add Redis before scaling out.",
    );
  }
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
    digests: () => [],
    crm: () => [],
    outreach_templates: () => [],
    outreach_messages: () => [],
  });

  // Score every creator once now, in the background, so the first request
  // reads a finished list instead of taking the ten-second pass itself.
  const { warmSummaries } = await import("@/server/repositories/influencer-repository");
  void warmSummaries().catch((error: unknown) => console.error(`[scoring] warm failed: ${String(error)}`));

  // Daily snapshots and discovery, when this server is the one meant to run
  // them (SOCIALORBIT_DAILY_JOBS=true). Vercel uses the cron routes instead.
  const { startScheduler } = await import("@/server/services/daily-jobs");
  startScheduler();
}

/* ---------------------------------------------------------------------------
 * Error reporting without a vendor: every unhandled server error is posted to
 * the ops Slack channel (SLACK_WEBHOOK_URL), one message per distinct error
 * per ten minutes so a hot loop cannot flood the channel. Next calls this for
 * render, route-handler and middleware failures. Swap for Sentry by replacing
 * the body; the signature is Next's.
 * ------------------------------------------------------------------------ */

const reported = new Map<string, number>();

export async function onRequestError(
  error: unknown,
  request: { path: string; method: string },
  context: { routerKind: string; routePath: string; routeType: string },
): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const message = error instanceof Error ? error.message : String(error);
  const key = `${context.routePath}:${message}`;
  const now = Date.now();
  const last = reported.get(key) ?? 0;
  if (now - last < 10 * 60_000) return;
  reported.set(key, now);
  // Bounded: an app that throws many distinct errors is a bigger problem
  // than a map, but it should not also leak.
  if (reported.size > 500) reported.clear();

  const { sendSlack } = await import("@/server/services/notification-service");
  const stack = error instanceof Error && error.stack ? error.stack.split("\n").slice(0, 6).join("\n") : "";
  const host = process.env.APP_URL?.replace(/^https?:\/\//, "") ?? "unknown host";
  await sendSlack(
    `:rotating_light: *SENSO ${context.routeType} error* on ${host} \`${request.method} ${request.path}\` (${context.routePath})\n` +
      "```" + `${message}\n${stack}` + "```",
  ).catch(() => false);
}
