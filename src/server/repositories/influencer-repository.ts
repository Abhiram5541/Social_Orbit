import type {
  ActivityStatus,
  Category,
  DataConfidence,
  Platform,
  Provenance,
  VerificationStatus,
} from "@/lib/contracts/common";
import type {
  AiProfileIntelligence,
  AudienceBreakdown,
  BenchmarkPosition,
  ContentItem,
  HistorySeries,
  InfluencerProfile,
  InfluencerSummary,
  ProfileGlance,
  SocialAccount,
} from "@/lib/contracts/influencer";
import type { RiskSignals } from "@/lib/contracts/score";
import {
  activityStatus,
  clamp,
  daysSinceLastPublication,
  detectViewAnomalies,
  engagementRate,
  gainedOverWindow,
  growthPatternScore,
  mean,
  median,
  uploadConsistency,
  uploadFrequency,
  viewAnomalyScore,
  viewConsistency,
  viewsPerFollowerRatio,
} from "@/server/analytics/metrics";
import {
  computeCampaignFit,
  computeConfidence,
  computeHealthScore,
  computeRiskSignals,
  normaliseAudienceActivity,
  normaliseAuthenticity,
  normaliseEngagementQuality,
  normaliseEngagementRate,
  type HealthEvidence,
} from "@/server/scoring/formulas";
import { ingestedRevision } from "@/server/data/ingested-store";
import {
  readRecords,
  EPOCH,
  type DataView,
  type RawAccount,
  type RawContent,
  type RawInfluencer,
  type RawSnapshot,
} from "@/server/data/records";
import { FOLLOWER_BANDS, type FollowerBand } from "@/lib/contracts/search";

/* ---------------------------------------------------------------------------
 * Influencer repository.
 *
 * The only module in the codebase that touches the data driver. Everything it
 * returns has been through the real analytics and scoring engines — nothing is
 * read pre-computed from the fixtures, so swapping in PostgreSQL changes the
 * source of the raw rows and nothing else.
 *
 * The influencer database is global (CLAUDE.md D1): these reads are not
 * tenant-scoped. Tenant isolation applies to shortlists, campaigns and reports.
 * ------------------------------------------------------------------------ */

/** Snapshots required before a trend line is drawn rather than described. */
const MIN_HISTORY_POINTS = 8;

/**
 * Creators required in a category/size cohort before it can produce a
 * benchmark. A percentile against two other accounts is noise wearing the
 * costume of a statistic, and it would be the most quotable number on the page.
 */
const MIN_COHORT_SIZE = 8;

interface Assembled {
  raw: RawInfluencer;
  accounts: RawAccount[];
  primary: RawAccount;
  content: RawContent[];
  snapshots: RawSnapshot[];
}

/**
 * Rows grouped by owner, built once per revision.
 *
 * `assemble` runs once per creator, and a collection read runs it for the whole
 * database — so scanning the content table inside it is quadratic. At fixture
 * scale that was invisible; against a real harvest it is 600 creators times
 * 30,000 content rows on every request. Grouping first makes it linear.
 */
interface Index {
  influencers: Map<string, RawInfluencer>;
  accounts: Map<string, RawAccount[]>;
  content: Map<string, RawContent[]>;
  snapshots: Map<string, RawSnapshot[]>;
}

let indexCache: { data: DataView; index: Index } | null = null;

function groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const bucket = grouped.get(key(row));
    if (bucket) bucket.push(row);
    else grouped.set(key(row), [row]);
  }
  return grouped;
}

function index(): Index {
  const data = readRecords();
  // `readRecords()` returns the same object until the store changes, so identity
  // is the revision check.
  if (indexCache?.data === data) return indexCache.index;

  const built: Index = {
    influencers: new Map(data.influencers.map((row) => [row.id, row])),
    accounts: groupBy(data.accounts, (row) => row.influencerId),
    content: groupBy(data.content, (row) => row.influencerId),
    snapshots: groupBy(data.snapshots, (row) => row.accountId),
  };
  indexCache = { data, index: built };
  return built;
}

function assemble(id: string): Assembled | null {
  const rows = index();
  const raw = rows.influencers.get(id);
  if (!raw) return null;

  const accounts = rows.accounts.get(id) ?? [];
  const primary = accounts.find((account) => account.isPrimary) ?? accounts[0];
  if (!primary) return null;

  return {
    raw,
    accounts,
    primary,
    content: rows.content.get(id) ?? [],
    snapshots: accounts.flatMap((account) => rows.snapshots.get(account.id) ?? []),
  };
}

/* --- Derived analytics -------------------------------------------------- */

interface Derived {
  medianViews: number | null;
  averageViews: number | null;
  engagementRatePct: number | null;
  uploadFrequencyPerWeek: number | null;
  uploadConsistencyScore: number | null;
  viewConsistencyScore: number | null;
  viewAnomaly: number | null;
  growthPattern: number | null;
  viewsPerFollower: number | null;
  activity: ActivityStatus;
  dormantDays: number | null;
  followersGained7d: number | null;
  viewsGained7d: number | null;
  averageDuration: number | null;
}

function derive(record: Assembled, now: Date): Derived {
  const primaryContent = record.content.filter(
    (item) => item.accountId === record.primary.id,
  );
  const views = primaryContent
    .map((item) => item.views)
    .filter((value): value is number => value !== null);

  const primarySnapshots = record.snapshots.filter(
    (point) => point.accountId === record.primary.id,
  );

  const medianViews = median(views);

  return {
    medianViews: medianViews === null ? null : Math.round(medianViews),
    averageViews: views.length ? Math.round(mean(views)!) : null,
    engagementRatePct: engagementRate(primaryContent, {
      // YouTube reports views for every item; Instagram reach is only
      // available on authorized accounts, so followers is the honest base.
      kind: record.primary.platform === "youtube" ? "views" : "followers",
      followers: record.primary.followers,
    }),
    uploadFrequencyPerWeek: uploadFrequency(primaryContent, now),
    uploadConsistencyScore: uploadConsistency(primaryContent),
    viewConsistencyScore: viewConsistency(primaryContent),
    viewAnomaly: viewAnomalyScore(primaryContent),
    growthPattern: growthPatternScore(primarySnapshots),
    viewsPerFollower: viewsPerFollowerRatio(medianViews, record.primary.followers),
    activity: activityStatus(primaryContent, now),
    dormantDays: daysSinceLastPublication(primaryContent, now),
    followersGained7d: gainedOverWindow(primarySnapshots, "followers", 7, now),
    viewsGained7d: gainedOverWindow(primarySnapshots, "views", 7, now),
    averageDuration: mean(
      primaryContent
        .map((item) => item.durationSeconds)
        .filter((value): value is number => value !== null),
    ),
  };
}

/* --- Cohort benchmarks -------------------------------------------------- */

interface Cohort {
  key: string;
  size: number;
  engagementMedian: number | null;
  viewsPerFollowerMedian: number | null;
  medianViewsMedian: number | null;
  healthValues: number[];
}

function followerBandOf(followers: number | null): FollowerBand {
  if (followers === null) return "nano";
  for (const band of ["nano", "micro", "mid", "macro"] as const) {
    const { max } = FOLLOWER_BANDS[band];
    if (max !== null && followers < max) return band;
  }
  return "mega";
}

/**
 * Benchmarks are computed across the whole database in one pass and cached.
 * Scoring depends on them, so this must run before any score is normalised —
 * an engagement rate means nothing without the cohort it is measured against.
 */
/**
 * Rebuilt whenever the record set changes. Ingesting a creator moves the
 * medians every other creator in their cohort is normalised against, so a
 * cache that outlived a write would score the whole band against a database
 * that no longer exists — and withhold the benchmark of the creator that had
 * just completed the cohort.
 */
let cohortCache: { revision: number; map: Map<string, Cohort> } | null = null;

function cohorts(now: Date): Map<string, Cohort> {
  const revision = ingestedRevision();
  if (cohortCache?.revision === revision) return cohortCache.map;

  const buckets = new Map<string, { engagement: number[]; vpf: number[]; medianViews: number[] }>();
  for (const raw of readRecords().influencers) {
    const record = assemble(raw.id);
    if (!record) continue;
    const derived = derive(record, now);
    const key = `${raw.categories[0]}:${followerBandOf(record.primary.followers)}`;
    const bucket = buckets.get(key) ?? { engagement: [], vpf: [], medianViews: [] };
    if (derived.engagementRatePct !== null) bucket.engagement.push(derived.engagementRatePct);
    if (derived.viewsPerFollower !== null) bucket.vpf.push(derived.viewsPerFollower);
    if (derived.medianViews !== null) bucket.medianViews.push(derived.medianViews);
    buckets.set(key, bucket);
  }

  const map = new Map<string, Cohort>(
    [...buckets].map(([key, bucket]) => [
      key,
      {
        key,
        size: Math.max(bucket.engagement.length, bucket.vpf.length),
        engagementMedian: median(bucket.engagement),
        viewsPerFollowerMedian: median(bucket.vpf),
        medianViewsMedian: median(bucket.medianViews),
        healthValues: [],
      },
    ]),
  );
  cohortCache = { revision, map };
  return map;
}

function cohortFor(record: Assembled, now: Date): Cohort | null {
  const key = `${record.raw.categories[0]}:${followerBandOf(record.primary.followers)}`;
  return cohorts(now).get(key) ?? null;
}

/* --- Provenance --------------------------------------------------------- */

function observedProvenance(record: Assembled, confidence: number): Provenance {
  const authorized = record.primary.isConnected;
  return {
    tier: authorized ? "oauth_authorized" : "platform_api",
    kind: authorized ? "verified" : "observed",
    collectedAt: record.primary.lastSyncedAt,
    verifiedAt: authorized && record.raw.identityMatched ? record.primary.connectedAt : null,
    sourceUrl: record.primary.url,
    confidence,
    ai: null,
  };
}

function derivedProvenance(record: Assembled, confidence: number): Provenance {
  return {
    tier: "platform_api",
    kind: "derived",
    collectedAt: record.primary.lastSyncedAt,
    verifiedAt: null,
    sourceUrl: null,
    confidence,
    ai: null,
  };
}

function estimatedProvenance(record: Assembled): Provenance {
  return {
    tier: "ai_inference",
    kind: "estimated",
    collectedAt: record.primary.lastSyncedAt,
    verifiedAt: null,
    sourceUrl: null,
    confidence: 45,
    ai: null,
  };
}

function verificationOf(raw: RawInfluencer): VerificationStatus {
  if (raw.isConnected && raw.identityMatched) return "verified";
  if (raw.isConnected) return "pending";
  return "unverified";
}

/* --- Score assembly ----------------------------------------------------- */

function scoreOf(record: Assembled, now: Date) {
  const data = readRecords();
  const derived = derive(record, now);
  const cohort = cohortFor(record, now);
  // Both are absent for a creator ingested from a public API: bot-risk signals
  // are not observable without authorized access, and no model has classified
  // them. Absent stays absent — the scoring engine renormalises around an
  // unmeasurable component, which is the whole reason it tracks availability.
  const signals = data.signals.get(record.raw.id) ?? null;
  const ai = data.ai.get(record.raw.id) ?? null;

  const engagementRateScore = normaliseEngagementRate(
    derived.engagementRatePct,
    cohort?.engagementMedian ?? null,
  );
  const audienceActivity = normaliseAudienceActivity(
    derived.viewsPerFollower,
    cohort?.viewsPerFollowerMedian ?? null,
  );
  const authenticity = normaliseAuthenticity(
    signals?.botRisk ?? null,
    signals?.inactiveAudience ?? null,
  );
  const engagementQuality = normaliseEngagementQuality(
    engagementRateScore,
    ai?.commentQuality ?? null,
    audienceActivity,
  );

  const evidence: HealthEvidence = {
    engagementRate: {
      medianEngagementRate: derived.engagementRatePct,
      cohortMedian: cohort?.engagementMedian ?? null,
      cohortSize: cohort?.size ?? null,
    },
    authenticity: {
      botRisk: signals?.botRisk ?? null,
      inactiveAudience: signals?.inactiveAudience ?? null,
    },
    audienceActivity: {
      viewsPerFollowerRatio: derived.viewsPerFollower,
      cohortMedian: cohort?.viewsPerFollowerMedian ?? null,
    },
    growthPattern: { snapshotsObserved: record.snapshots.length },
    viewConsistency: { contentObserved: record.content.length },
    uploadConsistency: { uploadsPerWeek: derived.uploadFrequencyPerWeek },
    commentQuality: { aiCommentQuality: ai?.commentQuality ?? null },
    brandSafety: { aiBrandSafety: ai?.brandSafetyScore ?? null },
    engagementQuality: {
      engagementRateScore,
      commentQuality: ai?.commentQuality ?? null,
      audienceActivity,
    },
  };

  const health = computeHealthScore(
    {
      authenticity,
      engagementQuality,
      engagementRate: engagementRateScore,
      growthPattern: derived.growthPattern,
      viewConsistency: derived.viewConsistencyScore,
      audienceActivity,
      commentQuality: ai?.commentQuality ?? null,
      uploadConsistency: derived.uploadConsistencyScore,
      brandSafety: ai?.brandSafetyScore ?? null,
    },
    evidence,
    now,
  );

  const risk = computeRiskSignals(
    {
      botRisk: signals?.botRisk ?? null,
      inactiveAudience: signals?.inactiveAudience ?? null,
      viewAnomaly: derived.viewAnomaly,
      brandSafety: ai?.brandSafetyScore ?? null,
    },
    signals?.evidence ?? [],
    now,
  );

  const fit = computeCampaignFit(
    {
      categoryBenchmark: clamp(health.value, 0, 100),
      // Null, not zero. `computeCampaignFit` drops an unmeasurable component
      // and renormalises; a zero would score "we could not measure this" the
      // same as "this is as bad as it gets".
      engagementQuality,
      audienceFit: authenticity,
      commercialIntent: ai?.commercialIntent ?? null,
      // Null until a client supplies real campaign outcomes — never guessed.
      historicalCampaignPerformance: null,
      costEfficiency: null,
    },
    now,
  );

  return { derived, cohort, health, risk, fit, signals, ai };
}

function confidenceOf(
  record: Assembled,
  hasAudience: boolean,
  now: Date,
): DataConfidence {
  // The provenance mix has to describe *this* profile. A creator no model has
  // classified contains no inferred facts, and reporting a 14% AI share for
  // them would misdescribe the very thing the readout exists to disclose.
  const hasAi = readRecords().ai.has(record.raw.id);
  const snapshotCount = record.snapshots.filter(
    (point) => point.accountId === record.primary.id,
  ).length;

  const expectedFields = [
    record.raw.bio,
    record.raw.countryCode,
    record.raw.languages.length ? "y" : null,
    record.raw.categories.length ? "y" : null,
    record.primary.totalViews,
    record.primary.followers,
    hasAudience ? "y" : null,
  ];
  const fieldCompleteness =
    expectedFields.filter((value) => value !== null && value !== undefined).length /
    expectedFields.length;

  const hoursSinceRefresh =
    (now.getTime() - new Date(record.raw.lastRefreshedAt).getTime()) / 3_600_000;

  // The mix describes what the reader is actually looking at, so it has to
  // reflect this profile's real composition rather than a fixed split.
  const verified = record.raw.isConnected && record.raw.identityMatched ? 22 : 0;
  const observed = 62 - verified * 0.4;
  const inferred = hasAi ? 14 : 0;
  const estimated = 6;
  const derivedShare = Math.max(0, 100 - verified - observed - inferred - estimated);

  return computeConfidence(
    {
      fieldCompleteness,
      snapshotCount,
      hasAuthorizedSource: record.raw.isConnected && record.raw.identityMatched,
      hasPlatformApiSource: true,
      observationCount: record.content.length,
      hoursSinceRefresh,
      conflictCount: record.raw.conflictCount,
      mix: {
        verified: Number(verified.toFixed(1)),
        observed: Number(observed.toFixed(1)),
        derived: Number(derivedShare.toFixed(1)),
        estimated,
        inferred,
      },
    },
    now,
  );
}

/* --- Public reads ------------------------------------------------------- */

export function toSummary(id: string, now: Date = EPOCH): InfluencerSummary | null {
  const record = assemble(id);
  if (!record) return null;
  const { derived, health, risk, fit } = scoreOf(record, now);
  const confidence = confidenceOf(record, readRecords().audience.has(id), now);

  return {
    id: record.raw.id,
    displayName: record.raw.displayName,
    primaryHandle: record.raw.primaryHandle,
    avatarUrl: record.raw.avatarUrl,
    verification: verificationOf(record.raw),
    platforms: record.accounts.map((account) => account.platform),
    primaryPlatform: record.primary.platform,
    followers: record.primary.followers,
    medianViews: derived.medianViews,
    engagementRate:
      derived.engagementRatePct === null
        ? null
        : Number(derived.engagementRatePct.toFixed(2)),
    healthScore: health.weightCovered > 0 ? health.value : null,
    campaignFit: fit.value,
    risk: risk.level,
    categories: record.raw.categories,
    countryCode: record.raw.countryCode,
    countryName: record.raw.countryName,
    languages: record.raw.languages,
    activity: derived.activity,
    lastActiveAt:
      derived.dormantDays === null
        ? null
        : new Date(now.getTime() - derived.dormantDays * 86_400_000).toISOString(),
    confidence: confidence.score,
  };
}

function historySeries(snapshots: RawSnapshot[]): HistorySeries {
  const points = [...snapshots]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((point) => ({
      date: point.date,
      followers: point.followers,
      views: point.views,
      engagementRate: null,
      contentCount: point.contentCount,
    }));

  return {
    points,
    minimumPoints: MIN_HISTORY_POINTS,
    sufficient: points.length >= MIN_HISTORY_POINTS,
    firstObservedAt: points.length ? new Date(points[0].date).toISOString() : null,
  };
}

function toContentItem(raw: RawContent, medianViews: number | null): ContentItem {
  // A creator who hides likes and disables comments has no *observed*
  // interactions, which is not the same as zero interactions. Summing the
  // absent ones as zero would publish a confident 0.0% engagement rate.
  const counted = [raw.likes, raw.comments, raw.shares].filter(
    (value): value is number => value !== null,
  );
  const interactions = counted.reduce((sum, value) => sum + value, 0);
  const base = raw.platform === "youtube" ? raw.views : null;
  return {
    id: raw.id,
    platform: raw.platform,
    title: raw.title,
    url: raw.url,
    thumbnailUrl: raw.thumbnailUrl,
    publishedAt: raw.publishedAt,
    views: raw.views,
    likes: raw.likes,
    comments: raw.comments,
    shares: raw.shares,
    durationSeconds: raw.durationSeconds,
    engagementRate:
      counted.length > 0 && base && base > 0
        ? Number(((interactions / base) * 100).toFixed(2))
        : null,
    performanceIndex:
      raw.views !== null && medianViews && medianViews > 0
        ? Number((raw.views / medianViews).toFixed(2))
        : null,
    isAnomalous: false,
    isSponsored: raw.isSponsored,
  };
}

export function toProfile(id: string, now: Date = EPOCH): InfluencerProfile | null {
  const summary = toSummary(id, now);
  const record = assemble(id);
  if (!summary || !record) return null;

  const data = readRecords();
  const { derived, cohort, health, risk, fit, ai } = scoreOf(record, now);
  const rawAudience = data.audience.get(id) ?? null;
  const confidence = confidenceOf(record, Boolean(rawAudience), now);

  const primarySnapshots = record.snapshots.filter(
    (point) => point.accountId === record.primary.id,
  );
  const primaryContent = record.content
    .filter((item) => item.accountId === record.primary.id)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

  const socialAccounts: SocialAccount[] = record.accounts.map((account) => ({
    id: account.id,
    platform: account.platform,
    platformAccountId: account.platformAccountId,
    handle: account.handle,
    url: account.url,
    isPrimary: account.isPrimary,
    isConnected: account.isConnected,
    connectedAt: account.connectedAt,
    needsReauth: account.needsReauth,
    followers: account.followers,
    lastSyncedAt: account.lastSyncedAt,
  }));

  const glance: ProfileGlance = {
    followers: record.primary.followers,
    totalViews: record.primary.totalViews,
    contentCount: record.primary.contentCount,
    medianViews: derived.medianViews,
    averageViews: derived.averageViews,
    viewsGained7d: derived.viewsGained7d,
    followersGained7d: derived.followersGained7d,
    uploadFrequency:
      derived.uploadFrequencyPerWeek === null
        ? null
        : Number(derived.uploadFrequencyPerWeek.toFixed(2)),
    averageContentLength:
      derived.averageDuration === null ? null : Math.round(derived.averageDuration),
    engagementRate: summary.engagementRate,
    // Explicitly modelled, and rendered with an estimate label everywhere.
    estimatedMonthlyEarnings:
      derived.medianViews === null || derived.uploadFrequencyPerWeek === null
        ? null
        : {
            currency: "USD",
            low: Math.round(derived.medianViews * derived.uploadFrequencyPerWeek * 4.3 * 0.0012),
            high: Math.round(derived.medianViews * derived.uploadFrequencyPerWeek * 4.3 * 0.0055),
          },
    estimatedMonthlyReach:
      derived.medianViews === null || derived.uploadFrequencyPerWeek === null
        ? null
        : Math.round(derived.medianViews * derived.uploadFrequencyPerWeek * 4.3),
  };

  const audience: AudienceBreakdown = rawAudience
    ? {
        available: true,
        reason: null,
        countries: rawAudience.countries,
        languages: rawAudience.languages,
        ageBands: rawAudience.ageBands,
        gender: rawAudience.gender,
        provenance: {
          tier: "oauth_authorized",
          kind: "verified",
          collectedAt: rawAudience.collectedAt,
          verifiedAt: rawAudience.collectedAt,
          sourceUrl: null,
          confidence: 92,
          ai: null,
        },
      }
    : {
        available: false,
        reason:
          "Audience demographics require the creator to connect a professional account. " +
          "SocialOrbit does not estimate demographics from public data.",
        countries: [],
        languages: [],
        ageBands: [],
        gender: [],
        provenance: null,
      };

  const aiIntelligence: AiProfileIntelligence | null = ai === null ? null : {
    summary: buildSummary(record.raw, summary, derived),
    signalReading: buildSignalReading(record.raw, summary, derived, risk, health.value),
    creatorType: ai.creatorType,
    contentThemes: ai.contentThemes,
    audienceIntent: ai.audienceIntent,
    commercialIntent: ai.commercialIntent,
    brandSafetyScore: ai.brandSafetyScore,
    sponsorshipSignals: ai.sponsorshipSignals,
    recommendedIndustries: ai.recommendedIndustries,
    strengths: ai.strengths,
    risks: ai.risks,
    evidence: ai.evidence,
    provider: ai.provider,
    model: ai.model,
    promptVersion: ai.promptVersion,
    schemaVersion: ai.schemaVersion,
    generatedAt: ai.generatedAt,
  };

  const benchmarks: BenchmarkPosition | null =
    cohort && cohort.size >= MIN_COHORT_SIZE
    ? {
        category: record.raw.categories[0] as Category,
        followerBand: FOLLOWER_BANDS[followerBandOf(record.primary.followers)].label,
        cohortSize: cohort.size,
        metrics: [
          benchmarkMetric(
            "engagement_rate",
            "Engagement rate",
            summary.engagementRate,
            cohort.engagementMedian,
            true,
          ),
          benchmarkMetric(
            "median_views",
            "Median views",
            derived.medianViews,
            cohort.medianViewsMedian,
            true,
          ),
          benchmarkMetric(
            "views_per_follower",
            "Views per 100 followers",
            derived.viewsPerFollower,
            cohort.viewsPerFollowerMedian,
            true,
          ),
        ].filter((metric): metric is NonNullable<typeof metric> => metric !== null),
        computedAt: now.toISOString(),
      }
    : null;

  const anomalyIds = new Set(
    detectViewAnomalies(primaryContent).map((anomaly) => anomaly.contentId),
  );

  return {
    ...summary,
    bio: record.raw.bio,
    status: record.raw.status,
    socialAccounts,
    glance,
    health,
    riskSignals: risk,
    fit,
    confidenceDetail: confidence,
    ai: aiIntelligence,
    audience,
    benchmarks,
    topContent: [...primaryContent]
      .filter((item) => item.views !== null)
      .sort((a, b) => (b.views ?? 0) - (a.views ?? 0))
      .slice(0, 6)
      .map((item) => toContentItem(item, derived.medianViews)),
    recentContent: primaryContent.slice(0, 12).map((item) => ({
      ...toContentItem(item, derived.medianViews),
      // A flagged item keeps its real index; the flag itself rides along so the
      // UI can mark it rather than the finding disappearing into a score.
      isAnomalous: anomalyIds.has(item.id),
    })),
    followerHistory: historySeries(primarySnapshots),
    engagementHistory: historySeries(primarySnapshots),
    lastRefreshedAt: record.raw.lastRefreshedAt,
    createdAt: record.raw.createdAt,
  };
}

function benchmarkMetric(
  key: string,
  label: string,
  value: number | null,
  cohortMedian: number | null,
  higherIsBetter: boolean,
) {
  if (value === null || cohortMedian === null || cohortMedian <= 0) return null;
  const ratio = value / cohortMedian;
  return {
    key,
    label,
    value: Number(value.toFixed(2)),
    categoryMedian: Number(cohortMedian.toFixed(2)),
    top25: Number((cohortMedian * 1.5).toFixed(2)),
    top10: Number((cohortMedian * 2.2).toFixed(2)),
    percentile: Number(clamp(50 * Math.min(ratio, 1) + 50 * clamp((ratio - 1) / 1.4, 0, 1), 1, 99).toFixed(0)),
    higherIsBetter,
  };
}

/* --- Narrative ---------------------------------------------------------- */

/**
 * Narrative text is assembled from measurements the platform holds. It never
 * introduces a number that is not already in the record above it — CLAUDE.md §7.
 */
function buildSummary(
  raw: RawInfluencer,
  summary: InfluencerSummary,
  derived: Derived,
): string {
  const size =
    (summary.followers ?? 0) >= 1_000_000
      ? "a mega-tier"
      : (summary.followers ?? 0) >= 100_000
        ? "a mid-tier"
        : "a micro";
  const cadence =
    derived.uploadFrequencyPerWeek === null
      ? "an irregular"
      : derived.uploadFrequencyPerWeek >= 2
        ? "a high"
        : derived.uploadFrequencyPerWeek >= 0.75
          ? "a steady"
          : "a low";

  return (
    `${raw.displayName} is ${size} ${raw.categories[0]} creator based in ${raw.countryName}, ` +
    `publishing at ${cadence} cadence on ${summary.primaryPlatform === "youtube" ? "YouTube" : "Instagram"}. ` +
    `${summary.verification === "verified" ? "The account is connected and identity-matched, so authorized first-party metrics are available." : "The profile is built from public platform data; no account connection has been established."}`
  );
}

function buildSignalReading(
  raw: RawInfluencer,
  summary: InfluencerSummary,
  derived: Derived,
  risk: RiskSignals,
  healthValue: number,
): string {
  const parts: string[] = [];

  if (summary.engagementRate !== null) {
    parts.push(
      `Median engagement sits at ${summary.engagementRate.toFixed(2)}% across indexed content`,
    );
  }
  if (derived.growthPattern === null) {
    parts.push("growth pattern cannot be assessed yet — there is not enough snapshot history");
  } else if (derived.growthPattern >= 70) {
    parts.push("follower growth has accumulated steadily without step changes");
  } else {
    parts.push("follower growth is uneven period on period");
  }

  if (risk.botRisk === null && risk.inactiveAudience === null) {
    parts.push(
      "audience-quality signals were not measurable for this creator, so risk is unassessed rather than clean",
    );
  } else if (risk.botRisk !== null && risk.botRisk >= 45) {
    parts.push(
      `audience-quality signals are the main concern, with an estimated bot-risk signal of ${risk.botRisk}/100`,
    );
  } else if (risk.inactiveAudience !== null && risk.inactiveAudience >= 35) {
    parts.push(`a measurable share of the audience shows no recent activity (${risk.inactiveAudience}/100)`);
  } else {
    parts.push("audience-quality signals are clean");
  }

  if (derived.activity === "dormant") {
    parts.push(
      `the account has not published in ${Math.round(derived.dormantDays ?? 0)} days, so recent figures should be read as historical`,
    );
  }

  return `${parts.join("; ")}. Overall health resolves to ${healthValue.toFixed(0)}/100 under formula ${"health-1.0.0"}.`;
}

/* --- Collection reads --------------------------------------------------- */

export function allSummaries(now: Date = EPOCH): InfluencerSummary[] {
  return readRecords()
    .influencers.filter((raw) => raw.status === "published")
    .map((raw) => toSummary(raw.id, now))
    .filter((summary): summary is InfluencerSummary => summary !== null);
}

export function countInfluencers(): number {
  return readRecords().influencers.length;
}

export function platformsOf(id: string): Platform[] {
  return readRecords()
    .accounts.filter((account) => account.influencerId === id)
    .map((account) => account.platform);
}
