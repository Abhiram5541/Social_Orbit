import type { Platform } from "@/lib/contracts/common";
import type { RawContent } from "@/server/data/records";
import { readRecords } from "@/server/data/records";

/* ---------------------------------------------------------------------------
 * Campaign attribution — Architecture §10.
 *
 * A campaign post is one this platform actually indexed: a content row that
 * carries the campaign's tracking hashtag, belongs to a participant, sits
 * inside the campaign window and is on a platform the campaign runs on.
 *
 * Everything here reads the same `content` rows every profile is scored from,
 * so an attributed post carries its real URL, caption, publish time and
 * figures. Nothing is modelled: a campaign with no matching posts reports
 * zero and says so, which is the only honest answer before its creators have
 * published — and the reason the previous modelled version had to go.
 *
 * Detection is exact-token, not substring: `#launch` must not match
 * `#launchday`. Manual overrides exist because detection misses posts (a
 * creator forgets the tag, or writes it in a pinned comment), and an operator
 * correcting that is evidence too — each override records who made it and
 * when.
 * ------------------------------------------------------------------------ */

export const ATTRIBUTION_VERSION = "attribution-1.0.0";

/** Operator corrections to automatic detection. Content ids. */
export interface AttributionOverrides {
  include: string[];
  exclude: string[];
}

export interface AttributionWindow {
  hashtag: string;
  platforms: Platform[];
  startsOn: string;
  endsOn: string;
  overrides?: AttributionOverrides;
}

/** `#Launch` and `launch` are the same tag; `#launchday` is not. */
const normaliseTag = (tag: string): string => tag.trim().replace(/^#+/, "").toLowerCase();

/**
 * A post also counts when the creator put the tag in the title or caption
 * rather than where the platform exposes structured tags — Instagram returns
 * the caption as one string, and a YouTube creator often tags in the title.
 */
function carriesTag(item: RawContent, tag: string): boolean {
  if (item.hashtags.some((entry) => normaliseTag(entry) === tag)) return true;
  const text = `${item.title} ${item.caption}`.toLowerCase();
  // Word-boundary either side so `#launchday` does not satisfy `#launch`.
  return new RegExp(`(^|[^\\w])#${tag}([^\\w]|$)`).test(text);
}

function inWindow(item: RawContent, startsOn: string, endsOn: string): boolean {
  const day = item.publishedAt.slice(0, 10);
  return day >= startsOn && day <= endsOn;
}

/**
 * Every indexed post attributable to one creator on one campaign, newest
 * first. An excluded id never returns; an included id returns whatever the
 * creator actually published, window and hashtag notwithstanding.
 */
export function attributedPostsFor(
  influencerId: string,
  window: AttributionWindow,
): RawContent[] {
  const tag = normaliseTag(window.hashtag);
  const exclude = new Set(window.overrides?.exclude ?? []);
  const include = new Set(window.overrides?.include ?? []);
  const platforms = new Set(window.platforms);

  return readRecords()
    .content.filter((item) => item.influencerId === influencerId)
    .filter((item) => !exclude.has(item.id))
    .filter(
      (item) =>
        include.has(item.id) ||
        (platforms.has(item.platform) &&
          inWindow(item, window.startsOn, window.endsOn) &&
          carriesTag(item, tag)),
    )
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

export interface AttributedTotals {
  posts: number;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  engagements: number | null;
  /** Engagements over views, as a percentage. Null without observed views. */
  engagementRate: number | null;
}

/**
 * Sums over attributed posts. A metric no platform reported stays null rather
 * than summing to zero — Instagram publishes no view count, and reporting a
 * campaign's reach as 0 because of that would be a measurement nobody made.
 */
export function totalsOf(posts: RawContent[]): AttributedTotals {
  const sum = (pick: (item: RawContent) => number | null): number | null => {
    const values = posts.map(pick).filter((value): value is number => value !== null);
    return values.length === 0 ? null : values.reduce((total, value) => total + value, 0);
  };

  const views = sum((item) => item.views);
  const likes = sum((item) => item.likes);
  const comments = sum((item) => item.comments);
  const shares = sum((item) => item.shares);
  const engagements =
    likes === null && comments === null && shares === null
      ? null
      : (likes ?? 0) + (comments ?? 0) + (shares ?? 0);

  return {
    posts: posts.length,
    views,
    likes,
    comments,
    shares,
    engagements,
    engagementRate:
      engagements === null || views === null || views <= 0
        ? null
        : Number(((engagements / views) * 100).toFixed(2)),
  };
}

/**
 * Campaign performance score — deterministic and versioned, and deliberately
 * distinct from the health score. Reach and engagement are only scored where
 * they were observed; delivery is always scored, because a post count is
 * always known.
 */
export const CAMPAIGN_FORMULA_VERSION = "campaign-2.0.0";

export function campaignScoreOf(
  totals: AttributedTotals,
  requiredPosts: number | null,
): number | null {
  if (totals.posts === 0) return null;

  const components: { value: number; weight: number }[] = [];
  if (totals.views !== null) {
    components.push({ value: Math.min(100, Math.log10(1 + totals.views) * 16), weight: 0.4 });
  }
  if (totals.engagementRate !== null) {
    components.push({ value: Math.min(100, totals.engagementRate * 18), weight: 0.4 });
  }
  // Delivery against what was asked for; without a deliverable, against one post.
  const target = requiredPosts && requiredPosts > 0 ? requiredPosts : 1;
  components.push({
    value: Math.min(100, (totals.posts / target) * 100),
    weight: 0.2,
  });

  const covered = components.reduce((sum, component) => sum + component.weight, 0);
  const total = components.reduce((sum, component) => sum + component.value * component.weight, 0);
  return Number((total / covered).toFixed(1));
}
