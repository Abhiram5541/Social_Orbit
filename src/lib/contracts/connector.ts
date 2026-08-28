import { z } from "zod";
import { Provenance } from "./common";
import { ContentItem } from "./influencer";

/* ---------------------------------------------------------------------------
 * Connector probe — the live self-test an operator runs against a platform
 * adapter.
 *
 * This shape crosses a network boundary and is read by a client component, so
 * it lives here rather than in `src/server` (CLAUDE.md D8): importing the
 * service type into the browser bundle would drag the connector, and with it
 * the API key handling, along with it.
 * ------------------------------------------------------------------------ */

export const ProbedChannel = z.object({
  channelId: z.string(),
  title: z.string(),
  handle: z.string().nullable(),
  description: z.string(),
  country: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  publishedAt: z.string(),
  subscribers: z.number().int().nullable(),
  /** The creator hides the count. Distinct from "we failed to read it". */
  subscribersHidden: z.boolean(),
  totalViews: z.number().int().nullable(),
  videoCount: z.number().int().nullable(),
  uploadsPlaylistId: z.string().nullable(),
  url: z.string(),
});
export type ProbedChannel = z.infer<typeof ProbedChannel>;

/**
 * Everything here is computed by `src/server/analytics` from the observations
 * above — the connector derives nothing. Each value is null until the engine
 * has enough observations to report it, which is why the UI must render null
 * as "not enough data" rather than as zero.
 */
export const ProbeDerived = z.object({
  analyticsVersion: z.string(),
  medianViews: z.number().nullable(),
  engagementRate: z.number().nullable(),
  viewsPerFollower: z.number().nullable(),
  uploadsPerWeek: z.number().nullable(),
  uploadConsistency: z.number().nullable(),
  viewConsistency: z.number().nullable(),
  daysSinceLastUpload: z.number().nullable(),
  activityStatus: z.enum(["active", "recently_active", "slowing", "dormant"]),
});
export type ProbeDerived = z.infer<typeof ProbeDerived>;

export const ConnectorProbeResult = z.object({
  channel: ProbedChannel,
  provenance: Provenance,
  /** Daily API quota units this probe consumed. Probing is not free. */
  quotaUnitsSpent: z.number().int(),
  sampleSize: z.number().int(),
  derived: ProbeDerived,
  recentContent: z.array(ContentItem),
});
export type ConnectorProbeResult = z.infer<typeof ConnectorProbeResult>;
