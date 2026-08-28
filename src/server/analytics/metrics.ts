/* ---------------------------------------------------------------------------
 * Deterministic analytics — DPR §19.
 *
 * Pure functions over observations. No I/O, no clock reads except where a
 * caller passes `now` in, no randomness. Everything higher in the product
 * depends on these being reproducible, so they are kept boring on purpose.
 * ------------------------------------------------------------------------ */

export const ANALYTICS_VERSION = "1.0.0";

/** Below this many observations a statistic is not reported at all. */
export const MIN_SAMPLE = 5;

export function median(values: number[]): number | null {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function mean(values: number[]): number | null {
  const finite = values.filter(Number.isFinite);
  if (finite.length === 0) return null;
  return finite.reduce((sum, value) => sum + value, 0) / finite.length;
}

export function stdDev(values: number[]): number | null {
  const finite = values.filter(Number.isFinite);
  if (finite.length < 2) return null;
  const avg = mean(finite)!;
  const variance =
    finite.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (finite.length - 1);
  return Math.sqrt(variance);
}

/**
 * Coefficient of variation — spread relative to level. Comparing raw standard
 * deviations across creators of different sizes would be meaningless.
 */
export function coefficientOfVariation(values: number[]): number | null {
  const avg = mean(values);
  const sd = stdDev(values);
  if (avg === null || sd === null || avg <= 0) return null;
  return sd / avg;
}

/** Map an unbounded value onto 0–100 where lower input is better. */
export function invertedScore(value: number, worstAt: number): number {
  if (!Number.isFinite(value) || worstAt <= 0) return 0;
  return clamp(100 * (1 - value / worstAt), 0, 100);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Percentage change between two points. Null when the base cannot support one. */
export function growthRate(current: number | null, prior: number | null): number | null {
  if (current === null || prior === null || prior <= 0) return null;
  return ((current - prior) / prior) * 100;
}

/* --- Engagement --------------------------------------------------------- */

export interface ContentObservation {
  publishedAt: string;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  durationSeconds: number | null;
}

/**
 * Interactions over the denominator the platform actually reports. YouTube
 * engagement is measured against views; Instagram against followers, since
 * reach is only available on authorized professional accounts. Using one
 * formula for both would make the two incomparable while looking comparable.
 */
export function engagementRate(
  content: ContentObservation[],
  denominator: { kind: "views" | "followers"; followers: number | null },
): number | null {
  const usable = content.filter((item) => item.views !== null || denominator.kind === "followers");
  if (usable.length < MIN_SAMPLE) return null;

  const rates = usable
    .map((item) => {
      const interactions = (item.likes ?? 0) + (item.comments ?? 0) + (item.shares ?? 0);
      const base =
        denominator.kind === "views" ? item.views : denominator.followers;
      if (!base || base <= 0) return null;
      return (interactions / base) * 100;
    })
    .filter((value): value is number => value !== null);

  return median(rates);
}

/** Median recent views as a share of audience size — DPR §19. */
export function viewsPerFollowerRatio(
  medianViews: number | null,
  followers: number | null,
): number | null {
  if (medianViews === null || !followers || followers <= 0) return null;
  return (medianViews / followers) * 100;
}

/* --- Publishing --------------------------------------------------------- */

/** Publications per week over the window the observations actually cover. */
export function uploadFrequency(
  content: ContentObservation[],
  now: Date = new Date(),
): number | null {
  if (content.length === 0) return null;
  const times = content
    .map((item) => new Date(item.publishedAt).getTime())
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  if (times.length < 2) return null;

  const spanMs = Math.max(now.getTime() - times[0], times[times.length - 1] - times[0]);
  const weeks = spanMs / (7 * 24 * 60 * 60 * 1000);
  if (weeks <= 0) return null;
  return times.length / weeks;
}

/**
 * Regularity of publishing intervals, 0–100. A creator posting every Tuesday
 * scores high; one posting five times in a week then nothing for two months
 * scores low even though both may average the same frequency.
 */
export function uploadConsistency(content: ContentObservation[]): number | null {
  const times = content
    .map((item) => new Date(item.publishedAt).getTime())
    .filter(Number.isFinite)
    .sort((a, b) => a - b);
  if (times.length < MIN_SAMPLE) return null;

  const gaps: number[] = [];
  for (let i = 1; i < times.length; i += 1) gaps.push(times[i] - times[i - 1]);

  const cv = coefficientOfVariation(gaps);
  if (cv === null) return null;
  // A CV of 0 is perfectly regular; 1.5 or above is effectively arrhythmic.
  return invertedScore(cv, 1.5);
}

export function daysSinceLastPublication(
  content: ContentObservation[],
  now: Date = new Date(),
): number | null {
  const times = content
    .map((item) => new Date(item.publishedAt).getTime())
    .filter(Number.isFinite);
  if (times.length === 0) return null;
  // Clamped at zero: a connector can return a video published seconds ago
  // while `now` lags behind it, and "published in the future" is not a
  // negative number of days since publication — it is none.
  const days = (now.getTime() - Math.max(...times)) / (24 * 60 * 60 * 1000);
  return Math.max(0, days);
}

export type ActivityStatusValue = "active" | "recently_active" | "slowing" | "dormant";

/**
 * Activity is judged against the creator's own cadence, not a fixed calendar.
 * A monthly creator two weeks out is fine; a daily creator two weeks out is not.
 */
export function activityStatus(
  content: ContentObservation[],
  now: Date = new Date(),
): ActivityStatusValue {
  const days = daysSinceLastPublication(content, now);
  if (days === null) return "dormant";
  if (days >= 90) return "dormant";

  const frequency = uploadFrequency(content, now);
  const expectedGapDays = frequency && frequency > 0 ? 7 / frequency : 30;

  if (days <= expectedGapDays * 1.5) return "active";
  if (days <= 30) return "recently_active";
  return "slowing";
}

/* --- Consistency & anomalies -------------------------------------------- */

/** How predictable recent view counts are, 0–100. */
export function viewConsistency(content: ContentObservation[]): number | null {
  const views = content
    .map((item) => item.views)
    .filter((value): value is number => value !== null && value > 0);
  if (views.length < MIN_SAMPLE) return null;

  const cv = coefficientOfVariation(views);
  if (cv === null) return null;
  // View counts are naturally skewed; 1.2 is where a catalogue stops being readable.
  return invertedScore(cv, 1.2);
}

export interface Anomaly {
  contentId: string;
  publishedAt: string;
  views: number;
  expected: number;
  /** Deviation in standard deviations from this creator's own baseline. */
  sigma: number;
  kind: "spike" | "collapse";
}

/**
 * Flags content outside this creator's own expected range. Compared against
 * their own history rather than a global threshold, and only once there are
 * enough observations for a baseline to mean anything.
 */
export function detectViewAnomalies(
  content: (ContentObservation & { id: string })[],
  threshold = 2.5,
): Anomaly[] {
  const withViews = content.filter(
    (item): item is ContentObservation & { id: string; views: number } =>
      item.views !== null && item.views > 0,
  );
  if (withViews.length < MIN_SAMPLE * 2) return [];

  const views = withViews.map((item) => item.views);
  const centre = median(views)!;
  const sd = stdDev(views);
  if (sd === null || sd === 0) return [];

  return withViews
    .map((item) => {
      const sigma = (item.views - centre) / sd;
      return {
        contentId: item.id,
        publishedAt: item.publishedAt,
        views: item.views,
        expected: Math.round(centre),
        sigma: Number(sigma.toFixed(2)),
        kind: sigma > 0 ? ("spike" as const) : ("collapse" as const),
      };
    })
    .filter((anomaly) => Math.abs(anomaly.sigma) >= threshold);
}

/** 0–100 where 100 means no unexplained deviation in the recent catalogue. */
export function viewAnomalyScore(
  content: (ContentObservation & { id: string })[],
): number | null {
  if (content.length < MIN_SAMPLE * 2) return null;
  const anomalies = detectViewAnomalies(content);
  const share = anomalies.length / content.length;
  return clamp(100 * (1 - share * 3), 0, 100);
}

/* --- Growth ------------------------------------------------------------- */

export interface SnapshotObservation {
  date: string;
  followers: number | null;
  views: number | null;
}

/**
 * Growth *pattern*, not growth rate: rewards steady accumulation and penalises
 * the sawtooth profile typical of purchased audience. Requires real history —
 * two snapshots cannot describe a pattern, so this returns null rather than
 * guessing.
 */
export function growthPatternScore(snapshots: SnapshotObservation[]): number | null {
  const series = snapshots
    .filter((point): point is SnapshotObservation & { followers: number } => point.followers !== null)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (series.length < 6) return null;

  const deltas: number[] = [];
  for (let i = 1; i < series.length; i += 1) {
    const previous = series[i - 1].followers;
    if (previous <= 0) continue;
    deltas.push(((series[i].followers - previous) / previous) * 100);
  }
  if (deltas.length < 4) return null;

  const avg = mean(deltas)!;
  const sd = stdDev(deltas) ?? 0;

  // Steadiness: how erratic period-on-period change is relative to its level.
  const volatility = Math.abs(avg) > 0.01 ? sd / Math.abs(avg) : sd;
  const steadiness = invertedScore(volatility, 4);

  // Direction: sustained decline is a real negative, flat is neutral.
  const trend = clamp(50 + avg * 8, 0, 100);

  // A single period more than 5σ from the rest is the classic purchased spike.
  const worstOutlier = sd > 0 ? Math.max(...deltas.map((d) => Math.abs(d - avg) / sd)) : 0;
  const spikePenalty = worstOutlier > 5 ? 20 : worstOutlier > 3.5 ? 10 : 0;

  return clamp(steadiness * 0.55 + trend * 0.45 - spikePenalty, 0, 100);
}

/** Change over a trailing window, using the nearest snapshot at or before the cutoff. */
export function gainedOverWindow(
  snapshots: SnapshotObservation[],
  field: "followers" | "views",
  days: number,
  now: Date = new Date(),
): number | null {
  const series = snapshots
    .filter((point) => point[field] !== null)
    .sort((a, b) => a.date.localeCompare(b.date));
  if (series.length < 2) return null;

  const cutoff = now.getTime() - days * 24 * 60 * 60 * 1000;
  const latest = series[series.length - 1];

  let prior: SnapshotObservation | null = null;
  for (const point of series) {
    if (new Date(point.date).getTime() <= cutoff) prior = point;
  }
  if (!prior) return null;

  const from = prior[field];
  const to = latest[field];
  if (from === null || to === null) return null;
  return to - from;
}
