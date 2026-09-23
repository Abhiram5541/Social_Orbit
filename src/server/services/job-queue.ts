import { appRows, persist, unpersist } from "@/server/data/app-store";
import { shared } from "@/server/data/process-store";

/* ---------------------------------------------------------------------------
 * Durable background jobs: retries, scheduling and a dead-letter shelf.
 *
 * Deliberately not Redis and not BullMQ. The requirement is durability,
 * retries, scheduling and failure handling — every one of which the existing
 * store already gives, because a job here is a row that survives a restart
 * exactly like a shortlist does. Redis buys distribution across processes,
 * and this deployment is one process by design (D42); adding a second piece
 * of infrastructure to get a feature the first one already has is the kind
 * of decision that looks like architecture and costs like architecture.
 *
 * What that trade-off gives up, and when to change it: a job runs in the web
 * process, so a very long job competes with requests — hence the slice
 * budget below. When SENSO runs more than one instance, or a job needs more
 * than a few seconds, move the runner to its own process against the same
 * table before reaching for a broker.
 *
 * ponytail: single-process queue over the app store; move to Redis + BullMQ
 * when a second instance exists or jobs outgrow the slice budget.
 * ------------------------------------------------------------------------ */

export const QUEUE_VERSION = "queue-1.0.0";

export type JobStatus = "queued" | "running" | "done" | "failed" | "dead";

export interface Job {
  id: string;
  kind: string;
  orgId: string | null;
  payload: Record<string, unknown>;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  /** Not picked up before this. Also how a retry backs off. */
  runAfter: string;
  lastError: string | null;
  result: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

type Handler = (job: Job) => Promise<Record<string, unknown> | void>;

const handlers = new Map<string, Handler>();

/** Registers what a job kind actually does. Idempotent across hot reloads. */
export function registerJob(kind: string, handler: Handler): void {
  handlers.set(kind, handler);
}

const jobs = () => appRows<Job>("jobs", () => []);

const nextId = () =>
  `job_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function enqueue(
  kind: string,
  payload: Record<string, unknown>,
  options: { orgId?: string | null; runAfter?: Date; maxAttempts?: number } = {},
): Job {
  const now = new Date().toISOString();
  const job: Job = {
    id: nextId(),
    kind,
    orgId: options.orgId ?? null,
    payload,
    status: "queued",
    attempts: 0,
    maxAttempts: options.maxAttempts ?? 3,
    runAfter: (options.runAfter ?? new Date()).toISOString(),
    lastError: null,
    result: null,
    createdAt: now,
    updatedAt: now,
  };
  jobs().push(job);
  persist("jobs", [job]);
  return job;
}

export function listJobs(filter: { orgId?: string | null; status?: JobStatus; kind?: string } = {}): Job[] {
  return jobs()
    .filter((job) => filter.orgId === undefined || job.orgId === filter.orgId)
    .filter((job) => !filter.status || job.status === filter.status)
    .filter((job) => !filter.kind || job.kind === filter.kind)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/** Exponential, so a failing dependency is not hammered: 30s, 2m, 8m… */
const backoffMs = (attempts: number) => Math.min(30 * 60_000, 30_000 * 4 ** (attempts - 1));

/**
 * Runs whatever is due, up to a time budget, then yields. The budget is what
 * keeps a queue inside a web process from starving requests.
 */
export async function drain(budgetMs = 3_000): Promise<{ ran: number; failed: number }> {
  const started = Date.now();
  let ran = 0;
  let failed = 0;
  const now = new Date().toISOString();

  for (const job of jobs()) {
    if (Date.now() - started > budgetMs) break;
    if (job.status !== "queued" || job.runAfter > now) continue;

    const handler = handlers.get(job.kind);
    if (!handler) {
      // An unknown kind is shelved rather than retried forever: the code that
      // handles it is missing, and no amount of waiting supplies it.
      job.status = "dead";
      job.lastError = `No handler registered for "${job.kind}".`;
      job.updatedAt = new Date().toISOString();
      persist("jobs", [job]);
      failed += 1;
      continue;
    }

    job.status = "running";
    job.attempts += 1;
    job.updatedAt = new Date().toISOString();
    persist("jobs", [job]);

    try {
      const result = (await handler(job)) ?? null;
      job.status = "done";
      job.result = result;
      job.lastError = null;
      ran += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      job.lastError = message;
      if (job.attempts >= job.maxAttempts) {
        // Dead, not deleted: a job nobody can see failing is a job that
        // silently stopped happening.
        job.status = "dead";
      } else {
        job.status = "queued";
        job.runAfter = new Date(Date.now() + backoffMs(job.attempts)).toISOString();
      }
      failed += 1;
    }
    job.updatedAt = new Date().toISOString();
    persist("jobs", [job]);
  }

  return { ran, failed };
}

/** Puts a dead job back in the queue, attempts reset. */
export function retryJob(id: string): Job | null {
  const job = jobs().find((entry) => entry.id === id);
  if (!job || job.status !== "dead") return null;
  job.status = "queued";
  job.attempts = 0;
  job.runAfter = new Date().toISOString();
  job.updatedAt = new Date().toISOString();
  persist("jobs", [job]);
  return job;
}

/** Clears finished jobs older than the cutoff so the table stays bounded. */
export function sweepJobs(olderThanDays = 30): number {
  const cutoff = new Date(Date.now() - olderThanDays * 86_400_000).toISOString();
  const stale = jobs().filter((job) => job.status === "done" && job.updatedAt < cutoff);
  if (stale.length === 0) return 0;
  const live = jobs().filter((job) => !stale.includes(job));
  jobs().length = 0;
  jobs().push(...live);
  unpersist("jobs", stale.map((job) => job.id));
  return stale.length;
}

/**
 * The runner. One timer per process, unref'd so it never holds a process
 * open, anchored on the process store so a hot reload does not start a
 * second one.
 */
export function startQueue(intervalMs = 15_000): void {
  const state = shared("job-queue", () => ({ timer: null as NodeJS.Timeout | null, busy: false }));
  if (state.timer) return;

  const tick = async () => {
    if (state.busy) return;
    state.busy = true;
    try {
      await drain();
    } catch (error) {
      console.error("[jobs] drain failed", error);
    } finally {
      state.busy = false;
    }
  };

  state.timer = setInterval(tick, intervalMs);
  state.timer.unref();
  void tick();
}
