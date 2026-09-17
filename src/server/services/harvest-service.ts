import type { Category } from "@/lib/contracts/common";
import {
  ConnectorUnavailable,
  discoverChannelIds,
  fetchChannel,
  fetchChannels,
  parseChannelInput,
  fetchRecentVideos,
  type DiscoveryOptions,
} from "@/server/connectors/youtube";
import {
  ingestedRecords,
  upsertAccounts,
  upsertIngested,
  upsertViewHistory,
  type IngestedRecord,
} from "@/server/data/ingested-store";
import { ConnectorUnavailable as InstagramUnavailable } from "@/server/connectors/instagram";
import { readRecords, type RawAccount } from "@/server/data/records";
import { IngestionRefused, buildRecord, ingestInstagramAccount } from "./ingestion-service";

/* ---------------------------------------------------------------------------
 * Bulk harvest — building the influencer database from real channels.
 *
 * Quota is the constraint, not time. `search.list` costs 100 units against a
 * 10,000/day budget while every other endpoint costs 1, so discovery is the
 * only thing worth counting: the plan below spends ~100 units per query and
 * then reads hundreds of channels for single digits.
 *
 * Progress is committed per query rather than at the end. A harvest that dies
 * halfway through — an exhausted quota, a dropped connection — must leave
 * behind the channels it already paid for.
 * ------------------------------------------------------------------------ */

/**
 * Two queries per category, phrased as things people actually search rather
 * than as category names, because the ranking is over video titles and
 * descriptions. `videoCategoryId` narrows where YouTube has a matching
 * category of its own; the rest rely on the query alone.
 */
const CATEGORY_QUERIES: Record<Category, { q: string; videoCategoryId?: string }[]> = {
  technology: [
    { q: "tech review", videoCategoryId: "28" },
    { q: "smartphone review gadgets", videoCategoryId: "28" },
  ],
  education: [
    { q: "explained documentary", videoCategoryId: "27" },
    { q: "science explained lesson", videoCategoryId: "27" },
  ],
  beauty: [
    { q: "makeup tutorial", videoCategoryId: "26" },
    { q: "skincare routine", videoCategoryId: "26" },
  ],
  fashion: [
    { q: "outfit lookbook style", videoCategoryId: "26" },
    { q: "fashion haul try on", videoCategoryId: "26" },
  ],
  fitness: [
    { q: "home workout", videoCategoryId: "17" },
    { q: "gym training program", videoCategoryId: "17" },
  ],
  health: [
    { q: "health advice doctor", videoCategoryId: "26" },
    { q: "mental health wellness", videoCategoryId: "26" },
  ],
  food: [
    { q: "recipe cooking", videoCategoryId: "26" },
    { q: "street food review", videoCategoryId: "26" },
  ],
  travel: [
    { q: "travel vlog", videoCategoryId: "19" },
    { q: "budget travel guide", videoCategoryId: "19" },
  ],
  gaming: [
    { q: "gameplay walkthrough", videoCategoryId: "20" },
    { q: "gaming review", videoCategoryId: "20" },
  ],
  finance: [
    { q: "personal finance investing", videoCategoryId: "22" },
    { q: "stock market explained", videoCategoryId: "22" },
  ],
  business: [
    { q: "startup business advice", videoCategoryId: "22" },
    { q: "entrepreneur interview", videoCategoryId: "22" },
  ],
  lifestyle: [
    { q: "daily vlog routine", videoCategoryId: "22" },
    { q: "home organisation minimalism", videoCategoryId: "26" },
  ],
  parenting: [
    { q: "parenting tips baby", videoCategoryId: "26" },
    { q: "family vlog kids", videoCategoryId: "22" },
  ],
  automotive: [
    { q: "car review road test", videoCategoryId: "2" },
    { q: "electric vehicle review", videoCategoryId: "2" },
  ],
  entertainment: [
    { q: "comedy sketch", videoCategoryId: "23" },
    { q: "movie breakdown reaction", videoCategoryId: "24" },
  ],
  sports: [
    { q: "football highlights analysis", videoCategoryId: "17" },
    { q: "sports skills training", videoCategoryId: "17" },
  ],
};

export const HARVEST_CATEGORIES = Object.keys(CATEGORY_QUERIES) as Category[];

/** One discovery search: the phrase, plus whatever narrows YouTube's ranking. */
export type DiscoveryQuery = DiscoveryOptions & { q: string };

/** Every category query as a flat list, for a rotation that walks them one at a time. */
export const CATEGORY_PLAN: DiscoveryQuery[] = Object.values(CATEGORY_QUERIES).flat();

/** `search.list` is 100 units; everything else is 1. */
const SEARCH_COST = 100;

export interface HarvestProgress {
  stage: "discovering" | "reading" | "done";
  /** The category, or the query phrase when the caller supplied its own. */
  group?: string;
  discovered: number;
  ingested: number;
  quotaUnitsSpent: number;
}

export interface HarvestReport {
  discovered: number;
  ingested: number;
  skipped: { channelId: string; reason: string }[];
  quotaUnitsSpent: number;
  stoppedEarly: string | null;
}

/**
 * Fills the influencer database from real channels across every category.
 *
 * `target` is a ceiling on new creators, not a promise: discovery returns what
 * YouTube ranks, duplicates across categories are common, and a channel that
 * hides its subscriber count is refused rather than guessed at. Reaching 380 of
 * 400 is a normal outcome and not an error.
 *
 * `queries` replaces the category plan with the caller's own searches — the
 * way a place is swept, since no category query will ever surface "creators
 * in Rajahmundry". Each query is its own commit group: a quota that runs out
 * on the ninth search keeps the eight already paid for.
 */
export async function harvest(
  options: {
    target?: number;
    videosPerChannel?: number;
    categories?: Category[];
    queries?: DiscoveryQuery[];
    onProgress?: (progress: HarvestProgress) => void;
  } = {},
): Promise<HarvestReport> {
  const target = options.target ?? 400;
  const videosPerChannel = options.videosPerChannel ?? 50;
  const groups: { label: string; queries: DiscoveryQuery[] }[] = options.queries
    ? options.queries.map((query) => ({ label: query.q, queries: [query] }))
    : (options.categories ?? HARVEST_CATEGORIES).map((category) => ({
        label: category,
        queries: CATEGORY_QUERIES[category],
      }));
  const report: HarvestReport = {
    discovered: 0,
    ingested: 0,
    skipped: [],
    quotaUnitsSpent: 0,
    stoppedEarly: null,
  };

  // Channels already held are not re-read: this is a top-up, not a refresh, and
  // re-reading them would spend quota to learn what the store already knows.
  const held = new Set(
    ingestedRecords().accounts.map((account) => account.platformAccountId),
  );
  const seen = new Set(held);
  const queue: string[] = [];

  try {
    for (const { label, queries } of groups) {
      if (report.ingested + queue.length >= target) break;

      for (const { q, ...narrowing } of queries) {
        options.onProgress?.({ stage: "discovering", group: label, ...counters(report) });

        const ids = await discoverChannelIds(q, narrowing);
        report.quotaUnitsSpent += SEARCH_COST;

        for (const id of ids) {
          if (seen.has(id)) continue;
          seen.add(id);
          queue.push(id);
          report.discovered += 1;
        }
        if (report.ingested + queue.length >= target) break;
      }

      // Committed per group so an interruption keeps what it paid for.
      const taken = queue.splice(0, Math.max(0, target - report.ingested));
      if (taken.length > 0) {
        options.onProgress?.({ stage: "reading", group: label, ...counters(report) });
        await readAndStore(taken, videosPerChannel, report);
      }
    }

    if (queue.length > 0 && report.ingested < target) {
      await readAndStore(queue.splice(0, target - report.ingested), videosPerChannel, report);
    }
  } catch (error) {
    if (error instanceof ConnectorUnavailable) {
      // Quota exhaustion and a rejected key fail every remaining call the same
      // way. Stop and report what was banked rather than burning the list.
      report.stoppedEarly = error.message;
    } else {
      throw error;
    }
  }

  options.onProgress?.({ stage: "done", ...counters(report) });
  return report;
}

/**
 * The accounts a platform sweep is allowed to touch.
 *
 * Demonstration records are not observations of anything (see demo-service),
 * so their platform ids resolve to nothing upstream. Sweeping them wasted a
 * read per creator, reported four bogus "no longer returned by the platform"
 * skips, and — because that is how a deleted channel is meant to be handled —
 * marked all four permanently unavailable, which then hid them from the very
 * screens they exist to populate.
 *
 * Filtered here rather than in each caller: refresh, the nightly scheduler and
 * the history backfill all select from the same table, and whichever one was
 * forgotten would quietly re-break them.
 */
function refreshableAccounts(): RawAccount[] {
  const demo = new Set(
    ingestedRecords()
      .influencers.filter((influencer) => influencer.isDemo)
      .map((influencer) => influencer.id),
  );
  return ingestedRecords().accounts.filter(
    (account) => account.platform === "youtube" && !demo.has(account.influencerId),
  );
}

/**
 * Re-reads channels already held, in id order, from `offset`.
 *
 * Two uses: picking up a field the connector did not previously capture, and
 * ordinary refresh — every pass appends a snapshot, which is the only way a
 * growth history is ever built. Costs 2 units per channel plus 1 per 50; no
 * `search.list`, so it is cheap next to a harvest.
 */
export async function refreshStored(
  options: { offset?: number; limit?: number; videosPerChannel?: number } = {},
): Promise<HarvestReport> {
  const report: HarvestReport = {
    discovered: 0,
    ingested: 0,
    skipped: [],
    quotaUnitsSpent: 0,
    stoppedEarly: null,
  };

  const ids = [...refreshableAccounts()]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((account) => account.platformAccountId)
    .slice(options.offset ?? 0, (options.offset ?? 0) + (options.limit ?? 100));
  report.discovered = ids.length;

  try {
    // Batched so a failure part-way keeps what it has already written.
    for (let i = 0; i < ids.length; i += 25) {
      await readAndStore(ids.slice(i, i + 25), options.videosPerChannel ?? 50, report);
    }
  } catch (error) {
    if (error instanceof ConnectorUnavailable) report.stoppedEarly = error.message;
    else throw error;
  }

  return report;
}

/**
 * Ingests channels named by an outside list — an open dataset, a client's own
 * roster — rather than found by search. A seed is a channel id, an @handle or
 * a youtube.com URL; the list is only used to *find* the channel, and every
 * figure stored is then read from the platform, so nothing a dataset claims
 * about a creator ever enters the database.
 *
 * Seeds already held, by id or by handle, are skipped before any call is made:
 * an id costs nothing to skip and a handle would cost a unit to resolve.
 * Resolution is committed in batches of fifty so a quota that runs out keeps
 * what was already read.
 */
export async function ingestSeeds(
  seeds: string[],
  options: { videosPerChannel?: number } = {},
): Promise<HarvestReport & { alreadyHeld: number }> {
  const report = { discovered: 0, ingested: 0, skipped: [], quotaUnitsSpent: 0, stoppedEarly: null, alreadyHeld: 0 } as HarvestReport & { alreadyHeld: number };

  const { accounts } = ingestedRecords();
  const heldIds = new Set(accounts.map((account) => account.platformAccountId));
  const heldHandles = new Set(accounts.map((account) => account.handle.toLowerCase()));
  const queue: string[] = [];

  try {
    for (const seed of new Set(seeds.map((seed) => seed.trim()).filter(Boolean))) {
      const ref = parseChannelInput(seed);
      if (ref.kind === "id" ? heldIds.has(ref.value) : heldHandles.has(ref.value.replace(/^@/, "").toLowerCase())) {
        report.alreadyHeld += 1;
        continue;
      }

      let id = ref.kind === "id" ? ref.value : null;
      if (!id) {
        const channel = await fetchChannel(seed);
        report.quotaUnitsSpent += 1;
        if (!channel) {
          report.skipped.push({ channelId: seed, reason: "No channel matched this handle." });
          continue;
        }
        id = channel.channelId;
      }
      if (heldIds.has(id)) {
        report.alreadyHeld += 1;
        continue;
      }
      heldIds.add(id);
      queue.push(id);
      report.discovered += 1;

      if (queue.length === 50) await readAndStore(queue.splice(0), options.videosPerChannel ?? 50, report);
    }
    if (queue.length > 0) await readAndStore(queue, options.videosPerChannel ?? 50, report);
  } catch (error) {
    if (error instanceof ConnectorUnavailable) report.stoppedEarly = error.message;
    else throw error;
  }

  return report;
}

/**
 * The Instagram half of the daily snapshot: re-reads every Instagram account
 * without a reading from today, oldest first. One Business Discovery call
 * each against the 200-an-hour token limit — stops at the limit and lets the
 * next tick continue, the same way the YouTube pass does with its budget.
 */
export async function refreshInstagramStale(
  options: { maxAccounts?: number } = {},
): Promise<StaleRefreshReport> {
  const report: StaleRefreshReport = {
    discovered: 0, ingested: 0, skipped: [], quotaUnitsSpent: 0, stoppedEarly: null, remaining: 0, oldestRemaining: null,
  };
  const today = new Date().toISOString().slice(0, 10);
  const due = ingestedRecords()
    .accounts.filter((a) => a.platform === "instagram" && !a.unavailableSince && a.lastSyncedAt.slice(0, 10) !== today)
    .sort((a, b) => a.lastSyncedAt.localeCompare(b.lastSyncedAt));
  const batch = due.slice(0, options.maxAccounts ?? 150);
  report.discovered = batch.length;

  for (const account of batch) {
    try {
      const result = await ingestInstagramAccount(account.handle, 50);
      report.ingested += 1;
      report.quotaUnitsSpent += result.quotaUnitsSpent;
    } catch (error) {
      if (error instanceof IngestionRefused) {
        report.skipped.push({ channelId: account.platformAccountId, reason: error.message });
        continue;
      }
      if (error instanceof InstagramUnavailable) {
        report.stoppedEarly = error.message;
        break;
      }
      throw error;
    }
  }

  const stillDue = due.slice(report.ingested + report.skipped.length);
  report.remaining = stillDue.length;
  report.oldestRemaining = stillDue[0]?.lastSyncedAt ?? null;
  return report;
}

export interface StaleRefreshReport extends HarvestReport {
  /** Accounts still carrying an older reading after this pass. */
  remaining: number;
  oldestRemaining: string | null;
}

/**
 * Refreshes whichever accounts have gone longest without a reading.
 *
 * This is what a scheduler calls. It takes a time budget rather than a fixed
 * list because a serverless invocation is killed at a wall-clock limit — a job
 * that tried to sweep 627 channels in one call would be cut off mid-flight
 * every night and the last channels would never be read at all.
 *
 * Ordering by staleness makes the partial pass self-correcting: whoever is
 * missed tonight is at the front of the queue tomorrow, so coverage evens out
 * without anyone tracking a cursor.
 */
export async function refreshStale(
  options: { budgetMs?: number; maxChannels?: number; videosPerChannel?: number } = {},
): Promise<StaleRefreshReport> {
  const budgetMs = options.budgetMs ?? 50_000;
  const maxChannels = options.maxChannels ?? 200;
  const startedAt = Date.now();

  const report: StaleRefreshReport = {
    discovered: 0,
    ingested: 0,
    skipped: [],
    quotaUnitsSpent: 0,
    stoppedEarly: null,
    remaining: 0,
    oldestRemaining: null,
  };

  // One snapshot per account per day, so anything already read today would be
  // deduplicated on write — spending quota to learn nothing.
  const today = new Date().toISOString().slice(0, 10);
  const isDue = (account: { lastSyncedAt: string; unavailableSince?: string | null }) =>
    !account.unavailableSince && account.lastSyncedAt.slice(0, 10) !== today;

  const due = [...refreshableAccounts()]
    .filter(isDue)
    .sort((a, b) => a.lastSyncedAt.localeCompare(b.lastSyncedAt));

  const batch = due.slice(0, maxChannels);
  report.discovered = batch.length;

  try {
    for (let i = 0; i < batch.length; i += 25) {
      if (Date.now() - startedAt > budgetMs) {
        report.stoppedEarly = `Time budget of ${budgetMs}ms reached.`;
        break;
      }
      await readAndStore(
        batch.slice(i, i + 25).map((account) => account.platformAccountId),
        options.videosPerChannel ?? 50,
        report,
      );
    }
  } catch (error) {
    if (error instanceof ConnectorUnavailable) report.stoppedEarly = error.message;
    else throw error;
  }

  const stillDue = [...refreshableAccounts()]
    .filter(isDue)
    .sort((a, b) => a.lastSyncedAt.localeCompare(b.lastSyncedAt));

  report.remaining = stillDue.length;
  report.oldestRemaining = stillDue[0]?.lastSyncedAt ?? null;
  return report;
}

/** Records that the platform has stopped answering for these channels. */
async function markUnavailable(channelIds: string[]): Promise<void> {
  const data = ingestedRecords();
  const gone = new Set(channelIds);
  const at = new Date().toISOString();
  const changed: RawAccount[] = [];

  for (const account of data.accounts) {
    if (gone.has(account.platformAccountId) && !account.unavailableSince) {
      account.unavailableSince = at;
      changed.push(account);
    }
  }
  await upsertAccounts(changed);
}

export interface HistoryBackfillReport {
  channelsRead: number;
  pointsStored: number;
  quotaUnitsSpent: number;
  remaining: number;
  stoppedEarly: string | null;
}

/**
 * Reads further back through a creator's uploads and stores the dates and view
 * counts as a lean series.
 *
 * The growth calculation needs a window long enough for "older" and "newer" to
 * mean different periods of a channel's life. Reading only the fifty most
 * recent uploads gives a daily poster about seven weeks, which is why a third
 * of the database had no growth reading at all.
 *
 * Only the publish date and view count are kept. Titles, captions, thumbnails
 * and hashtags for two hundred uploads across six hundred channels would cost
 * roughly 110MB against 14MB for these, and no screen renders them.
 */
export async function backfillViewHistory(
  options: { offset?: number; limit?: number; uploads?: number; budgetMs?: number } = {},
): Promise<HistoryBackfillReport> {
  const uploads = options.uploads ?? 200;
  const budgetMs = options.budgetMs ?? 600_000;
  const startedAt = Date.now();

  const report: HistoryBackfillReport = {
    channelsRead: 0,
    pointsStored: 0,
    quotaUnitsSpent: 0,
    remaining: 0,
    stoppedEarly: null,
  };

  const data = readRecords();
  const already = new Set(data.viewHistory.map((point) => point.influencerId));
  const due = [...refreshableAccounts()]
    .filter((account) => !account.unavailableSince && !already.has(account.influencerId))
    .sort((a, b) => a.id.localeCompare(b.id));

  const batch = due.slice(options.offset ?? 0, (options.offset ?? 0) + (options.limit ?? 50));

  try {
    for (const account of batch) {
      if (Date.now() - startedAt > budgetMs) {
        report.stoppedEarly = `Time budget of ${budgetMs}ms reached.`;
        break;
      }

      const channels = await fetchChannels([account.platformAccountId]);
      report.quotaUnitsSpent += 1;
      const playlist = channels[0]?.uploadsPlaylistId;
      if (!playlist) continue;

      const videos = await fetchRecentVideos(playlist, uploads);
      // One playlistItems page and one videos call per fifty uploads.
      report.quotaUnitsSpent += 2 * Math.max(1, Math.ceil(videos.length / 50));

      await upsertViewHistory(
        account.influencerId,
        videos.map((video) => ({
          influencerId: account.influencerId,
          accountId: account.id,
          videoId: video.videoId,
          publishedAt: video.publishedAt,
          views: video.views,
        })),
      );

      report.channelsRead += 1;
      report.pointsStored += videos.length;
    }
  } catch (error) {
    if (error instanceof ConnectorUnavailable) report.stoppedEarly = error.message;
    else throw error;
  }

  const done = new Set(readRecords().viewHistory.map((point) => point.influencerId));
  report.remaining = readRecords().accounts.filter(
    (account) => !account.unavailableSince && !done.has(account.influencerId),
  ).length;

  return report;
}

function counters(report: HarvestReport) {
  return {
    discovered: report.discovered,
    ingested: report.ingested,
    quotaUnitsSpent: report.quotaUnitsSpent,
  };
}

/** Channel statistics batched 50 to a call; uploads read one channel at a time. */
async function readAndStore(
  channelIds: string[],
  videosPerChannel: number,
  report: HarvestReport,
): Promise<void> {
  const channels = await fetchChannels(channelIds);
  report.quotaUnitsSpent += Math.ceil(channelIds.length / 50);

  // Ids the platform no longer answers for. Recorded rather than silently
  // dropped: otherwise a deleted channel is asked for again every night, and
  // its last-known figures go on being served as though they were current.
  const returned = new Set(channels.map((channel) => channel.channelId));
  const vanished = channelIds.filter((id) => !returned.has(id));
  if (vanished.length > 0) {
    await markUnavailable(vanished);
    for (const id of vanished) {
      report.skipped.push({ channelId: id, reason: "No longer returned by the platform." });
    }
  }

  const collectedAt = new Date().toISOString();
  const records: IngestedRecord[] = [];

  for (const channel of channels) {
    try {
      const videos = channel.uploadsPlaylistId
        ? await fetchRecentVideos(channel.uploadsPlaylistId, videosPerChannel)
        : [];
      // One playlistItems page plus one videos page per channel, at 1 unit each.
      report.quotaUnitsSpent += 2 * Math.max(1, Math.ceil(videos.length / 50));

      records.push(buildRecord(channel, videos, collectedAt));
    } catch (error) {
      if (error instanceof IngestionRefused) {
        report.skipped.push({ channelId: channel.channelId, reason: error.message });
        continue;
      }
      // Whatever was read so far is still worth keeping.
      await upsertIngested(records);
      report.ingested += records.length;
      throw error;
    }
  }

  await upsertIngested(records);
  report.ingested += records.length;
}
