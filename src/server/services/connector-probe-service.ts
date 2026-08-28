import type { ConnectorProbeResult } from "@/lib/contracts/connector";
import {
  ANALYTICS_VERSION,
  activityStatus,
  daysSinceLastPublication,
  engagementRate,
  median,
  uploadConsistency,
  uploadFrequency,
  viewConsistency,
  viewsPerFollowerRatio,
} from "@/server/analytics/metrics";
import { observeChannel, type YouTubeVideo } from "@/server/connectors/youtube";
import type { ContentItem } from "@/lib/contracts/influencer";

/**
 * Reads one real channel through the YouTube connector and runs the
 * deterministic analytics engine over what came back.
 *
 * This is the connector's live self-test: it proves the credential works, that
 * the upstream response still parses, and that observed platform figures reach
 * the analytics layer unchanged. It derives nothing itself — every computed
 * number below comes from `src/server/analytics`, which is the only place
 * allowed to derive anything (DPR §10).
 */
export async function probeYouTubeChannel(
  input: string,
  videoLimit = 25,
): Promise<ConnectorProbeResult | null> {
  const observation = await observeChannel(input, videoLimit);
  if (!observation) return null;

  const { channel, recentContent } = observation;
  const content = recentContent.map(toContentItem);
  const views = content
    .map((item) => item.views)
    .filter((value): value is number => value !== null);

  return {
    channel,
    provenance: observation.provenance,
    quotaUnitsSpent: observation.quotaUnitsSpent,
    sampleSize: recentContent.length,
    derived: {
      analyticsVersion: ANALYTICS_VERSION,
      medianViews: median(views),
      // YouTube engagement is measured against views, not followers — DPR §19.
      engagementRate: engagementRate(content, {
        kind: "views",
        followers: channel.subscribers,
      }),
      viewsPerFollower: viewsPerFollowerRatio(median(views), channel.subscribers),
      uploadsPerWeek: uploadFrequency(content),
      uploadConsistency: uploadConsistency(content),
      viewConsistency: viewConsistency(content),
      daysSinceLastUpload: daysSinceLastPublication(content),
      activityStatus: activityStatus(content),
    },
    recentContent: content,
  };
}

/**
 * A platform observation rendered in the shape the UI speaks. The derived
 * fields stay null: the connector measured none of them, and the probe shows
 * per-item statistics rather than per-item analytics.
 */
function toContentItem(video: YouTubeVideo): ContentItem {
  return {
    id: video.videoId,
    platform: "youtube",
    title: video.title,
    url: video.url,
    thumbnailUrl: video.thumbnailUrl,
    publishedAt: video.publishedAt,
    views: video.views,
    likes: video.likes,
    comments: video.comments,
    // The public API exposes no share count. Absent, not zero.
    shares: null,
    durationSeconds: video.durationSeconds,
    engagementRate: null,
    performanceIndex: null,
    isAnomalous: false,
    isSponsored: null,
  };
}
