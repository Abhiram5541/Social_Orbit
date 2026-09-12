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

/* ---------------------------------------------------------------------------
 * X probe — the same self-test shape, over X's account fields.
 *
 * X reports every `public_metrics` field as a real number whenever the lookup
 * succeeds, so there is no hidden-count equivalent to `subscribersHidden`
 * here (see the comment on `x-connector.ts`'s `UserObject` schema).
 * ------------------------------------------------------------------------ */

export const ProbedAccount = z.object({
  userId: z.string(),
  username: z.string(),
  name: z.string(),
  description: z.string(),
  avatarUrl: z.string().nullable(),
  createdAt: z.string().nullable(),
  followers: z.number().int(),
  following: z.number().int(),
  postCount: z.number().int(),
  listedCount: z.number().int(),
  /** X's own paid/legacy badge — NOT SocialOrbit Verified (Arch §2). */
  xVerifiedBadge: z.boolean(),
  url: z.string(),
});
export type ProbedAccount = z.infer<typeof ProbedAccount>;

export const XProbeDerived = z.object({
  analyticsVersion: z.string(),
  medianEngagement: z.number().nullable(),
  engagementRate: z.number().nullable(),
  postsPerFollower: z.number().nullable(),
  postsPerWeek: z.number().nullable(),
  uploadConsistency: z.number().nullable(),
  daysSinceLastUpload: z.number().nullable(),
  activityStatus: z.enum(["active", "recently_active", "slowing", "dormant"]),
});
export type XProbeDerived = z.infer<typeof XProbeDerived>;

export const XConnectorProbeResult = z.object({
  account: ProbedAccount,
  provenance: Provenance,
  /** A call count, not a real quota unit — see the module comment in
   *  `x-connector.ts` on why X's metering model does not fit this field name. */
  quotaUnitsSpent: z.number().int(),
  sampleSize: z.number().int(),
  derived: XProbeDerived,
  recentContent: z.array(ContentItem),
});
export type XConnectorProbeResult = z.infer<typeof XConnectorProbeResult>;
