import { describe, expect, it } from "vitest";
import { ROTATION, queriesForDay, snapshotCutShort } from "./daily-jobs";

describe("queriesForDay", () => {
  it("walks the whole rotation, consecutive days taking consecutive slices", () => {
    const a = queriesForDay("2026-09-13", 10);
    const b = queriesForDay("2026-09-14", 10);
    expect(a).toHaveLength(10);
    expect(ROTATION.indexOf(b[0])).toBe((ROTATION.indexOf(a[0]) + 10) % ROTATION.length);
  });

  it("is a pure function of the date, so two runners agree", () => {
    expect(queriesForDay("2026-09-13", 10)).toEqual(queriesForDay("2026-09-13", 10));
  });

  it("covers every query within one full cycle", () => {
    const seen = new Set<string>();
    const days = Math.ceil(ROTATION.length / 10);
    for (let i = 0; i < days; i += 1) {
      const day = new Date(Date.UTC(2026, 8, 13 + i)).toISOString().slice(0, 10);
      for (const query of queriesForDay(day, 10)) seen.add(`${query.q}|${query.order}|${query.relevanceLanguage}`);
    }
    expect(seen.size).toBe(new Set(ROTATION.map((q) => `${q.q}|${q.order}|${q.relevanceLanguage}`)).size);
  });
});

describe("snapshotCutShort", () => {
  const base = { discovered: 100, remaining: 0 };
  it("records a finished pass, and one that hit the quota", () => {
    expect(snapshotCutShort({ ...base, stoppedEarly: null }, 200)).toBe(false);
    expect(snapshotCutShort({ ...base, remaining: 5, stoppedEarly: "YouTube daily quota exhausted: x" }, 200)).toBe(false);
    // Refused accounts stay owed forever; that is not a reason to re-run all day.
    expect(snapshotCutShort({ ...base, remaining: 3, stoppedEarly: null }, 200)).toBe(false);
  });
  it("does not record a pass stopped by time, an unreachable API, or the channel cap", () => {
    expect(snapshotCutShort({ ...base, stoppedEarly: "Time budget of 1ms reached." }, 200)).toBe(true);
    expect(snapshotCutShort({ ...base, stoppedEarly: "YouTube API unreachable: TypeError: fetch failed" }, 200)).toBe(true);
    expect(snapshotCutShort({ discovered: 200, remaining: 50, stoppedEarly: null }, 200)).toBe(true);
  });
});
