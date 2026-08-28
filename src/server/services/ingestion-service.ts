import type { Category } from "@/lib/contracts/common";
import {
  fetchRecentVideos,
  observeChannel,
  type YouTubeChannel,
  type YouTubeVideo,
} from "@/server/connectors/youtube";
import { upsertIngested, type IngestedRecord } from "@/server/data/ingested-store";

/* ---------------------------------------------------------------------------
 * Real-channel ingestion.
 *
 * Turns one YouTube observation into the canonical record set the repository
 * already reads, so an ingested creator travels the exact same path as a
 * seeded one: analytics → scoring → confidence → API → UI.
 *
 * The whole point of this file is what it *refuses* to write. An API key buys
 * public counters and nothing else, so this creator gets no audience
 * demographics, no bot-risk signal, no comment-quality figure and no AI
 * classification — those are all `oauth_authorized` or AI-derived, and
 * inventing them to fill a page is the one thing DPR §22 forbids outright. The
 * scoring engine renormalises around the missing components and the confidence
 * score falls accordingly, which is the correct, visible outcome.
 * ------------------------------------------------------------------------ */

/**
 * YouTube's own topic assignments, as Wikipedia URLs. These are an observed
 * platform classification, not a model's guess, which is why they may be used
 * as a category with no AI label attached. Unmapped topics are dropped rather
 * than forced into the nearest category.
 */
const TOPIC_CATEGORY: Record<string, Category> = {
  Technology: "technology",
  Computer_hardware: "technology",
  Software: "technology",
  Electronics: "technology",
  Fashion: "fashion",
  Clothing: "fashion",
  Cosmetics: "beauty",
  Beauty: "beauty",
  Physical_fitness: "fitness",
  Health: "health",
  Food: "food",
  Tourism: "travel",
  Vehicle: "automotive",
  Motorsport: "automotive",
  Business: "business",
  Finance: "finance",
  Knowledge: "education",
  Education: "education",
  "Lifestyle_(sociology)": "lifestyle",
  Hobby: "lifestyle",
  Pet: "lifestyle",
  Entertainment: "entertainment",
  Film: "entertainment",
  Television_program: "entertainment",
  Humour: "entertainment",
  Performing_arts: "entertainment",
  Music: "entertainment",
  Video_game_culture: "gaming",
  Action_game: "gaming",
  Action_adventure_game: "gaming",
  "Role-playing_video_game": "gaming",
  Strategy_video_game: "gaming",
  Simulation_video_game: "gaming",
  Sports_game: "gaming",
  Casual_game: "gaming",
  Puzzle_video_game: "gaming",
  Racing_video_game: "gaming",
  Sport: "sports",
  Association_football: "sports",
  Basketball: "sports",
  Cricket: "sports",
  American_football: "sports",
  Boxing: "sports",
  Golf: "sports",
  Ice_hockey: "sports",
  Tennis: "sports",
  Volleyball: "sports",
  Professional_wrestling: "sports",
  Family: "parenting",
};

export function categoriesFromTopics(topicUrls: string[]): Category[] {
  const seen = new Set<Category>();
  for (const url of topicUrls) {
    const slug = url.split("/").pop();
    const category = slug ? TOPIC_CATEGORY[slug] : undefined;
    if (category) seen.add(category);
  }
  return [...seen];
}

/**
 * YouTube's own video categories.
 *
 * Channel-level topics turned out to be near-useless as a classifier: the
 * vocabulary is coarse and `Lifestyle_(sociology)` is attached to most
 * channels, which put 458 of 627 harvested creators in one bucket. The
 * per-video `categoryId` is assigned by YouTube too, but is far better spread.
 *
 * Ids YouTube publishes that SocialOrbit has no equivalent for — News &
 * Politics, Nonprofits, Travel-adjacent oddities — are left unmapped rather
 * than pushed into the nearest category.
 */
const VIDEO_CATEGORY: Record<string, Category> = {
  "1": "entertainment", // Film & Animation
  "2": "automotive", // Autos & Vehicles
  "10": "entertainment", // Music
  "15": "lifestyle", // Pets & Animals
  "17": "sports", // Sports
  "19": "travel", // Travel & Events
  "20": "gaming", // Gaming
  "22": "lifestyle", // People & Blogs
  "23": "entertainment", // Comedy
  "24": "entertainment", // Entertainment
  "26": "lifestyle", // Howto & Style
  "27": "education", // Education
  "28": "technology", // Science & Technology
};

/**
 * The category YouTube assigned to most of a creator's recent uploads.
 *
 * Modal rather than every value seen: a technology channel with one travel
 * vlog is a technology channel, and letting a single upload add a category
 * would put it in a cohort it does not belong to.
 */
export function categoryFromVideos(categoryIds: (string | null)[]): Category | null {
  const counts = new Map<Category, number>();
  for (const id of categoryIds) {
    const category = id ? VIDEO_CATEGORY[id] : undefined;
    if (category) counts.set(category, (counts.get(category) ?? 0) + 1);
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  return ranked[0]?.[0] ?? null;
}

/**
 * Both observed signals, most specific first.
 *
 * The video category leads because it discriminates; channel topics follow
 * because they occasionally carry something the video categories cannot say,
 * such as Health. Neither is inference — both are classifications YouTube
 * publishes about the channel.
 */
export function categoriesFor(
  topicUrls: string[],
  videoCategoryIds: (string | null)[],
): Category[] {
  const fromVideos = categoryFromVideos(videoCategoryIds);
  const fromTopics = categoriesFromTopics(topicUrls);
  return [...new Set([...(fromVideos ? [fromVideos] : []), ...fromTopics])];
}

const COUNTRY_NAMES =
  typeof Intl.DisplayNames === "function"
    ? new Intl.DisplayNames(["en"], { type: "region" })
    : null;

function countryName(code: string | null): string {
  if (!code) return "";
  try {
    return COUNTRY_NAMES?.of(code) ?? code;
  } catch {
    return code;
  }
}

/**
 * `#tag` tokens from a description. Campaign attribution matches against these,
 * so they are lowercased before de-duplication — `#Tag` and `#tag` are the same
 * tag — and a `#` inside a word is not one at all.
 */
export function extractHashtags(text: string): string[] {
  const matches = text.match(/(?<![\p{L}\p{N}_])#[\p{L}\p{N}_]+/gu) ?? [];
  return [...new Set(matches.map((tag) => tag.toLowerCase()))];
}

/**
 * The language the creator declared most often across the sampled uploads.
 * Declared, not detected: guessing a language from a title is inference, and
 * this platform does not present inference as observation.
 */
function declaredLanguages(videos: YouTubeVideo[]): string[] {
  const counts = new Map<string, number>();
  for (const video of videos) {
    if (!video.language) continue;
    const base = video.language.split("-")[0].toLowerCase();
    counts.set(base, (counts.get(base) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([code]) => code);
}

export class IngestionRefused extends Error {
  constructor(readonly code: "not_found" | "unmeasurable", message: string) {
    super(message);
    this.name = "IngestionRefused";
  }
}

export interface IngestionReport {
  influencerId: string;
  displayName: string;
  contentIngested: number;
  quotaUnitsSpent: number;
}

/**
 * Maps one channel plus its recent uploads onto the canonical record set.
 * Pure: it performs no I/O and writes nothing, so a bulk harvest can build
 * hundreds of records and commit them in a single pass.
 */
export function buildRecord(
  channel: YouTubeChannel,
  videos: YouTubeVideo[],
  collectedAt: string,
): IngestedRecord {
  if (channel.subscribers === null) {
    // Every follower-band, cohort and benchmark read keys off this number. A
    // placeholder would put the creator in a band they do not belong to and
    // quietly corrupt the cohort medians of everyone who does.
    throw new IngestionRefused(
      "unmeasurable",
      `${channel.title} hides their subscriber count, so there is no audience size to record.`,
    );
  }

  // Stored without the leading "@": every surface renders the sigil itself,
  // and a stored one comes out as "@@mkbhd".
  const handle = (channel.handle ?? channel.channelId).replace(/^@/, "");
  const influencerId = `yt_${channel.channelId}`;
  const accountId = `${influencerId}_youtube`;
  const contentCount = channel.videoCount ?? videos.length;

  return {
    influencer: {
      id: influencerId,
      displayName: channel.title,
      primaryHandle: handle,
      avatarUrl: channel.avatarUrl,
      bio: channel.description.slice(0, 400),
      status: "published",
      // Both false until OAuth. Verified status is never granted from public
      // data, however authoritative that data is (Arch §2).
      isConnected: false,
      identityMatched: false,
      categories: categoriesFor(
        channel.topicCategories,
        videos.map((video) => video.categoryId),
      ),
      countryCode: channel.country ?? "",
      countryName: countryName(channel.country),
      languages: declaredLanguages(videos),
      primaryPlatform: "youtube",
      createdAt: channel.publishedAt,
      lastRefreshedAt: collectedAt,
      conflictCount: 0,
    },
    accounts: [
      {
        id: accountId,
        influencerId,
        platform: "youtube",
        platformAccountId: channel.channelId,
        handle,
        url: channel.url,
        isPrimary: true,
        isConnected: false,
        connectedAt: null,
        needsReauth: false,
        followers: channel.subscribers,
        totalViews: channel.totalViews,
        contentCount,
        lastSyncedAt: collectedAt,
      },
    ],
    snapshot: {
      accountId,
      date: collectedAt.slice(0, 10),
      followers: channel.subscribers,
      views: channel.totalViews,
      contentCount,
    },
    content: videos.map((video) => ({
      id: `${accountId}_${video.videoId}`,
      accountId,
      influencerId,
      platform: "youtube",
      title: video.title,
      url: video.url,
      thumbnailUrl: video.thumbnailUrl,
      publishedAt: video.publishedAt,
      views: video.views,
      likes: video.likes,
      comments: video.comments,
      // No share count on the public API, and no disclosure flag either: paid
      // product placement is visible only to the channel owner.
      shares: null,
      durationSeconds: video.durationSeconds,
      isSponsored: null,
      caption: video.description.slice(0, 400),
      hashtags: extractHashtags(video.description),
      platformCategoryId: video.categoryId,
    })),
  };
}

export async function ingestYouTubeChannel(
  input: string,
  videoLimit = 50,
): Promise<IngestionReport> {
  const observation = await observeChannel(input, videoLimit);
  if (!observation) {
    throw new IngestionRefused("not_found", `No YouTube channel matched "${input}".`);
  }

  const record = buildRecord(
    observation.channel,
    observation.recentContent,
    observation.provenance.collectedAt,
  );
  upsertIngested([record]);

  return {
    influencerId: record.influencer.id,
    displayName: observation.channel.title,
    contentIngested: record.content.length,
    quotaUnitsSpent: observation.quotaUnitsSpent,
  };
}
