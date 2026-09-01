import { z } from "zod";
import type { Provenance } from "@/lib/contracts/common";

/**
 * YouTube Data API v3 connector.
 *
 * This is a tier-1 source (DPR §7.1 `platform_api`): every figure it returns is
 * observed, never estimated. It reads *public* channel and video statistics
 * with an API key. It deliberately computes no engagement rate, median,
 * consistency or any other derived value — that is `src/server/analytics`' job,
 * and doing it here would hide an undeclared formula inside a data source.
 *
 * Authorized creator analytics (impressions, watch time, demographics) require
 * OAuth and the YouTube Analytics API. Those are a different source tier
 * (`oauth_authorized`) and are not reachable with an API key.
 */

const API = "https://www.googleapis.com/youtube/v3";

/** Daily quota units per call. `search` is listed only to record why it is unused. */
const QUOTA_COST = {
  channels: 1,
  playlistItems: 1,
  videos: 1,
  commentThreads: 1,
  search: 100,
} as const;

export class ConnectorUnavailable extends Error {
  constructor(
    readonly platform: "youtube",
    readonly reason: "credentials_missing" | "quota_exceeded" | "forbidden" | "upstream_error",
    message: string,
  ) {
    super(message);
    this.name = "ConnectorUnavailable";
  }
}

/** Null rather than throwing, so health reporting needs no try/catch. */
export function youtubeApiKey(): string | null {
  return process.env.YOUTUBE_API_KEY?.trim() || null;
}

function requireKey(): string {
  const key = youtubeApiKey();
  if (!key) {
    throw new ConnectorUnavailable(
      "youtube",
      "credentials_missing",
      "YOUTUBE_API_KEY is not set. The YouTube connector cannot read live data.",
    );
  }
  return key;
}

/* --- Response schemas ----------------------------------------------------
 *
 * Google returns counters as strings and omits a key entirely when the value is
 * unavailable — comments disabled, subscriber count hidden. Both are real
 * states, so both become null. Zero is a measurement; absent is not.
 * ---------------------------------------------------------------------- */

const Counter = z
  .string()
  .optional()
  .transform((value) => (value === undefined ? null : Number(value)))
  .refine((value) => value === null || Number.isFinite(value), "counter was not a number");

const Thumbnails = z.record(z.string(), z.object({ url: z.string() })).optional();

const ChannelItem = z.object({
  id: z.string(),
  snippet: z.object({
    title: z.string(),
    description: z.string().default(""),
    customUrl: z.string().optional(),
    publishedAt: z.string(),
    country: z.string().optional(),
    thumbnails: Thumbnails,
  }),
  statistics: z.object({
    viewCount: Counter,
    subscriberCount: Counter,
    hiddenSubscriberCount: z.boolean().optional(),
    videoCount: Counter,
  }),
  contentDetails: z.object({
    relatedPlaylists: z.object({ uploads: z.string().optional() }),
  }),
  // Wikipedia topic URLs YouTube itself assigns. An observed classification
  // from the platform, not an inference — which is why it may be used as a
  // category without an AI label. Absent on many channels.
  topicDetails: z.object({ topicCategories: z.array(z.string()).default([]) }).optional(),
});

const VideoItem = z.object({
  id: z.string(),
  snippet: z.object({
    title: z.string(),
    description: z.string().default(""),
    publishedAt: z.string(),
    thumbnails: Thumbnails,
    categoryId: z.string().optional(),
    // The language the creator declared for the audio track. Only some
    // channels set it, so it is a hint about the channel, never a guarantee.
    defaultAudioLanguage: z.string().optional(),
  }),
  statistics: z.object({
    viewCount: Counter,
    likeCount: Counter,
    commentCount: Counter,
  }),
  // Optional because a live or scheduled broadcast genuinely has no duration
  // yet. Absent is a fact about the video, not a malformed response.
  contentDetails: z.object({ duration: z.string().optional() }).optional(),
});

const PlaylistPage = z.object({
  items: z.array(z.object({ contentDetails: z.object({ videoId: z.string() }) })).default([]),
  nextPageToken: z.string().optional(),
});

const ChannelList = z.object({ items: z.array(ChannelItem).default([]) });
/**
 * Deliberately lenient: the page is accepted as a list of unknowns and each
 * item is validated on its own.
 *
 * Validating the array as a whole meant one oddly-shaped video failed the page,
 * which failed the channel, which stopped a two-hundred-channel sweep. A video
 * the platform describes strangely is a fact about that video; the other
 * nineteen thousand are still readable.
 */
const VideoList = z.object({ items: z.array(z.unknown()).default([]) });

/** Google's error envelope. `reason` is what separates a bad key from a spent quota. */
const GoogleError = z.object({
  error: z.object({
    message: z.string(),
    errors: z.array(z.object({ reason: z.string() })).default([]),
  }),
});

/* --- Transport ----------------------------------------------------------- */

async function call<T extends z.ZodTypeAny>(
  resource: keyof typeof QUOTA_COST,
  params: Record<string, string>,
  schema: T,
): Promise<z.infer<T>> {
  const url = new URL(`${API}/${resource}`);
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
  url.searchParams.set("key", requireKey());

  let response: Response;
  try {
    response = await fetch(url, { cache: "no-store" });
  } catch (cause) {
    throw new ConnectorUnavailable(
      "youtube",
      "upstream_error",
      `YouTube API unreachable: ${String(cause)}`,
    );
  }

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const parsed = GoogleError.safeParse(body);
    const reason = parsed.success ? (parsed.data.error.errors[0]?.reason ?? "") : "";
    const detail = parsed.success ? parsed.data.error.message : `HTTP ${response.status}`;

    if (reason === "quotaExceeded" || reason === "rateLimitExceeded") {
      throw new ConnectorUnavailable(
        "youtube",
        "quota_exceeded",
        `YouTube daily quota exhausted: ${detail}`,
      );
    }
    if (response.status === 400 || response.status === 401 || response.status === 403) {
      const credentialProblem = reason === "keyInvalid" || reason === "badRequest" || response.status === 400;
      throw new ConnectorUnavailable(
        "youtube",
        credentialProblem ? "credentials_missing" : "forbidden",
        `YouTube rejected the request (${reason || response.status}): ${detail}`,
      );
    }
    throw new ConnectorUnavailable("youtube", "upstream_error", `YouTube API error: ${detail}`);
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new ConnectorUnavailable(
      "youtube",
      "upstream_error",
      `YouTube returned an unexpected shape for ${resource}: ${parsed.error.issues[0]?.message}`,
    );
  }
  return parsed.data;
}

/* --- Identifier resolution ----------------------------------------------- */

export type ChannelRef = { kind: "id" | "handle" | "username"; value: string };

/**
 * Accepts a channel id, an @handle, a legacy username, or any youtube.com URL
 * containing one of those. A channel id is returned as-is: resolving one costs
 * a request and yields no new information.
 */
export function parseChannelInput(input: string): ChannelRef {
  const trimmed = input.trim();
  const fromUrl = trimmed.match(
    /youtube\.com\/(?:channel\/(UC[\w-]{22})|(@[\w.-]+)|(?:c|user)\/([\w.-]+))/i,
  );

  if (fromUrl) {
    if (fromUrl[1]) return { kind: "id", value: fromUrl[1] };
    if (fromUrl[2]) return { kind: "handle", value: fromUrl[2] };
    if (fromUrl[3]) return { kind: "username", value: fromUrl[3] };
  }
  if (/^UC[\w-]{22}$/.test(trimmed)) return { kind: "id", value: trimmed };
  return { kind: "handle", value: trimmed.startsWith("@") ? trimmed : `@${trimmed}` };
}

/* --- Channel ------------------------------------------------------------- */

export interface YouTubeChannel {
  channelId: string;
  title: string;
  handle: string | null;
  description: string;
  country: string | null;
  avatarUrl: string | null;
  publishedAt: string;
  subscribers: number | null;
  /** The creator hides the count. Distinct from "we failed to read it". */
  subscribersHidden: boolean;
  totalViews: number | null;
  videoCount: number | null;
  uploadsPlaylistId: string | null;
  url: string;
  /** Wikipedia topic URLs YouTube assigns to the channel. Often empty. */
  topicCategories: string[];
}

const CHANNEL_PARTS = "snippet,statistics,contentDetails,topicDetails";

/** One `channels.list` call — 1 quota unit, by id, handle or legacy username. */
export async function fetchChannel(input: string): Promise<YouTubeChannel | null> {
  const { kind, value } = parseChannelInput(input);
  const key = kind === "id" ? "id" : kind === "handle" ? "forHandle" : "forUsername";

  const { items } = await call("channels", { part: CHANNEL_PARTS, [key]: value }, ChannelList);
  const item = items[0];
  return item ? toChannel(item) : null;
}

/**
 * Up to 50 channels for a single quota unit. `forHandle` takes one channel per
 * call, so anything reading a large set resolves ids first and comes here —
 * 400 channels cost 8 units this way instead of 400.
 */
export async function fetchChannels(channelIds: string[]): Promise<YouTubeChannel[]> {
  const channels: YouTubeChannel[] = [];
  for (let i = 0; i < channelIds.length; i += 50) {
    const { items } = await call(
      "channels",
      { part: CHANNEL_PARTS, id: channelIds.slice(i, i + 50).join(",") },
      ChannelList,
    );
    channels.push(...items.map(toChannel));
  }
  return channels;
}

function toChannel(item: z.infer<typeof ChannelItem>): YouTubeChannel {
  const thumbnails = item.snippet.thumbnails ?? {};
  const handle = item.snippet.customUrl ?? null;

  return {
    channelId: item.id,
    title: item.snippet.title,
    handle,
    description: item.snippet.description,
    country: item.snippet.country ?? null,
    avatarUrl:
      thumbnails.high?.url ?? thumbnails.medium?.url ?? thumbnails.default?.url ?? null,
    publishedAt: new Date(item.snippet.publishedAt).toISOString(),
    subscribers: item.statistics.hiddenSubscriberCount ? null : item.statistics.subscriberCount,
    subscribersHidden: item.statistics.hiddenSubscriberCount ?? false,
    totalViews: item.statistics.viewCount,
    videoCount: item.statistics.videoCount,
    uploadsPlaylistId: item.contentDetails.relatedPlaylists.uploads ?? null,
    topicCategories: item.topicDetails?.topicCategories ?? [],
    url: handle ? `https://www.youtube.com/${handle}` : `https://www.youtube.com/channel/${item.id}`,
  };
}

/* --- Discovery ------------------------------------------------------------ */

const SearchPage = z.object({
  items: z
    .array(z.object({ snippet: z.object({ channelId: z.string() }).optional() }))
    .default([]),
});

/**
 * Channel ids behind the most-viewed videos matching a query.
 *
 * `search.list` costs 100 units — a hundred times any other call here — so this
 * is the one endpoint worth counting. It is used to *discover* channels; every
 * figure about them is then read through the cheap endpoints.
 *
 * Searching videos rather than channels on purpose: `type=channel` ranks on
 * channel metadata and surfaces a lot of dormant accounts, while the channels
 * behind high-view videos are by construction active and real.
 */
export async function discoverChannelIds(
  query: string,
  options: { videoCategoryId?: string; regionCode?: string; limit?: number } = {},
): Promise<string[]> {
  const { items } = await call(
    "search",
    {
      part: "snippet",
      q: query,
      type: "video",
      order: "viewCount",
      maxResults: String(Math.min(50, options.limit ?? 50)),
      ...(options.videoCategoryId ? { videoCategoryId: options.videoCategoryId } : {}),
      ...(options.regionCode ? { regionCode: options.regionCode } : {}),
    },
    SearchPage,
  );

  return [
    ...new Set(
      items
        .map((item) => item.snippet?.channelId)
        .filter((id): id is string => typeof id === "string"),
    ),
  ];
}

/* --- Content ------------------------------------------------------------- */

/**
 * Recent uploads with their public statistics.
 *
 * Reads the uploads playlist rather than `search.list`: the same videos in
 * strict upload order for 1 quota unit per page instead of 100 per call.
 */
export interface YouTubeVideo {
  videoId: string;
  title: string;
  description: string;
  url: string;
  thumbnailUrl: string | null;
  publishedAt: string;
  views: number | null;
  likes: number | null;
  comments: number | null;
  durationSeconds: number | null;
  /** BCP-47 tag the creator declared, where they declared one. */
  language: string | null;
  /** YouTube's own category for the video — a far better-distributed signal
   *  than the channel-level topics, which are mostly "Lifestyle". */
  categoryId: string | null;
}

export async function fetchRecentVideos(
  uploadsPlaylistId: string,
  limit = 25,
): Promise<YouTubeVideo[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;

  while (ids.length < limit) {
    const page = await call(
      "playlistItems",
      {
        part: "contentDetails",
        playlistId: uploadsPlaylistId,
        maxResults: String(Math.min(50, limit - ids.length)),
        ...(pageToken ? { pageToken } : {}),
      },
      PlaylistPage,
    );
    ids.push(...page.items.map((entry) => entry.contentDetails.videoId));
    pageToken = page.nextPageToken;
    if (!pageToken) break;
  }

  const videos: YouTubeVideo[] = [];
  for (let i = 0; i < ids.length; i += 50) {
    const { items } = await call(
      "videos",
      { part: "snippet,statistics,contentDetails", id: ids.slice(i, i + 50).join(",") },
      VideoList,
    );
    for (const item of items) {
      const parsed = VideoItem.safeParse(item);
      if (parsed.success) videos.push(toVideo(parsed.data));
    }
  }
  return videos;
}

function toVideo(video: z.infer<typeof VideoItem>): YouTubeVideo {
  const thumbnails = video.snippet.thumbnails ?? {};
  return {
    videoId: video.id,
    title: video.snippet.title,
    description: video.snippet.description,
    url: `https://www.youtube.com/watch?v=${video.id}`,
    thumbnailUrl: thumbnails.medium?.url ?? thumbnails.default?.url ?? null,
    publishedAt: new Date(video.snippet.publishedAt).toISOString(),
    views: video.statistics.viewCount,
    likes: video.statistics.likeCount,
    comments: video.statistics.commentCount,
    durationSeconds: video.contentDetails?.duration
      ? parseDuration(video.contentDetails.duration)
      : null,
    language: video.snippet.defaultAudioLanguage ?? null,
    categoryId: video.snippet.categoryId ?? null,
  };
}

/** ISO 8601 duration as YouTube emits it: PT1H2M3S. Live streams report P0D. */
export function parseDuration(iso: string): number | null {
  const match = iso.match(/^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!match) return null;
  const [, days, hours, minutes, seconds] = match;
  const total =
    Number(days ?? 0) * 86400 +
    Number(hours ?? 0) * 3600 +
    Number(minutes ?? 0) * 60 +
    Number(seconds ?? 0);
  return total > 0 ? total : null;
}

/* --- Comments ------------------------------------------------------------ */

const CommentPage = z.object({
  items: z
    .array(
      z.object({
        snippet: z.object({
          totalReplyCount: z.number().default(0),
          topLevelComment: z.object({
            snippet: z.object({
              textOriginal: z.string().default(""),
              likeCount: z.number().nullish(),
            }),
          }),
        }),
      }),
    )
    .default([]),
});

export interface YouTubeComment {
  text: string;
  likes: number | null;
  replies: number;
}

/**
 * Top-level comments on one video, ranked by relevance.
 *
 * Comment *quality* is a judgement, and the AI layer makes it — but it has to
 * judge something real. This is where that material comes from: 1 quota unit,
 * no OAuth. A video with comments disabled returns none, which is a fact about
 * the video rather than a failure.
 */
export async function fetchTopComments(
  videoId: string,
  limit = 15,
): Promise<YouTubeComment[]> {
  let page;
  try {
    page = await call(
      "commentThreads",
      {
        part: "snippet",
        videoId,
        maxResults: String(Math.min(100, limit)),
        order: "relevance",
        textFormat: "plainText",
      },
      CommentPage,
    );
  } catch (error) {
    // Disabled comments answer 403 `commentsDisabled`. That is a normal state
    // for a video, not a broken connector, so it yields nothing rather than
    // failing the whole enrichment.
    if (error instanceof ConnectorUnavailable && error.reason === "forbidden") return [];
    throw error;
  }

  return page.items.map((item) => {
    const comment = item.snippet.topLevelComment.snippet;
    return {
      text: comment.textOriginal,
      likes: comment.likeCount ?? null,
      replies: item.snippet.totalReplyCount,
    };
  });
}

/* --- Observation --------------------------------------------------------- */

export interface YouTubeObservation {
  channel: YouTubeChannel;
  recentContent: YouTubeVideo[];
  provenance: Provenance;
  quotaUnitsSpent: number;
}

/**
 * One collection pass: identity, channel statistics and recent uploads, stamped
 * with the provenance every SocialOrbit fact must carry (DPR §16.1).
 *
 * Confidence is 90, not 100: these are authoritative platform figures, but read
 * without OAuth, so nothing here is `verified` — only `observed`.
 */
export async function observeChannel(
  input: string,
  videoLimit = 25,
): Promise<YouTubeObservation | null> {
  const channel = await fetchChannel(input);
  if (!channel) return null;

  const recentContent = channel.uploadsPlaylistId
    ? await fetchRecentVideos(channel.uploadsPlaylistId, videoLimit)
    : [];

  const pages = Math.ceil(recentContent.length / 50);

  return {
    channel,
    recentContent,
    provenance: {
      tier: "platform_api",
      kind: "observed",
      collectedAt: new Date().toISOString(),
      verifiedAt: null,
      sourceUrl: channel.url,
      confidence: 90,
      ai: null,
    },
    quotaUnitsSpent: QUOTA_COST.channels + pages * (QUOTA_COST.playlistItems + QUOTA_COST.videos),
  };
}
