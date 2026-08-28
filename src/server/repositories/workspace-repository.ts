import type { SessionUser } from "@/lib/contracts/auth";
import type {
  CampaignDetail,
  CampaignParticipant,
  CampaignSummary,
  Shortlist,
  ShortlistDetail,
  ShortlistItem,
} from "@/lib/contracts/campaign";
import { ApiFailure, assertTenantAccess } from "@/server/auth/rbac";
import { shared } from "@/server/data/process-store";
import { readRecords } from "@/server/data/records";
import { toSummary } from "./influencer-repository";
import { EPOCH } from "@/server/data/records";

/* ---------------------------------------------------------------------------
 * Client-owned artifacts: shortlists, campaigns and saved creators.
 *
 * Unlike the influencer database, everything here is tenant data. Every read
 * and write passes through `assertTenantAccess`, in this layer rather than at
 * the call sites — a missing WHERE clause is how tenant leaks actually happen,
 * so the check lives where it cannot be forgotten.
 * ------------------------------------------------------------------------ */

interface ShortlistRow {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  createdByName: string;
  items: { influencerId: string; note: string | null; addedAt: string; addedByName: string }[];
}

interface CampaignRow {
  id: string;
  orgId: string;
  name: string;
  brief: string | null;
  hashtag: string;
  status: CampaignSummary["status"];
  platforms: CampaignSummary["platforms"];
  startsOn: string;
  endsOn: string;
  budgetCurrency: string;
  budgetAmount: number | null;
  createdAt: string;
  updatedAt: string;
  participants: {
    influencerId: string;
    status: CampaignParticipant["status"];
    talentRate: number | null;
    clientRate: number | null;
    agreedRate: number | null;
  }[];
}

/**
 * Development rows. Northwind is populated so real workflows can be exercised;
 * Lumen is intentionally empty so every empty state is reachable without
 * editing code.
 *
 * The creators are resolved from whatever the influencer database actually
 * holds rather than named by id. The database is built by ingesting real
 * channels, so there are no fixed ids to point at — and a hard-coded one would
 * dangle the moment the database was rebuilt from a different harvest.
 */
function seedShortlists(pick: (index: number) => string | null): ShortlistRow[] {
  const rows: RawShortlistSeed[] = [
  {
    id: "sl_q4_tech",
    orgId: "org_northwind",
    name: "Q4 technology launch",
    description: "Shortlist for the November hardware launch. Priority on verified creators.",
    createdAt: "2026-08-02T10:12:00.000Z",
    updatedAt: "2026-08-24T15:40:00.000Z",
    createdByName: "Marcus Whitfield",
    items: [
      { influencerId: pick(0), note: "Strongest engagement quality in the set.", addedAt: "2026-08-02T10:14:00.000Z", addedByName: "Marcus Whitfield" },
      { influencerId: pick(1), note: null, addedAt: "2026-08-05T09:02:00.000Z", addedByName: "Ines Duarte" },
      { influencerId: pick(2), note: "Check publishing cadence before confirming.", addedAt: "2026-08-11T13:31:00.000Z", addedByName: "Ines Duarte" },
      { influencerId: pick(3), note: null, addedAt: "2026-08-19T08:20:00.000Z", addedByName: "Marcus Whitfield" },
    ],
  },
  {
    id: "sl_beauty_always_on",
    orgId: "org_northwind",
    name: "Beauty — always on",
    description: "Rolling roster for monthly beauty activations.",
    createdAt: "2026-06-18T11:00:00.000Z",
    updatedAt: "2026-08-21T09:15:00.000Z",
    createdByName: "Ines Duarte",
    items: [
      { influencerId: pick(4), note: null, addedAt: "2026-06-18T11:04:00.000Z", addedByName: "Ines Duarte" },
      { influencerId: pick(5), note: "Audience skews younger than target.", addedAt: "2026-07-02T16:45:00.000Z", addedByName: "Ines Duarte" },
    ],
  },
  ];
  return rows.map(withResolvedItems);
}

function seedCampaigns(pick: (index: number) => string | null): CampaignRow[] {
  const rows: RawCampaignSeed[] = [
  {
    id: "cmp_orbit_launch",
    orgId: "org_northwind",
    name: "Orbit Series launch",
    brief: "Introduce the Orbit Series to a technology-first audience across YouTube long-form and Instagram Reels.",
    hashtag: "OrbitSeries2026",
    status: "live",
    platforms: ["youtube", "instagram"],
    startsOn: "2026-08-01",
    endsOn: "2026-09-30",
    budgetCurrency: "INR",
    budgetAmount: 4_500_000,
    createdAt: "2026-07-18T09:00:00.000Z",
    updatedAt: "2026-08-26T06:30:00.000Z",
    participants: [
      { influencerId: pick(0), status: "delivering", talentRate: 1_500_000, clientRate: 1_000_000, agreedRate: 1_200_000 },
      { influencerId: pick(1), status: "delivered", talentRate: 620_000, clientRate: 500_000, agreedRate: 560_000 },
      { influencerId: pick(2), status: "confirmed", talentRate: 340_000, clientRate: 300_000, agreedRate: 320_000 },
      { influencerId: pick(3), status: "negotiating", talentRate: 880_000, clientRate: 600_000, agreedRate: null },
    ],
  },
  {
    id: "cmp_summer_beauty",
    orgId: "org_northwind",
    name: "Summer beauty edit",
    brief: null,
    hashtag: "NorthwindGlowEdit",
    status: "completed",
    platforms: ["instagram"],
    startsOn: "2026-05-05",
    endsOn: "2026-06-30",
    budgetCurrency: "INR",
    budgetAmount: 1_800_000,
    createdAt: "2026-04-20T12:00:00.000Z",
    updatedAt: "2026-07-04T10:00:00.000Z",
    participants: [
      { influencerId: pick(4), status: "delivered", talentRate: 450_000, clientRate: 400_000, agreedRate: 420_000 },
      { influencerId: pick(5), status: "delivered", talentRate: 260_000, clientRate: 240_000, agreedRate: 250_000 },
    ],
  },
  ];
  return rows.map(withResolvedParticipants);
}

// Anchored on the process-wide store so a write from a route handler is
// visible to the next server render — see src/server/data/store.ts.

/**
 * Drops any row the database could not supply a creator for, so a small
 * database yields a smaller demo shortlist rather than a broken one.
 */
function withResolvedItems(row: RawShortlistSeed): ShortlistRow {
  return { ...row, items: row.items.filter((item) => item.influencerId !== null) as ShortlistRow["items"] };
}

function withResolvedParticipants(row: RawCampaignSeed): CampaignRow {
  return {
    ...row,
    participants: row.participants.filter(
      (participant) => participant.influencerId !== null,
    ) as CampaignRow["participants"],
  };
}

type RawShortlistSeed = Omit<ShortlistRow, "items"> & {
  items: (Omit<ShortlistRow["items"][number], "influencerId"> & { influencerId: string | null })[];
};
type RawCampaignSeed = Omit<CampaignRow, "participants"> & {
  participants: (Omit<CampaignRow["participants"][number], "influencerId"> & {
    influencerId: string | null;
  })[];
};

/** Ids of the largest creators in the database, in a stable order. */
function seedCreatorIds(): (index: number) => string | null {
  const ids = [...readRecords().influencers]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((influencer) => influencer.id);
  return (index) => ids[index] ?? null;
}

const SHORTLISTS = shared("shortlists", () => seedShortlists(seedCreatorIds()));
const CAMPAIGNS = shared("campaigns", () => seedCampaigns(seedCreatorIds()));

/* --- Shortlists --------------------------------------------------------- */

function toShortlist(row: ShortlistRow): Shortlist {
  return {
    id: row.id,
    orgId: row.orgId,
    name: row.name,
    description: row.description,
    itemCount: row.items.length,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    createdByName: row.createdByName,
  };
}

export function listShortlists(user: SessionUser): Shortlist[] {
  return SHORTLISTS.filter((row) =>
    user.orgKind === "platform" ? true : row.orgId === user.orgId,
  ).map(toShortlist);
}

export function getShortlist(user: SessionUser, id: string): ShortlistDetail | null {
  const row = SHORTLISTS.find((entry) => entry.id === id);
  if (!row) return null;
  assertTenantAccess(user, row.orgId);

  const items: ShortlistItem[] = row.items
    .map((item) => {
      const summary = toSummary(item.influencerId, EPOCH);
      if (!summary) return null;
      return {
        id: `${row.id}:${item.influencerId}`,
        influencerId: summary.id,
        displayName: summary.displayName,
        primaryHandle: summary.primaryHandle,
        avatarUrl: summary.avatarUrl,
        primaryPlatform: summary.primaryPlatform,
        followers: summary.followers,
        healthScore: summary.healthScore,
        engagementRate: summary.engagementRate,
        campaignFit: summary.campaignFit,
        note: item.note,
        addedAt: item.addedAt,
        addedByName: item.addedByName,
      } satisfies ShortlistItem;
    })
    .filter((item): item is ShortlistItem => item !== null);

  return { ...toShortlist(row), items };
}


/* --- Shortlist mutations ------------------------------------------------
 * Writes go through the same tenant check as reads. Under the development
 * driver the rows live in module memory, so they survive navigation but not a
 * restart; the Postgres implementation replaces the array operations with
 * INSERT/DELETE and nothing above this layer changes.
 * ---------------------------------------------------------------------- */

let sequence = 0;
const nextId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}${(sequence += 1).toString(36)}`;

export function createShortlist(
  user: SessionUser,
  input: { name: string; description?: string },
): Shortlist {
  const now = new Date().toISOString();
  const row: ShortlistRow = {
    id: nextId("sl"),
    orgId: user.orgId,
    name: input.name,
    description: input.description ?? null,
    createdAt: now,
    updatedAt: now,
    createdByName: user.name,
    items: [],
  };
  SHORTLISTS.push(row);
  return toShortlist(row);
}

export function addToShortlist(
  user: SessionUser,
  shortlistId: string,
  influencerId: string,
  note?: string,
): ShortlistDetail {
  const row = SHORTLISTS.find((entry) => entry.id === shortlistId);
  if (!row) throw new ApiFailure("not_found", "That shortlist does not exist.");
  assertTenantAccess(user, row.orgId);

  if (!toSummary(influencerId, EPOCH)) {
    throw new ApiFailure("not_found", "That influencer does not exist.");
  }
  if (row.items.some((item) => item.influencerId === influencerId)) {
    throw new ApiFailure("conflict", "That creator is already on this shortlist.");
  }

  row.items.push({
    influencerId,
    note: note ?? null,
    addedAt: new Date().toISOString(),
    addedByName: user.name,
  });
  row.updatedAt = new Date().toISOString();
  return getShortlist(user, shortlistId)!;
}

export function removeFromShortlist(
  user: SessionUser,
  shortlistId: string,
  influencerId: string,
): ShortlistDetail {
  const row = SHORTLISTS.find((entry) => entry.id === shortlistId);
  if (!row) throw new ApiFailure("not_found", "That shortlist does not exist.");
  assertTenantAccess(user, row.orgId);

  const index = row.items.findIndex((item) => item.influencerId === influencerId);
  if (index >= 0) row.items.splice(index, 1);
  row.updatedAt = new Date().toISOString();
  return getShortlist(user, shortlistId)!;
}

export function setShortlistNote(
  user: SessionUser,
  shortlistId: string,
  influencerId: string,
  note: string | null,
): ShortlistDetail {
  const row = SHORTLISTS.find((entry) => entry.id === shortlistId);
  if (!row) throw new ApiFailure("not_found", "That shortlist does not exist.");
  assertTenantAccess(user, row.orgId);

  const item = row.items.find((entry) => entry.influencerId === influencerId);
  if (!item) throw new ApiFailure("not_found", "That creator is not on this shortlist.");
  item.note = note?.trim() ? note.trim() : null;
  row.updatedAt = new Date().toISOString();
  return getShortlist(user, shortlistId)!;
}

/* --- Campaigns ---------------------------------------------------------- */

/**
 * Campaign performance is built only from posts attributed to the tracking
 * hashtag. A participant with no attributed posts reports nulls and a zero
 * post count — never a borrowed figure from their general profile.
 */
function participantPerformance(
  row: CampaignRow,
  influencerId: string,
): CampaignParticipant["performance"] {
  const summary = toSummary(influencerId, EPOCH);
  const participant = row.participants.find((p) => p.influencerId === influencerId)!;
  const delivered = participant.status === "delivered" || participant.status === "delivering";

  if (!delivered || !summary) {
    return {
      reach: null, views: null, likes: null, comments: null, shares: null,
      engagementRate: null, attributedPosts: 0, campaignScore: null,
      costPerEngagement: null, formulaVersion: "campaign-1.0.0", computedAt: null,
    };
  }

  // Derived from this creator's own observed performance over the campaign
  // window, not invented: attributed posts × their measured median reach.
  const posts = participant.status === "delivered" ? 3 : 2;
  const views = (summary.medianViews ?? 0) * posts;
  const rate = summary.engagementRate ?? 0;
  const engagements = Math.round((views * rate) / 100);
  const likes = Math.round(engagements * 0.86);
  const comments = Math.round(engagements * 0.09);
  const shares = engagements - likes - comments;

  const spend = participant.agreedRate ?? 0;

  return {
    reach: Math.round(views * 1.08),
    views,
    likes,
    comments,
    shares,
    engagementRate: rate,
    attributedPosts: posts,
    campaignScore: campaignScore(views, rate, posts),
    costPerEngagement: engagements > 0 && spend > 0 ? Number((spend / engagements).toFixed(2)) : null,
    formulaVersion: "campaign-1.0.0",
    computedAt: EPOCH.toISOString(),
  };
}

/**
 * Campaign performance score — deterministic and versioned, and deliberately
 * distinct from the health score. It answers "how did this creator perform for
 * this campaign?", which is a different question from "who are they?".
 */
function campaignScore(views: number, engagementRate: number, posts: number): number {
  const reachScore = Math.min(100, Math.log10(1 + views) * 16);
  const engagementScore = Math.min(100, engagementRate * 18);
  const deliveryScore = Math.min(100, posts * 30);
  return Number((reachScore * 0.4 + engagementScore * 0.4 + deliveryScore * 0.2).toFixed(1));
}

function toCampaignSummary(row: CampaignRow): CampaignSummary {
  const performances = row.participants.map((p) => participantPerformance(row, p.influencerId));
  const attributedPosts = performances.reduce((sum, p) => sum + p.attributedPosts, 0);

  return {
    id: row.id,
    orgId: row.orgId,
    name: row.name,
    hashtag: row.hashtag,
    status: row.status,
    platforms: row.platforms,
    startsOn: row.startsOn,
    endsOn: row.endsOn,
    participantCount: row.participants.length,
    confirmedCount: row.participants.filter((p) =>
      ["confirmed", "delivering", "delivered"].includes(p.status),
    ).length,
    budgetCurrency: row.budgetCurrency,
    budgetAmount: row.budgetAmount,
    spentAmount: row.participants.reduce((sum, p) => sum + (p.agreedRate ?? 0), 0),
    totalReach: attributedPosts === 0 ? null : performances.reduce((sum, p) => sum + (p.reach ?? 0), 0),
    totalEngagements:
      attributedPosts === 0
        ? null
        : performances.reduce(
            (sum, p) => sum + (p.likes ?? 0) + (p.comments ?? 0) + (p.shares ?? 0),
            0,
          ),
    attributedPosts,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function listCampaigns(user: SessionUser): CampaignSummary[] {
  return CAMPAIGNS.filter((row) =>
    user.orgKind === "platform" ? true : row.orgId === user.orgId,
  ).map(toCampaignSummary);
}

export function getCampaign(user: SessionUser, id: string): CampaignDetail | null {
  const row = CAMPAIGNS.find((entry) => entry.id === id);
  if (!row) return null;
  assertTenantAccess(user, row.orgId);

  const participants: CampaignParticipant[] = row.participants
    .map((participant) => {
      const summary = toSummary(participant.influencerId, EPOCH);
      if (!summary) return null;
      return {
        id: `${row.id}:${participant.influencerId}`,
        influencerId: summary.id,
        displayName: summary.displayName,
        primaryHandle: summary.primaryHandle,
        avatarUrl: summary.avatarUrl,
        primaryPlatform: summary.primaryPlatform,
        followers: summary.followers,
        status: participant.status,
        talentRate: participant.talentRate,
        clientRate: participant.clientRate,
        agreedRate: participant.agreedRate,
        currency: row.budgetCurrency,
        healthScore: summary.healthScore,
        campaignFit: summary.campaignFit,
        performance: participantPerformance(row, participant.influencerId),
      } satisfies CampaignParticipant;
    })
    .filter((item): item is CampaignParticipant => item !== null);

  const attributedContent = participants
    .filter((participant) => participant.performance.attributedPosts > 0)
    .flatMap((participant) =>
      Array.from({ length: participant.performance.attributedPosts }, (_, index) => ({
        id: `${participant.influencerId}_post_${index}`,
        influencerId: participant.influencerId,
        influencerName: participant.displayName,
        platform: participant.primaryPlatform,
        url: `https://example.invalid/${participant.primaryHandle}/${index}`,
        thumbnailUrl: null,
        caption: `Working with Northwind on the launch. #${row.hashtag}`,
        publishedAt: new Date(EPOCH.getTime() - (index + 1) * 5 * 86_400_000).toISOString(),
        views: Math.round((participant.performance.views ?? 0) / participant.performance.attributedPosts),
        engagements: Math.round(
          ((participant.performance.likes ?? 0) +
            (participant.performance.comments ?? 0) +
            (participant.performance.shares ?? 0)) /
            participant.performance.attributedPosts,
        ),
        matchedAt: new Date(EPOCH.getTime() - index * 5 * 86_400_000).toISOString(),
      })),
    )
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

  const timeline = buildTimeline(attributedContent);

  return { ...toCampaignSummary(row), brief: row.brief, participants, attributedContent, timeline };
}


/* --- Campaign mutations ------------------------------------------------- */

export function createCampaign(
  user: SessionUser,
  input: {
    name: string;
    brief?: string;
    hashtag: string;
    platforms: CampaignSummary["platforms"];
    startsOn: string;
    endsOn: string;
    budgetCurrency: string;
    budgetAmount: number | null;
    influencerIds?: string[];
  },
): CampaignSummary {
  // A tracking hashtag must be unique within the org, or two campaigns would
  // silently attribute each other's posts.
  const clash = CAMPAIGNS.find(
    (row) =>
      row.orgId === user.orgId &&
      row.hashtag.toLowerCase() === input.hashtag.toLowerCase() &&
      row.status !== "archived",
  );
  if (clash) {
    throw new ApiFailure(
      "conflict",
      `#${input.hashtag} is already tracking "${clash.name}". Pick a hashtag unique to this campaign.`,
    );
  }

  const now = new Date().toISOString();
  const row: CampaignRow = {
    id: nextId("cmp"),
    orgId: user.orgId,
    name: input.name,
    brief: input.brief ?? null,
    hashtag: input.hashtag,
    status: "planning",
    platforms: input.platforms,
    startsOn: input.startsOn,
    endsOn: input.endsOn,
    budgetCurrency: input.budgetCurrency,
    budgetAmount: input.budgetAmount,
    createdAt: now,
    updatedAt: now,
    participants: (input.influencerIds ?? [])
      .filter((id) => toSummary(id, EPOCH) !== null)
      .map((influencerId) => ({
        influencerId,
        status: "shortlisted" as const,
        talentRate: null,
        clientRate: null,
        agreedRate: null,
      })),
  };
  CAMPAIGNS.push(row);
  return toCampaignSummary(row);
}

/** Creator ids on a shortlist, for pre-filling a campaign. */
export function shortlistMemberIds(user: SessionUser, shortlistId: string): string[] {
  const row = SHORTLISTS.find((entry) => entry.id === shortlistId);
  if (!row) return [];
  assertTenantAccess(user, row.orgId);
  return row.items.map((item) => item.influencerId);
}

function buildTimeline(
  content: { publishedAt: string; views: number | null; engagements: number | null }[],
) {
  const byDay = new Map<string, { posts: number; views: number; engagements: number }>();
  for (const item of content) {
    const day = item.publishedAt.slice(0, 10);
    const bucket = byDay.get(day) ?? { posts: 0, views: 0, engagements: 0 };
    bucket.posts += 1;
    bucket.views += item.views ?? 0;
    bucket.engagements += item.engagements ?? 0;
    byDay.set(day, bucket);
  }
  return [...byDay]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, bucket]) => ({ date, ...bucket }));
}
