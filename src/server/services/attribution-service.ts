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
  /**
   * Extra signals a post may carry instead of the tracking hashtag. A creator
   * who wrote "@brand" and never tagged, or whose caption names the product,
   * published for the campaign just the same — and on Instagram, where the
   * caption arrives as one string, this is often the only signal there is.
   */
  mentions?: string[];
  keywords?: string[];
}

/** `#Launch` and `launch` are the same tag; `#launchday` is not. */
const normaliseTag = (tag: string): string => tag.trim().replace(/^#+/, "").toLowerCase();

/** `@Brand` and `brand` are the same handle. */
const normaliseMention = (mention: string): string =>
  mention.trim().replace(/^@+/, "").toLowerCase();

const escape = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Why a post was attributed. Kept per post so a row can defend itself. */
export type MatchSignal = "hashtag" | "mention" | "keyword" | "manual";

/**
 * A post also counts when the creator put the tag in the title rather than
 * where the platform exposes structured tags — a YouTube creator often does.
 *
 * `hashtags` is extracted at ingestion from the *whole* description, while
 * `caption` stores only its first 400 characters, so the array is already a
 * superset of anything a caption scan could find. Reading the caption here
 * adds nothing and costs the largest field in the database.
 */
function carriesTag(item: RawContent, tag: string): boolean {
  if (item.hashtags.some((entry) => normaliseTag(entry) === tag)) return true;
  const text = `${item.title} ${item.caption ?? ""}`.toLowerCase();
  // Word-boundary either side so `#launchday` does not satisfy `#launch`.
  return new RegExp(`(^|[^\\w])#${escape(tag)}([^\\w]|$)`).test(text);
}

/**
 * An `@handle` the post names. Reads the extracted array first, for the same
 * reason hashtags does: it was taken from the whole text, and the stored
 * caption is truncated.
 */
function carriesMention(item: RawContent, mention: string): boolean {
  if (!mention) return false;
  if ((item.mentions ?? []).some((entry) => normaliseMention(entry) === mention)) return true;
  const text = `${item.title} ${item.caption ?? ""}`.toLowerCase();
  return new RegExp(`(^|[^\\w])@${escape(mention)}([^\\w]|$)`).test(text);
}

/**
 * A phrase in the post's own words. Whole-word so "air" does not match
 * "airport" — the same rule the brand-safety scanner uses, for the same
 * reason: a substring match on someone's livelihood is not evidence.
 */
function carriesKeyword(item: RawContent, keyword: string): boolean {
  const term = keyword?.trim().toLowerCase();
  // Unlike tags and mentions there is no extracted array for an arbitrary
  // phrase, so this one genuinely needs the text. Under slim loading the
  // caption is absent and the daily refresh resolves keyword matches into
  // explicit includes instead (see resolveKeywordMatches).
  // An empty term would compile to a regex that matches every post, which is
  // the worst possible failure here: a campaign that silently claims credit
  // for everything its participants published.
  if (!term) return false;
  const text = `${item.title} ${item.caption}`.toLowerCase();
  return new RegExp(`(^|[^\\w])${escape(term)}([^\\w]|$)`).test(text);
}

/** Which signal put this post in the campaign, or null if none did. */
export function signalFor(item: RawContent, window: AttributionWindow): MatchSignal | null {
  if (window.overrides?.include.includes(item.id)) return "manual";
  if (carriesTag(item, normaliseTag(window.hashtag))) return "hashtag";
  if ((window.mentions ?? []).some((mention) => carriesMention(item, normaliseMention(mention)))) {
    return "mention";
  }
  if ((window.keywords ?? []).some((keyword) => carriesKeyword(item, keyword))) return "keyword";
  return null;
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
          signalFor(item, window) !== null),
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

/* --- Compliance ----------------------------------------------------------
 * A post can be attributed and still not be what was asked for. The
 * deliverable states what the caption has to carry; this checks the
 * platform's own copy of it rather than asking the creator to confirm.
 * ---------------------------------------------------------------------- */

export interface ComplianceCheck {
  /** What was required, in the words the campaign used. */
  requirement: string;
  kind: "hashtag" | "mention" | "phrase";
  met: boolean;
}

export interface PostCompliance {
  contentId: string;
  checks: ComplianceCheck[];
  /** True when every requirement was met. Null when none were defined. */
  compliant: boolean | null;
}

export function complianceOf(
  item: RawContent,
  rules: { requiredHashtags: string[]; requiredMentions: string[]; captionMustInclude: string[] },
): PostCompliance {
  const checks: ComplianceCheck[] = [
    ...rules.requiredHashtags.map((tag) => ({
      requirement: `#${normaliseTag(tag)}`,
      kind: "hashtag" as const,
      met: carriesTag(item, normaliseTag(tag)),
    })),
    ...rules.requiredMentions.map((mention) => ({
      requirement: `@${normaliseMention(mention)}`,
      kind: "mention" as const,
      met: carriesMention(item, normaliseMention(mention)),
    })),
    ...rules.captionMustInclude.map((phrase) => ({
      requirement: phrase,
      kind: "phrase" as const,
      met: carriesKeyword(item, phrase),
    })),
  ];

  return {
    contentId: item.id,
    checks,
    // No requirements is not compliance — it is an absence of requirements,
    // and a green tick against nothing is the kind of reassurance that gets
    // quoted back at you.
    compliant: checks.length === 0 ? null : checks.every((check) => check.met),
  };
}
