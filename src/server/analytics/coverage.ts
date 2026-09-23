import type { Platform } from "@/lib/contracts/common";
import { readRecords } from "@/server/data/records";

/* ---------------------------------------------------------------------------
 * What each platform actually gives us, measured rather than asserted.
 *
 * Instagram is read through Business Discovery (D35), which publishes
 * followers, media count, bio and recent media with likes and comments — and
 * no view count, no country, no language and no history beyond what SENSO has
 * accumulated itself. YouTube's Data API publishes all of those.
 *
 * That difference decides what a client can filter on and what a report can
 * say, so it is computed from the rows rather than written in a document
 * somebody has to remember to update. A field at 0% is a platform limit; the
 * page says which limits need the creator's own authorisation to lift.
 * ------------------------------------------------------------------------ */

export interface FieldCoverage {
  field: string;
  label: string;
  present: number;
  share: number;
}

export interface PlatformCoverage {
  platform: Platform;
  creators: number;
  posts: number;
  /** Creators with at least two snapshots — the minimum for any trend. */
  withHistory: number;
  fields: FieldCoverage[];
}

export function coverageByPlatform(): PlatformCoverage[] {
  const data = readRecords();

  const accountsByInfluencer = new Map<string, (typeof data.accounts)[number][]>();
  for (const account of data.accounts) {
    const list =
      accountsByInfluencer.get(account.influencerId) ??
      accountsByInfluencer.set(account.influencerId, []).get(account.influencerId)!;
    list.push(account);
  }

  const snapshotsByAccount = new Map<string, number>();
  for (const snapshot of data.snapshots) {
    snapshotsByAccount.set(snapshot.accountId, (snapshotsByAccount.get(snapshot.accountId) ?? 0) + 1);
  }

  const postsByPlatform = new Map<Platform, { total: number; withViews: number; withEngagement: number }>();
  for (const item of data.content) {
    const bucket =
      postsByPlatform.get(item.platform) ??
      postsByPlatform
        .set(item.platform, { total: 0, withViews: 0, withEngagement: 0 })
        .get(item.platform)!;
    bucket.total += 1;
    if (item.views !== null) bucket.withViews += 1;
    if (item.likes !== null || item.comments !== null) bucket.withEngagement += 1;
  }

  const platforms = [...new Set(data.influencers.map((row) => row.primaryPlatform))];

  return platforms.map((platform) => {
    const creators = data.influencers.filter((row) => row.primaryPlatform === platform);
    const posts = postsByPlatform.get(platform) ?? { total: 0, withViews: 0, withEngagement: 0 };

    const share = (count: number, of: number): number =>
      of === 0 ? 0 : Number(((count / of) * 100).toFixed(1));

    const withHistory = creators.filter((row) =>
      (accountsByInfluencer.get(row.id) ?? []).some(
        (account) => (snapshotsByAccount.get(account.id) ?? 0) >= 2,
      ),
    ).length;

    return {
      platform,
      creators: creators.length,
      posts: posts.total,
      withHistory,
      fields: [
        {
          field: "followers",
          label: "Follower count",
          present: creators.filter((row) =>
            (accountsByInfluencer.get(row.id) ?? []).some((account) => account.followers !== null),
          ).length,
          share: 0,
        },
        {
          field: "country",
          label: "Country",
          present: creators.filter((row) => row.countryCode).length,
          share: 0,
        },
        {
          field: "language",
          label: "Language",
          present: creators.filter((row) => row.languages.length > 0).length,
          share: 0,
        },
        {
          field: "bio",
          label: "Bio text",
          present: creators.filter((row) => row.bio.trim().length > 0).length,
          share: 0,
        },
        {
          field: "history",
          label: "Two or more snapshots",
          present: withHistory,
          share: 0,
        },
      ]
        .map((field) => ({ ...field, share: share(field.present, creators.length) }))
        .concat([
          {
            field: "post_views",
            label: "Views, per post",
            present: posts.withViews,
            share: share(posts.withViews, posts.total),
          },
          {
            field: "post_engagement",
            label: "Likes or comments, per post",
            present: posts.withEngagement,
            share: share(posts.withEngagement, posts.total),
          },
        ]),
    };
  });
}

/** Fields no public API publishes for anyone, whatever the platform. */
export const AUTHORISED_ONLY = [
  "Audience age, gender and location",
  "Impressions, reach and saves",
  "Story and close-friends performance",
  "Traffic sources and watch time",
];
