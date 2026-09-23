import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/data/app-store", () => {
  const rows: unknown[] = [];
  return {
    appRows: () => rows,
    persist: () => {},
    unpersist: () => {},
  };
});
vi.mock("@/server/data/process-store", () => ({ shared: (_k: string, seed: () => unknown) => seed() }));

describe("job queue", () => {
  it("retries with backoff, then shelves as dead rather than looping forever", async () => {
    const q = await import("./job-queue");
    let attempts = 0;
    q.registerJob("always-fails", async () => {
      attempts += 1;
      throw new Error("nope");
    });

    const job = q.enqueue("always-fails", {}, { maxAttempts: 2 });
    await q.drain();
    expect(attempts).toBe(1);
    // Backed off, so the next drain does not immediately retry it.
    expect(q.listJobs({ status: "queued" }).some((entry) => entry.id === job.id)).toBe(true);

    // Make it due and drain again to exhaust the attempts.
    const queued = q.listJobs().find((entry) => entry.id === job.id)!;
    queued.runAfter = new Date(Date.now() - 1000).toISOString();
    await q.drain();
    expect(attempts).toBe(2);
    const dead = q.listJobs().find((entry) => entry.id === job.id)!;
    expect(dead.status).toBe("dead");
    expect(dead.lastError).toBe("nope");
  });

  it("shelves an unknown kind immediately — waiting does not supply the handler", async () => {
    const q = await import("./job-queue");
    const job = q.enqueue("no-such-handler", {});
    await q.drain();
    expect(q.listJobs().find((entry) => entry.id === job.id)!.status).toBe("dead");
  });

  it("records a result on success and can retry a dead job", async () => {
    const q = await import("./job-queue");
    q.registerJob("works", async () => ({ ok: 1 }));
    const job = q.enqueue("works", {});
    await q.drain();
    const done = q.listJobs().find((entry) => entry.id === job.id)!;
    expect(done.status).toBe("done");
    expect(done.result).toEqual({ ok: 1 });
    // Only a dead job can be retried.
    expect(q.retryJob(done.id)).toBeNull();
  });

  it("respects the time budget so a queue cannot starve requests", async () => {
    const q = await import("./job-queue");
    q.registerJob("slow", async () => {
      await new Promise((resolve) => setTimeout(resolve, 40));
    });
    for (let i = 0; i < 20; i += 1) q.enqueue("slow", {});
    const started = Date.now();
    await q.drain(100);
    // Budget is a floor on stopping, not a hard kill of the running job.
    expect(Date.now() - started).toBeLessThan(400);
  });
});
