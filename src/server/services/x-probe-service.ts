import type { XConnectorProbeResult } from "@/lib/contracts/connector";
import {
  ANALYTICS_VERSION,
  activityStatus,
  daysSinceLastPublication,
  engagementRate,
  median,
  uploadConsistency,
  uploadFrequency,
} from "@/server/analytics/metrics";
import { observeAccount, type XPost } from "@/server/connectors/x";
import type { ContentItem } from "@/lib/contracts/influencer";

/**
 * Reads one real X account through the connector and runs the deterministic
 * analytics engine over what came back — the same self-test shape as
 * `probeYouTubeChannel`, over X's fields.
 *
 * X reports no view count on a post at this access tier (`impressions` is
 * elevated-access only and absent here), so unlike YouTube's view-based
 * engagement rate, this reports engagement against followers — the only
 * denominator X's public data can actually support.
 */
export async function probeXAccount(
  input: string,
  postLimit = 25,
): Promise<XConnectorProbeResult | null> {
  const observation = await observeAccount(input, postLimit);
  if (!observation) return null;

  const { account, recentContent } = observation;
  const content = recentContent.map(toContentItem);
  const engagementTotals = content.map(
    (item) => (item.likes ?? 0) + (item.comments ?? 0) + (item.shares ?? 0),
  );

  return {
    account,
    provenance: observation.provenance,
    quotaUnitsSpent: observation.quotaUnitsSpent,
    sampleSize: recentContent.length,
    derived: {
      analyticsVersion: ANALYTICS_VERSION,
      medianEngagement: median(engagementTotals),
      engagementRate: engagementRate(content, { kind: "followers", followers: account.followers }),
      postsPerFollower:
        account.followers > 0 ? (median(engagementTotals) ?? 0) / account.followers : null,
      postsPerWeek: uploadFrequency(content),
      uploadConsistency: uploadConsistency(content),
      daysSinceLastUpload: daysSinceLastPublication(content),
      activityStatus: activityStatus(content),
    },
    recentContent: content,
  };
}

/**
 * A platform observation rendered in the shape the UI speaks. Derived fields
 * stay null: the connector measured none of them.
 */
function toContentItem(post: XPost): ContentItem {
  return {
    id: post.postId,
    platform: "x",
    title: post.text.slice(0, 120),
    url: post.url,
    thumbnailUrl: null,
    publishedAt: post.publishedAt ?? new Date(0).toISOString(),
    views: post.impressions,
    likes: post.likes,
    comments: post.replies + post.quotes,
    shares: post.retweets,
    durationSeconds: null,
    engagementRate: null,
    performanceIndex: null,
    isAnomalous: false,
    isSponsored: null,
  };
}
