import type { SessionUser } from "@/lib/contracts/auth";
import type { Platform } from "@/lib/contracts/common";
import { ApiFailure } from "@/server/auth/rbac";
import { readRecords } from "@/server/data/records";
import { toSummary } from "@/server/repositories/influencer-repository";

/* ---------------------------------------------------------------------------
 * Listening — across the creators SENSO has indexed, not across the platform.
 *
 * The requirement asked for consumer intelligence and social listening. The
 * honest half of that is buildable today and the other half is not, so the
 * naming says which is which rather than shipping one under the other's name.
 *
 * What exists: 400k+ indexed posts from ~9k creators, with their titles,
 * captions, hashtags and figures. A brand, product or theme can be tracked
 * through that corpus — who is talking about it, how often, with what reach,
 * which tags travel with it, and how that moves week to week. That is
 * *creator* listening, and it is what an influencer platform is uniquely
 * placed to do.
 *
 * What does not exist: listening to consumers. SENSO holds no consumer posts,
 * no reviews, no forum threads and no comment corpus, and no public API
 * offers them. Every read here therefore carries its own coverage statement —
 * how many creators and posts it searched — so a share of voice is never
 * mistaken for a share of the internet. Building the consumer half needs a
 * licensed listening source; the shape below would take it without changing.
 * ------------------------------------------------------------------------ */

export const LISTENING_VERSION = "listening-1.0.0";

export interface ListeningMention {
  contentId: string;
  influencerId: string;
  displayName: string;
  platform: Platform;
  title: string;
  url: string;
  publishedAt: string;
  views: number | null;
  engagements: number | null;
  /** Which field carried the term. */
  matchedIn: "hashtag" | "title" | "caption";
}

export interface ListeningResult {
  term: string;
  from: string;
  to: string;
  mentions: number;
  creators: number;
  /** Null when no platform in the set reported a view count (D44). */
  views: number | null;
  engagements: number | null;
  /** Mentions per ISO week, oldest first. */
  timeline: { week: string; mentions: number; views: number | null }[];
  topCreators: {
    influencerId: string;
    displayName: string;
    primaryHandle: string;
    mentions: number;
    followers: number | null;
    healthScore: number | null;
    views: number | null;
  }[];
  /** Tags that travel with this one. */
  coTags: { tag: string; count: number }[];
  examples: ListeningMention[];
  /** What was actually searched, so a share is read against its base. */
  coverage: { creatorsIndexed: number; postsSearched: number; postsInWindow: number };
  version: string;
}

const normalise = (term: string): string => term.trim().replace(/^#+/, "").toLowerCase();

/**
 * Exact token, both as a hashtag and as a word in the text — the same rule
 * campaign attribution uses, for the same reason: `nike` must not match
 * `nikes` by accident of substring, and `#launch` must not match
 * `#launchday`.
 */
function matchOf(
  item: { hashtags: string[]; title: string; caption: string },
  term: string,
): ListeningMention["matchedIn"] | null {
  if (item.hashtags.some((tag) => normalise(tag) === term)) return "hashtag";
  const word = new RegExp(`(^|[^\\w#])#?${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^\\w]|$)`, "i");
  if (word.test(item.title)) return "title";
  if (word.test(item.caption)) return "caption";
  return null;
}

/** Monday of the ISO week, so buckets are stable across runs. */
function weekOf(iso: string): string {
  const date = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  const day = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - day);
  return date.toISOString().slice(0, 10);
}

export function listen(
  _user: SessionUser,
  input: { term: string; from?: string; to?: string; platforms?: Platform[]; limit?: number },
): ListeningResult {
  const term = normalise(input.term);
  if (term.length < 2) throw new ApiFailure("validation_failed", "Give a term of at least two characters.");

  const data = readRecords();
  const to = input.to ?? new Date().toISOString().slice(0, 10);
  const from =
    input.from ??
    new Date(Date.now() - 180 * 86_400_000).toISOString().slice(0, 10);

  const platforms = input.platforms?.length ? new Set(input.platforms) : null;
  let postsInWindow = 0;
  const hits: { item: (typeof data.content)[number]; matchedIn: ListeningMention["matchedIn"] }[] = [];

  for (const item of data.content) {
    if (platforms && !platforms.has(item.platform)) continue;
    const day = item.publishedAt.slice(0, 10);
    if (day < from || day > to) continue;
    postsInWindow += 1;
    const matchedIn = matchOf(item, term);
    if (matchedIn) hits.push({ item, matchedIn });
  }

  const engagementOf = (item: (typeof data.content)[number]): number | null =>
    item.likes === null && item.comments === null && item.shares === null
      ? null
      : (item.likes ?? 0) + (item.comments ?? 0) + (item.shares ?? 0);

  const sumOrNull = <T>(rows: T[], read: (row: T) => number | null): number | null =>
    rows.length === 0 || rows.every((row) => read(row) === null)
      ? null
      : rows.reduce((total, row) => total + (read(row) ?? 0), 0);

  // By week.
  const weeks = new Map<string, { mentions: number; views: number[] }>();
  for (const hit of hits) {
    const week = weekOf(hit.item.publishedAt);
    const bucket = weeks.get(week) ?? weeks.set(week, { mentions: 0, views: [] }).get(week)!;
    bucket.mentions += 1;
    if (hit.item.views !== null) bucket.views.push(hit.item.views);
  }

  // By creator.
  const byCreator = new Map<string, { mentions: number; views: (number | null)[] }>();
  for (const hit of hits) {
    const row =
      byCreator.get(hit.item.influencerId) ??
      byCreator.set(hit.item.influencerId, { mentions: 0, views: [] }).get(hit.item.influencerId)!;
    row.mentions += 1;
    row.views.push(hit.item.views);
  }

  // Tags that travel with the term.
  const coTags = new Map<string, number>();
  for (const hit of hits) {
    for (const tag of hit.item.hashtags) {
      const normalised = normalise(tag);
      if (normalised === term || normalised.length < 2) continue;
      coTags.set(normalised, (coTags.get(normalised) ?? 0) + 1);
    }
  }

  const topCreators = [...byCreator.entries()]
    .sort((a, b) => b[1].mentions - a[1].mentions)
    .slice(0, input.limit ?? 12)
    .map(([influencerId, row]) => {
      const summary = toSummary(influencerId);
      return {
        influencerId,
        displayName: summary?.displayName ?? influencerId,
        primaryHandle: summary?.primaryHandle ?? "",
        mentions: row.mentions,
        followers: summary?.followers ?? null,
        healthScore: summary?.healthScore ?? null,
        views: sumOrNull(row.views, (value) => value),
      };
    });

  const examples = hits
    .sort((a, b) => b.item.publishedAt.localeCompare(a.item.publishedAt))
    .slice(0, 12)
    .map(({ item, matchedIn }) => ({
      contentId: item.id,
      influencerId: item.influencerId,
      displayName: toSummary(item.influencerId)?.displayName ?? item.influencerId,
      platform: item.platform,
      title: item.title,
      url: item.url,
      publishedAt: item.publishedAt,
      views: item.views,
      engagements: engagementOf(item),
      matchedIn,
    }));

  return {
    term,
    from,
    to,
    mentions: hits.length,
    creators: byCreator.size,
    views: sumOrNull(hits, (hit) => hit.item.views),
    engagements: sumOrNull(hits, (hit) => engagementOf(hit.item)),
    timeline: [...weeks.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([week, bucket]) => ({
        week,
        mentions: bucket.mentions,
        views: bucket.views.length === 0 ? null : bucket.views.reduce((a, b) => a + b, 0),
      })),
    topCreators,
    coTags: [...coTags.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([tag, count]) => ({ tag, count })),
    examples,
    coverage: {
      creatorsIndexed: data.influencers.length,
      postsSearched: data.content.length,
      postsInWindow,
    },
    version: LISTENING_VERSION,
  };
}

/**
 * Several terms side by side. The share is of *these* terms within SENSO's
 * corpus — stated in the label, because a share of voice with no denominator
 * is the most quotable wrong number a listening tool can produce.
 */
export function shareOfConversation(
  user: SessionUser,
  terms: string[],
  window: { from?: string; to?: string } = {},
): {
  terms: { term: string; mentions: number; creators: number; views: number | null; share: number }[];
  totalMentions: number;
  coverage: ListeningResult["coverage"];
  version: string;
} {
  if (terms.length === 0) throw new ApiFailure("validation_failed", "Give at least one term.");
  const results = terms.slice(0, 6).map((term) => listen(user, { ...window, term, limit: 1 }));
  const totalMentions = results.reduce((total, result) => total + result.mentions, 0);

  return {
    terms: results.map((result) => ({
      term: result.term,
      mentions: result.mentions,
      creators: result.creators,
      views: result.views,
      share: totalMentions === 0 ? 0 : Number(((result.mentions / totalMentions) * 100).toFixed(1)),
    })),
    totalMentions,
    coverage: results[0].coverage,
    version: LISTENING_VERSION,
  };
}
