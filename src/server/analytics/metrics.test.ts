import { describe, expect, it } from "vitest";
import {
  gainedOverWindow,
  logSpread,
  logStdDev,
  reachTrendScore,
  uploadConsistency,
  viewConsistency,
} from "./metrics";

/**
 * These two components measure how *predictable* a creator is, and both were
 * miscalibrated against real data: they used a coefficient of variation, which
 * assumes a roughly normal spread, on view counts and upload gaps that are
 * log-normal. One viral upload dragged the mean and standard deviation far
 * enough that the score floored at zero.
 *
 * Measured across the harvested database, the median creator's view CV was 1.35
 * against a cutoff of 1.2 — so more than half of them scored zero and the
 * component distinguished nobody from anybody.
 */

const views = (...counts: number[]) =>
  counts.map((value, index) => ({
    publishedAt: new Date(2026, 0, 1 + index * 7).toISOString(),
    views: value,
    likes: null,
    comments: null,
    shares: null,
    durationSeconds: null,
  }));

describe("logSpread", () => {
  it("reads as the ratio between the quartiles", () => {
    // Upper quartile ten times the lower is exactly 1.0 by construction.
    expect(logSpread([10, 10, 10, 100, 100, 100])).toBeCloseTo(1, 1);
    expect(logSpread([50, 50, 50, 100, 100, 100])).toBeCloseTo(Math.log10(2), 1);
  });

  it("is unmoved by a single extreme outlier", () => {
    const steady = [100, 110, 120, 130, 140, 150];
    const withViralHit = [...steady, 5_000_000];

    const before = logSpread(steady)!;
    const after = logSpread(withViralHit)!;

    // Quartiles ignore the tail. A coefficient of variation would roughly
    // quadruple here, which is exactly how the old formula floored real
    // creators who happened to have one hit.
    expect(Math.abs(after - before)).toBeLessThan(0.35);
  });

  it("returns null below the minimum sample", () => {
    expect(logSpread([1, 2, 3])).toBeNull();
  });
});

describe("viewConsistency", () => {
  it("rewards a creator whose uploads land in a narrow band", () => {
    const score = viewConsistency(views(100, 105, 110, 115, 120, 125))!;
    expect(score).toBeGreaterThan(85);
  });

  it("does not floor a steady creator who had one viral upload", () => {
    // The case the old formula got wrong. Five predictable uploads and one hit
    // is a readable catalogue, not an unreadable one.
    const score = viewConsistency(views(100, 110, 120, 130, 140, 4_000_000))!;
    expect(score).toBeGreaterThan(40);
  });

  it("still marks a genuinely erratic catalogue as inconsistent", () => {
    const score = viewConsistency(views(10, 50, 900, 40_000, 300, 2_000_000))!;
    expect(score).toBeLessThan(30);
  });

  it("is null below the minimum sample", () => {
    expect(viewConsistency(views(100, 200))).toBeNull();
  });
});

describe("logStdDev", () => {
  it("sees a tail that logSpread deliberately ignores", () => {
    // The same six intervals through both measures. Quartiles report no spread
    // at all, which is why cadence cannot use them.
    const bursty = [1, 1, 1, 1, 1, 240];
    expect(logSpread(bursty)).toBeCloseTo(0, 2);
    expect(logStdDev(bursty)!).toBeGreaterThan(0.8);
  });

  it("is zero for a perfectly regular series", () => {
    expect(logStdDev([7, 7, 7, 7, 7, 7])).toBeCloseTo(0, 6);
  });
});

describe("uploadConsistency", () => {
  const everyNDays = (days: number[], from = new Date(2026, 0, 1)) => {
    let cursor = from.getTime();
    return days.map((gap) => {
      cursor += gap * 86_400_000;
      return {
        publishedAt: new Date(cursor).toISOString(),
        views: 100,
        likes: null,
        comments: null,
        shares: null,
        durationSeconds: null,
      };
    });
  };

  it("rewards a creator who publishes to a schedule", () => {
    expect(uploadConsistency(everyNDays([7, 7, 7, 7, 7, 7]))!).toBeGreaterThan(90);
  });

  it("penalises one who publishes in bursts and then vanishes", () => {
    expect(uploadConsistency(everyNDays([1, 1, 1, 1, 1, 240]))!).toBeLessThan(50);
  });

  it("is null below the minimum sample", () => {
    expect(uploadConsistency(everyNDays([7, 7]))).toBeNull();
  });
});

describe("reachTrendScore", () => {
  const NOW = new Date("2026-09-01T00:00:00Z");

  /** Uploads spaced a month apart, oldest first, ending 60 days ago. */
  const history = (views: number[]) =>
    views.map((count, index) => ({
      publishedAt: new Date(
        NOW.getTime() - (60 + (views.length - 1 - index) * 30) * 86_400_000,
      ).toISOString(),
      views: count,
      likes: null,
      comments: null,
      shares: null,
      durationSeconds: null,
    }));

  it("treats the accumulation-adjusted neutral as the midpoint", () => {
    // Newer half at 0.75x the older half is what a flat channel looks like once
    // the older uploads' head start is accounted for.
    const flat = history([100, 100, 100, 100, 75, 75, 75, 75]);
    expect(reachTrendScore(flat, NOW)!).toBeCloseTo(50, 0);
  });

  it("scores a creator whose recent uploads outperform", () => {
    const rising = history([100, 100, 100, 100, 300, 300, 300, 300]);
    expect(reachTrendScore(rising, NOW)!).toBeGreaterThan(70);
  });

  it("scores a creator whose reach is genuinely fading", () => {
    const fading = history([1000, 1000, 1000, 1000, 100, 100, 100, 100]);
    expect(reachTrendScore(fading, NOW)!).toBeLessThan(30);
  });

  it("ignores uploads too recent to have finished accruing views", () => {
    // Eight settled uploads plus four published this week. Counting the fresh
    // ones would read their unaccrued views as collapsing reach.
    const settled = history([100, 100, 100, 100, 100, 100, 100, 100]);
    const brandNew = [1, 2, 3, 4].map((day) => ({
      publishedAt: new Date(NOW.getTime() - day * 86_400_000).toISOString(),
      views: 5,
      likes: null,
      comments: null,
      shares: null,
      durationSeconds: null,
    }));

    expect(reachTrendScore([...settled, ...brandNew], NOW)).toBe(
      reachTrendScore(settled, NOW),
    );
  });

  it("refuses a window too short or too sparse to mean anything", () => {
    expect(reachTrendScore(history([100, 100, 100]), NOW)).toBeNull();

    const sameWeek = [0, 1, 2, 3, 4, 5, 6, 7].map((day) => ({
      publishedAt: new Date(NOW.getTime() - (60 + day) * 86_400_000).toISOString(),
      views: 100,
      likes: null,
      comments: null,
      shares: null,
      durationSeconds: null,
    }));
    expect(reachTrendScore(sameWeek, NOW)).toBeNull();
  });
});

/**
 * The 7-day counters read `—` for all 627 harvested creators because this
 * function required an anchor snapshot *older* than the window, and daily
 * snapshotting had only been running four days. Two usable readings sat in the
 * store and the growth tab reported nothing from them.
 */
describe("gainedOverWindow", () => {
  const now = new Date("2026-09-01T00:00:00Z");
  const snapshot = (date: string, followers: number) => ({
    accountId: "a1",
    date,
    followers,
    views: followers * 10,
    contentCount: null,
  });

  it("measures over the real span when history is shorter than the window", () => {
    const gain = gainedOverWindow(
      [snapshot("2026-08-28", 1000), snapshot("2026-09-01", 1120)],
      "followers",
      7,
      now,
    );
    expect(gain).toEqual({ gained: 120, days: 4 });
  });

  it("anchors on the reading at or before the cutoff once one exists", () => {
    const gain = gainedOverWindow(
      [
        snapshot("2026-08-20", 900),
        snapshot("2026-08-25", 1000),
        snapshot("2026-09-01", 1120),
      ],
      "followers",
      7,
      now,
    );
    // 08-25 is the newest reading at or before the cutoff, not 08-20.
    expect(gain).toEqual({ gained: 120, days: 7 });
  });

  it("reports the true span rather than the nominal window when snapshots are sparse", () => {
    const gain = gainedOverWindow(
      [snapshot("2026-08-02", 900), snapshot("2026-09-01", 1200)],
      "followers",
      7,
      now,
    );
    expect(gain).toEqual({ gained: 300, days: 30 });
  });

  it("stays null on a single reading — one point is not a delta", () => {
    expect(gainedOverWindow([snapshot("2026-09-01", 1000)], "followers", 7, now)).toBeNull();
  });
});
