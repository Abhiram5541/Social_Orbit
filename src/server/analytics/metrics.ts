/* ---------------------------------------------------------------------------
 * Deterministic analytics — DPR §19.
 *
 * Pure functions over observations. No I/O, no clock reads except where a
 * caller passes `now` in, no randomness. Everything higher in the product
 * depends on these being reproducible, so they are kept boring on purpose.
 * ------------------------------------------------------------------------ */

export const ANALYTICS_VERSION = "1.1.0";

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
/**
 * Robust dispersion for positive, heavy-tailed data: log10 of the ratio between
 * the upper and lower quartile.
 *
 * View counts and upload gaps are log-normal, not normal — they vary
 * multiplicatively. A coefficient of variation uses the mean and standard
 * deviation, both of which one viral video distorts beyond use: measured
 * against this database, the median creator's view CV is 1.35 against a
 * threshold of 1.2, so most of them scored zero and the component measured
 * nothing.
 *
 * Quartiles ignore the tails, and the log turns "three times as many views"
 * into a fixed distance regardless of the channel's size. The result reads
 * directly: 0.30 means the upper quartile is twice the lower, 1.0 means ten
 * times.
 */
export function logSpread(values: number[]): number | null {
  const positive = values.filter((value) => value > 0).sort((a, b) => a - b);
  if (positive.length < MIN_SAMPLE) return null;

  const at = (fraction: number) => positive[Math.floor((positive.length - 1) * fraction)];
  const low = at(0.25);
  const high = at(0.75);
  if (low <= 0 || high <= 0) return null;

  return Math.log10(high / low);
}

/**
 * Spread in log space, using every point: the standard deviation of log10.
 *
 * Where `logSpread` deliberately ignores the tails, this one is meant to see
 * them. Which is right depends on what a tail *means*. For view counts a viral
 * upload is noise. For publishing intervals a long gap is the whole signal —
 * five uploads in a week and then eight months of silence is exactly the
 * pattern a cadence score exists to catch, and quartiles cannot see it: with
 * gaps of 1,1,1,1,1,240 the upper quartile is still 1.
 */
export function logStdDev(values: number[]): number | null {
  const positive = values.filter((value) => value > 0);
  if (positive.length < MIN_SAMPLE) return null;

  const logs = positive.map((value) => Math.log10(value));
  const average = logs.reduce((sum, value) => sum + value, 0) / logs.length;
  const variance =
    logs.reduce((sum, value) => sum + (value - average) ** 2, 0) / logs.length;

  return Math.sqrt(variance);
}

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

  const spread = logStdDev(gaps);
  if (spread === null) return null;

  // A log standard deviation of 1.0 means intervals routinely differ by an
  // order of magnitude — a schedule in name only. Across this database the
  // median creator measures 0.42 and the ninetieth percentile 0.71, so real
  // creators land between roughly 30 and 80 rather than bunched at either end.
  return invertedScore(spread, 1.0);
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

  const spread = logSpread(views);
  if (spread === null) return null;

  // 1.3 is a twenty-fold gap between the upper and lower quartile — a catalogue
  // with no readable typical performance. Measured across this database the
  // median creator sits at 0.53 and the ninetieth percentile at 0.93, so the
  // scale spreads real creators across its range instead of pinning them.
  return invertedScore(spread, 1.3);
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
/**
 * Reach trajectory read from a creator's own upload history.
 *
 * Snapshots are the right way to measure growth, but they only exist from the
 * day a platform starts taking them — a creator indexed last week has no past.
 * Their uploads do: every one carries a publish date and a view count, and both
 * are openly available. Comparing the older half of that history against the
 * newer half says whether reach is climbing or fading.
 *
 * Two corrections make it honest:
 *
 * Uploads younger than 30 days are excluded. Views are heavily front-loaded but
 * not instant, and a video published last week has not finished accruing them.
 *
 * The neutral point is 0.75, not 1.0. Even after that exclusion an older video
 * has had months longer to gather views, so a perfectly flat channel still
 * reads as a decline: measured across this database the median creator sits at
 * 0.75. Treating 1.0 as neutral would tell three-quarters of them they were
 * shrinking. The constant is empirical and belongs to this sampling window —
 * re-derive it if the number of uploads read per channel changes.
 *
 * This is a weaker instrument than a snapshot series and is used only until one
 * exists. Callers record which method produced the number.
 */
export const REACH_TREND_NEUTRAL = 0.75;

export function reachTrendScore(
  content: ContentObservation[],
  now: Date = new Date(),
): number | null {
  const settled = content
    .filter((item) => item.views !== null && item.views > 0)
    .filter((item) => {
      const age = now.getTime() - new Date(item.publishedAt).getTime();
      return Number.isFinite(age) && age > 30 * 86_400_000;
    })
    .sort((a, b) => a.publishedAt.localeCompare(b.publishedAt));

  // Too few uploads, or too short a window, and the two halves are the same
  // moment in the channel's life rather than two different ones.
  if (settled.length < 8) return null;
  const spanDays =
    (new Date(settled[settled.length - 1].publishedAt).getTime() -
      new Date(settled[0].publishedAt).getTime()) /
    86_400_000;
  if (spanDays < 90) return null;

  const half = Math.floor(settled.length / 2);
  const older = median(settled.slice(0, half).map((item) => item.views as number));
  const newer = median(settled.slice(-half).map((item) => item.views as number));
  if (older === null || newer === null || older <= 0 || newer <= 0) return null;

  // Every doubling against the neutral ratio is worth 25 points.
  return clamp(50 + 25 * Math.log2(newer / older / REACH_TREND_NEUTRAL), 0, 100);
}

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
export interface WindowGain {
  gained: number;
  /** Days actually spanned. Shorter than the window while history is still
   *  building, longer where snapshots are sparse. Always the real span. */
  days: number;
}

/**
 * Change in a counter over the last `days`, and the span it was measured over.
 *
 * The anchor is the oldest reading at or before the cutoff where one exists —
 * a true `days`-long delta. Where none does, because the account has been
 * observed for less time than the window, the oldest reading held is used and
 * the real span is returned with it. Refusing to answer until a full window
 * accumulates left every creator showing a dash for the first week of their
 * history while two perfectly good snapshots sat in the store; reporting the
 * short span as though it were the full one would have been the other, worse
 * failure. The caller labels the span it is given.
 */
export function gainedOverWindow(
  snapshots: SnapshotObservation[],
  field: "followers" | "views",
  days: number,
  now: Date = new Date(),
): WindowGain | null {
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
  // No reading predates the window: fall back to the oldest one held, which by
  // definition sits inside it.
  prior ??= series[0];
  if (prior === latest) return null;

  const from = prior[field];
  const to = latest[field];
  if (from === null || to === null) return null;

  const span =
    (new Date(latest.date).getTime() - new Date(prior.date).getTime()) / 86_400_000;
  if (!Number.isFinite(span) || span <= 0) return null;

  return { gained: to - from, days: Math.max(1, Math.round(span)) };
}
