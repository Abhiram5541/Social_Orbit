import type { Category } from "@/lib/contracts/common";
import {
  ConnectorUnavailable,
  discoverChannelIds,
  fetchChannels,
  fetchRecentVideos,
} from "@/server/connectors/youtube";
import { ingestedRecords, upsertIngested, type IngestedRecord } from "@/server/data/ingested-store";
import { IngestionRefused, buildRecord } from "./ingestion-service";

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

/** `search.list` is 100 units; everything else is 1. */
const SEARCH_COST = 100;

export interface HarvestProgress {
  stage: "discovering" | "reading" | "done";
  category?: Category;
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
 */
export async function harvest(
  options: {
    target?: number;
    videosPerChannel?: number;
    categories?: Category[];
    onProgress?: (progress: HarvestProgress) => void;
  } = {},
): Promise<HarvestReport> {
  const target = options.target ?? 400;
  const videosPerChannel = options.videosPerChannel ?? 50;
  const categories = options.categories ?? HARVEST_CATEGORIES;
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
    for (const category of categories) {
      if (report.ingested + queue.length >= target) break;

      for (const query of CATEGORY_QUERIES[category]) {
        options.onProgress?.({ stage: "discovering", category, ...counters(report) });

        const ids = await discoverChannelIds(query.q, {
          videoCategoryId: query.videoCategoryId,
        });
        report.quotaUnitsSpent += SEARCH_COST;

        for (const id of ids) {
          if (seen.has(id)) continue;
          seen.add(id);
          queue.push(id);
          report.discovered += 1;
        }
        if (report.ingested + queue.length >= target) break;
      }

      // Committed per category so an interruption keeps what it paid for.
      const taken = queue.splice(0, Math.max(0, target - report.ingested));
      if (taken.length > 0) {
        options.onProgress?.({ stage: "reading", category, ...counters(report) });
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

  const ids = [...ingestedRecords().accounts]
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
      upsertIngested(records);
      report.ingested += records.length;
      throw error;
    }
  }

  upsertIngested(records);
  report.ingested += records.length;
}
