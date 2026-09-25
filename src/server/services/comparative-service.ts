import type { SessionUser } from "@/lib/contracts/auth";
import type { Platform } from "@/lib/contracts/common";
import { median } from "@/server/analytics/metrics";
import { appRows, persist } from "@/server/data/app-store";
import { readRecords } from "@/server/data/records";
import { ApiFailure, assertTenantAccess } from "@/server/auth/rbac";
import { toSummary } from "@/server/repositories/influencer-repository";
import { getCampaign, listCampaigns } from "@/server/repositories/workspace-repository";

/* ---------------------------------------------------------------------------
 * Comparative intelligence: watchlists, share of voice, cross-network
 * analytics and campaign benchmarking.
 *
 * Everything here compares things this platform already observed. Two rules
 * carry through from the scoring engine:
 *
 *   - A share is only a share of what was measured. Instagram publishes no
 *     view count, so a share-of-views figure that quietly treated those
 *     posts as zero would understate every Instagram creator in the set.
 *     Each measure reports how much of the set it could actually read.
 *   - These are a *client's* own intelligence, over watchlists that client
 *     built, so they are gated on the client workspace's own permissions.
 *     Gating them on `analytics:read` — a platform-staff permission — left a
 *     client owner unable to read their own competitor data.
 *   - Networks are not interchangeable. A cross-network total is labelled by
 *     what it sums; an engagement rate is never averaged across platforms
 *     whose denominators differ, it is reported per network.
 * ------------------------------------------------------------------------ */

export const COMPARATIVE_VERSION = "comparative-1.0.0";

/* --- Watchlists --------------------------------------------------------- */

export interface Watchlist {
  id: string;
  orgId: string;
  name: string;
  /** What this list represents: our creators, a competitor's, a category. */
  kind: "own" | "competitor" | "category";
  influencerIds: string[];
  /** Terms that count as a mention of this brand in a caption or title. */
  terms: string[];
  createdAt: string;
  updatedAt: string;
}

const watchlists = () => appRows<Watchlist>("watchlists", () => []);

const nextId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function listWatchlists(user: SessionUser): Watchlist[] {
  return watchlists()
    .filter((row) => row.orgId === user.orgId)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function createWatchlist(
  user: SessionUser,
  input: { name: string; kind: Watchlist["kind"]; influencerIds: string[]; terms: string[] },
): Watchlist {
  const now = new Date().toISOString();
  const row: Watchlist = {
    id: nextId("wl"),
    orgId: user.orgId,
    name: input.name,
    kind: input.kind,
    influencerIds: [...new Set(input.influencerIds)],
    terms: [...new Set(input.terms.map((term) => term.trim().toLowerCase()).filter(Boolean))],
    createdAt: now,
    updatedAt: now,
  };
  watchlists().push(row);
  persist("watchlists", [row]);
  return row;
}

export function deleteWatchlist(user: SessionUser, id: string): void {
  const row = watchlists().find((entry) => entry.id === id);
  if (!row) throw new ApiFailure("not_found", "Watchlist not found.");
  assertTenantAccess(user, row.orgId);
  const list = watchlists();
  list.splice(list.indexOf(row), 1);
  persist("watchlists", list.filter((entry) => entry.orgId === user.orgId));
}

/* --- Share of voice ----------------------------------------------------- */

export interface VoiceRow {
  watchlistId: string;
  name: string;
  kind: Watchlist["kind"];
  creators: number;
  mentions: number;
  /** Engagement on the posts that mentioned it. */
  engagements: number;
  views: number | null;
  sharePctByMentions: number;
  sharePctByEngagement: number;
  /** Share of views, only where every list had views to read. */
  sharePctByViews: number | null;
}

export interface ShareOfVoice {
  from: string;
  to: string;
  rows: VoiceRow[];
  /** Posts read across every watchlist, so coverage is visible. */
  postsScanned: number;
  /** True when at least one post in the window reported no view count. */
  viewsIncomplete: boolean;
  version: string;
}

const mentionsTerm = (text: string, term: string): boolean => {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}([^\\p{L}\\p{N}]|$)`, "iu").test(text);
};

/**
 * Share of voice across the organisation's watchlists over a window.
 *
 * A "mention" is a post by a creator on the list whose text carries one of
 * the list's terms — or, where a list defines no terms, any post by those
 * creators. Both are stated, because they answer different questions and
 * mixing them silently would make one list look louder than it is.
 */
export function shareOfVoice(user: SessionUser, from: string, to: string): ShareOfVoice {
  const lists = listWatchlists(user);
  const content = readRecords().content.filter((item) => {
    const day = item.publishedAt.slice(0, 10);
    return day >= from && day <= to;
  });

  let postsScanned = 0;
  let viewsIncomplete = false;

  const raw = lists.map((list) => {
    const members = new Set(list.influencerIds);
    const posts = content.filter(
      (item) =>
        members.has(item.influencerId) &&
        (list.terms.length === 0 ||
          list.terms.some((term) => mentionsTerm(`${item.title} ${item.caption}`, term))),
    );
    postsScanned += posts.length;

    const engagements = posts.reduce(
      (total, post) => total + (post.likes ?? 0) + (post.comments ?? 0) + (post.shares ?? 0),
      0,
    );
    const withViews = posts.filter((post) => post.views !== null);
    if (withViews.length !== posts.length) viewsIncomplete = true;

    return {
      list,
      mentions: posts.length,
      engagements,
      views: withViews.length === 0 ? null : withViews.reduce((t, p) => t + (p.views ?? 0), 0),
    };
  });

  const totalMentions = raw.reduce((total, row) => total + row.mentions, 0);
  const totalEngagements = raw.reduce((total, row) => total + row.engagements, 0);
  const everyListHasViews = raw.every((row) => row.views !== null);
  const totalViews = everyListHasViews
    ? raw.reduce((total, row) => total + (row.views ?? 0), 0)
    : null;

  const pct = (part: number, whole: number) =>
    whole === 0 ? 0 : Number(((part / whole) * 100).toFixed(1));

  return {
    from,
    to,
    postsScanned,
    viewsIncomplete,
    version: COMPARATIVE_VERSION,
    rows: raw
      .map((row) => ({
        watchlistId: row.list.id,
        name: row.list.name,
        kind: row.list.kind,
        creators: row.list.influencerIds.length,
        mentions: row.mentions,
        engagements: row.engagements,
        views: row.views,
        sharePctByMentions: pct(row.mentions, totalMentions),
        sharePctByEngagement: pct(row.engagements, totalEngagements),
        // Withheld unless every list had views to contribute — a share
        // computed over a partial denominator flatters whoever was measured.
        sharePctByViews:
          totalViews === null || row.views === null ? null : pct(row.views, totalViews),
      }))
      .sort((a, b) => b.sharePctByEngagement - a.sharePctByEngagement),
  };
}

/* --- Cross-network analytics -------------------------------------------- */

export interface NetworkSlice {
  platform: Platform;
  creators: number;
  followers: number;
  posts: number;
  engagements: number;
  views: number | null;
  /** Per network: denominators differ, so this is never averaged across. */
  engagementRatePct: number | null;
  /** What the rate is measured against on this network. */
  engagementBasis: "views" | "followers";
}

export interface CrossNetwork {
  from: string;
  to: string;
  networks: NetworkSlice[];
  totals: { creators: number; followers: number; posts: number; engagements: number };
  version: string;
}

/**
 * The same roster read per network. Totals that can be summed are summed;
 * an engagement rate is not, because YouTube measures it against views and
 * Instagram against followers, and one number over both would be arithmetic
 * on two different things.
 */
export function crossNetwork(
  influencerIds: string[],
  from: string,
  to: string,
): CrossNetwork {
  const members = new Set(influencerIds);
  const records = readRecords();
  const accounts = records.accounts.filter((account) => members.has(account.influencerId));
  const posts = records.content.filter((item) => {
    const day = item.publishedAt.slice(0, 10);
    return members.has(item.influencerId) && day >= from && day <= to;
  });

  const platforms = [...new Set(accounts.map((account) => account.platform))];
  const networks: NetworkSlice[] = platforms.map((platform) => {
    const platformAccounts = accounts.filter((account) => account.platform === platform);
    const platformPosts = posts.filter((item) => item.platform === platform);
    const followers = platformAccounts.reduce((total, account) => total + account.followers, 0);
    const engagements = platformPosts.reduce(
      (total, post) => total + (post.likes ?? 0) + (post.comments ?? 0) + (post.shares ?? 0),
      0,
    );
    const withViews = platformPosts.filter((post) => post.views !== null);
    const views = withViews.length === 0 ? null : withViews.reduce((t, p) => t + (p.views ?? 0), 0);
    const basis: NetworkSlice["engagementBasis"] = platform === "youtube" ? "views" : "followers";
    const denominator = basis === "views" ? views : followers;

    return {
      platform,
      creators: new Set(platformAccounts.map((account) => account.influencerId)).size,
      followers,
      posts: platformPosts.length,
      engagements,
      views,
      engagementRatePct:
        !denominator || denominator <= 0 || platformPosts.length === 0
          ? null
          : Number(((engagements / denominator) * 100).toFixed(2)),
      engagementBasis: basis,
    };
  });

  return {
    from,
    to,
    networks: networks.sort((a, b) => b.followers - a.followers),
    totals: {
      creators: members.size,
      followers: networks.reduce((total, network) => total + network.followers, 0),
      posts: networks.reduce((total, network) => total + network.posts, 0),
      engagements: networks.reduce((total, network) => total + network.engagements, 0),
    },
    version: COMPARATIVE_VERSION,
  };
}

/* --- Campaign benchmarking ---------------------------------------------- */

export interface CampaignBenchmark {
  campaignId: string;
  campaignName: string;
  metrics: {
    key: string;
    label: string;
    value: number | null;
    cohortMedian: number | null;
    percentile: number | null;
    higherIsBetter: boolean;
  }[];
  cohortSize: number;
  /** Below this the cohort publishes nothing, as benchmarks do everywhere. */
  published: boolean;
  version: string;
}

const MIN_COHORT = 3;

/**
 * A campaign against this organisation's other completed campaigns.
 *
 * The cohort is the organisation's own history, not the market: comparing a
 * client's cost per engagement against other clients' negotiated rates would
 * leak the most commercially sensitive number in the product. Below three
 * comparable campaigns nothing is published — a percentile against one other
 * campaign is noise.
 */
export function campaignBenchmark(user: SessionUser, campaignId: string): CampaignBenchmark {
  const campaign = getCampaign(user, campaignId);
  if (!campaign) throw new ApiFailure("not_found", "Campaign not found.");

  const peers = listCampaigns(user)
    .filter((entry) => entry.id !== campaignId && entry.attributedPosts > 0)
    .map((entry) => getCampaign(user, entry.id))
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

  const measure = (detail: NonNullable<ReturnType<typeof getCampaign>>) => {
    const posts = detail.attributedPosts;
    const engagements = detail.totalEngagements ?? 0;
    const views = detail.totalReach;
    const spend = detail.spentAmount ?? 0;
    return {
      postsPerCreator: detail.participantCount === 0 ? null : posts / detail.participantCount,
      engagementPerPost: posts === 0 ? null : engagements / posts,
      viewsPerPost: views === null || posts === 0 ? null : views / posts,
      costPerEngagement: engagements === 0 || spend === 0 ? null : spend / engagements,
      fulfilmentPct: detail.fulfilmentPercent,
    };
  };

  const mine = measure(campaign);
  const theirs = peers.map(measure);

  const spec: { key: keyof typeof mine; label: string; higherIsBetter: boolean }[] = [
    { key: "postsPerCreator", label: "Posts per creator", higherIsBetter: true },
    { key: "engagementPerPost", label: "Engagements per post", higherIsBetter: true },
    { key: "viewsPerPost", label: "Views per post", higherIsBetter: true },
    { key: "costPerEngagement", label: "Cost per engagement", higherIsBetter: false },
    { key: "fulfilmentPct", label: "Fulfilment", higherIsBetter: true },
  ];

  const published = peers.length >= MIN_COHORT;

  return {
    campaignId,
    campaignName: campaign.name,
    cohortSize: peers.length,
    published,
    version: COMPARATIVE_VERSION,
    metrics: spec.map(({ key, label, higherIsBetter }) => {
      const value = mine[key];
      const peerValues = theirs
        .map((entry) => entry[key])
        .filter((entry): entry is number => entry !== null);
      const cohortMedian = published ? median(peerValues) : null;
      const percentile =
        !published || value === null || peerValues.length === 0
          ? null
          : Number(
              (
                (peerValues.filter((peer) => (higherIsBetter ? peer < value : peer > value)).length /
                  peerValues.length) *
                100
              ).toFixed(0),
            );
      return { key, label, value, cohortMedian, percentile, higherIsBetter };
    }),
  };
}

/** Creators shared between two watchlists — the overlap the spec asks for. */
export function watchlistOverlap(user: SessionUser, aId: string, bId: string) {
  const lists = listWatchlists(user);
  const a = lists.find((row) => row.id === aId);
  const b = lists.find((row) => row.id === bId);
  if (!a || !b) throw new ApiFailure("not_found", "Watchlist not found.");

  const bSet = new Set(b.influencerIds);
  const shared = a.influencerIds.filter((id) => bSet.has(id));
  return {
    a: { id: a.id, name: a.name, creators: a.influencerIds.length },
    b: { id: b.id, name: b.name, creators: b.influencerIds.length },
    shared: shared.map((id) => ({
      influencerId: id,
      displayName: toSummary(id)?.displayName ?? id,
    })),
    // Jaccard: shared over the union, so two lists of very different sizes
    // are not reported as highly similar just because the small one nests.
    overlapPct: Number(
      (
        (shared.length / new Set([...a.influencerIds, ...b.influencerIds]).size) *
        100
      ).toFixed(1),
    ),
  };
}

/* --- Topic overlap and movement ------------------------------------------
 * Two things the watchlist comparison could not answer: what the two sets
 * talk about in common, and whether either is moving.
 * ---------------------------------------------------------------------- */

export interface TopicOverlap {
  a: { id: string; name: string };
  b: { id: string; name: string };
  /** Tags both sets use, with how often each side uses them. */
  shared: { tag: string; aCount: number; bCount: number }[];
  /** Tags only one side uses — where the two sets actually differ. */
  onlyA: { tag: string; count: number }[];
  onlyB: { tag: string; count: number }[];
  /** Jaccard over the tag sets, 0–100. */
  similarity: number;
  postsRead: number;
}

function tagCounts(influencerIds: string[], from: string, to: string): Map<string, number> {
  const ids = new Set(influencerIds);
  const counts = new Map<string, number>();
  for (const item of readRecords().content) {
    if (!ids.has(item.influencerId)) continue;
    const day = item.publishedAt.slice(0, 10);
    if (day < from || day > to) continue;
    for (const tag of item.hashtags) {
      const normalised = tag.trim().replace(/^#+/, "").toLowerCase();
      if (normalised.length < 2) continue;
      counts.set(normalised, (counts.get(normalised) ?? 0) + 1);
    }
  }
  return counts;
}

export function topicOverlap(
  user: SessionUser,
  aId: string,
  bId: string,
  window: { from?: string; to?: string } = {},
): TopicOverlap {
  const lists = listWatchlists(user);
  const a = lists.find((list) => list.id === aId);
  const b = lists.find((list) => list.id === bId);
  if (!a || !b) throw new ApiFailure("not_found", "Watchlist not found.");

  const to = window.to ?? new Date().toISOString().slice(0, 10);
  const from = window.from ?? new Date(Date.now() - 180 * 86_400_000).toISOString().slice(0, 10);

  const countsA = tagCounts(a.influencerIds, from, to);
  const countsB = tagCounts(b.influencerIds, from, to);

  const shared: TopicOverlap["shared"] = [];
  for (const [tag, aCount] of countsA) {
    const bCount = countsB.get(tag);
    if (bCount !== undefined) shared.push({ tag, aCount, bCount });
  }
  shared.sort((x, y) => y.aCount + y.bCount - (x.aCount + x.bCount));

  const union = new Set([...countsA.keys(), ...countsB.keys()]);

  return {
    a: { id: a.id, name: a.name },
    b: { id: b.id, name: b.name },
    shared: shared.slice(0, 20),
    onlyA: [...countsA.entries()]
      .filter(([tag]) => !countsB.has(tag))
      .sort((x, y) => y[1] - x[1])
      .slice(0, 12)
      .map(([tag, count]) => ({ tag, count })),
    onlyB: [...countsB.entries()]
      .filter(([tag]) => !countsA.has(tag))
      .sort((x, y) => y[1] - x[1])
      .slice(0, 12)
      .map(([tag, count]) => ({ tag, count })),
    similarity: union.size === 0 ? 0 : Number(((shared.length / union.size) * 100).toFixed(1)),
    postsRead: [...countsA.values(), ...countsB.values()].reduce((sum, count) => sum + count, 0),
  };
}

export interface WatchlistMovement {
  watchlistId: string;
  name: string;
  /** The two windows compared, so the reader can see what "change" means. */
  current: { from: string; to: string; posts: number; views: number | null };
  previous: { from: string; to: string; posts: number; views: number | null };
  postsChangePct: number | null;
  viewsChangePct: number | null;
  /** Tags that rose or appeared, strongest first. */
  rising: { tag: string; now: number; before: number }[];
  /** Null when the previous window holds nothing to compare against. */
  comparable: boolean;
}

/**
 * Whether a watchlist is moving, by comparing two equal windows.
 *
 * A percentage change needs both windows to hold something. When the earlier
 * one is empty the change is reported as null rather than as infinite growth
 * — the creators may simply not have been indexed yet, which is a fact about
 * SENSO rather than about them (D19's rule, applied to a comparison).
 */
export function watchlistMovement(
  user: SessionUser,
  watchlistId: string,
  days = 30,
): WatchlistMovement {
  const list = listWatchlists(user).find((entry) => entry.id === watchlistId);
  if (!list) throw new ApiFailure("not_found", "Watchlist not found.");

  const day = (offset: number) =>
    new Date(Date.now() - offset * 86_400_000).toISOString().slice(0, 10);
  const windows = {
    current: { from: day(days), to: day(0) },
    previous: { from: day(days * 2), to: day(days + 1) },
  };

  const ids = new Set(list.influencerIds);
  const measure = (from: string, to: string) => {
    let posts = 0;
    let views: number | null = null;
    for (const item of readRecords().content) {
      if (!ids.has(item.influencerId)) continue;
      const published = item.publishedAt.slice(0, 10);
      if (published < from || published > to) continue;
      posts += 1;
      if (item.views !== null) views = (views ?? 0) + item.views;
    }
    return { from, to, posts, views };
  };

  const current = measure(windows.current.from, windows.current.to);
  const previous = measure(windows.previous.from, windows.previous.to);

  const change = (now: number | null, before: number | null): number | null =>
    now === null || before === null || before === 0
      ? null
      : Number((((now - before) / before) * 100).toFixed(1));

  const now = tagCounts(list.influencerIds, windows.current.from, windows.current.to);
  const before = tagCounts(list.influencerIds, windows.previous.from, windows.previous.to);
  const rising = [...now.entries()]
    .map(([tag, count]) => ({ tag, now: count, before: before.get(tag) ?? 0 }))
    .filter((entry) => entry.now > entry.before)
    .sort((x, y) => y.now - y.before - (x.now - x.before))
    .slice(0, 10);

  return {
    watchlistId: list.id,
    name: list.name,
    current,
    previous,
    postsChangePct: change(current.posts, previous.posts),
    viewsChangePct: change(current.views, previous.views),
    rising,
    comparable: previous.posts > 0,
  };
}
