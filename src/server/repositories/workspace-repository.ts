import type { SessionUser } from "@/lib/contracts/auth";
import type { Platform } from "@/lib/contracts/common";
import type {
  CampaignDetail,
  CampaignParticipant,
  CampaignSummary,
  Shortlist,
  ShortlistDetail,
  ShortlistItem,
  CampaignDeliverable,
  DeliverableFulfilment,
  DeliverableInput,
} from "@/lib/contracts/campaign";
import {
  ATTRIBUTION_VERSION,
  CAMPAIGN_FORMULA_VERSION,
  attributedPostsFor,
  campaignScoreOf,
  totalsOf,
  type AttributionWindow,
} from "@/server/services/attribution-service";
import { ApiFailure, assertTenantAccess } from "@/server/auth/rbac";
import { appRows, persist } from "@/server/data/app-store";
import { readRecords } from "@/server/data/records";
import { toSummary } from "./influencer-repository";
import { currentBrandIds } from "./user-repository";
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
  brandId?: string | null;
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
  brandId?: string | null;
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
  deliverables?: CampaignDeliverable[];
  /** Operator corrections to automatic hashtag detection, by content id. */
  attribution?: { include: string[]; exclude: string[] };
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

/**
 * A demonstration campaign still has to demonstrate attribution, and
 * attribution only finds posts that exist. So the seed reads the chosen
 * participants' own catalogue and adopts a tag they genuinely used, over a
 * window that covers those posts: the campaign is a demonstration, but every
 * post it attributes is a real upload with a real URL and real figures.
 *
 * Falls back to the written tag and window when the database holds nothing —
 * a fresh clone then shows the honest "no posts matched yet" state.
 */
function realTagWindow(
  influencerIds: (string | null)[],
  platforms: Platform[],
  fallback: { hashtag: string; startsOn: string; endsOn: string },
): { hashtag: string; startsOn: string; endsOn: string } {
  const ids = new Set(influencerIds.filter((id): id is string => id !== null));
  if (ids.size === 0) return fallback;
  const onPlatform = new Set(platforms);

  const byTag = new Map<string, { influencerId: string; day: string }[]>();
  for (const item of readRecords().content) {
    if (!ids.has(item.influencerId) || !onPlatform.has(item.platform)) continue;
    for (const raw of item.hashtags) {
      const tag = raw.replace(/^#+/, "").toLowerCase();
      if (!/^[a-z0-9_]{3,60}$/.test(tag)) continue;
      const entry = byTag.get(tag) ?? [];
      entry.push({ influencerId: item.influencerId, day: item.publishedAt.slice(0, 10) });
      byTag.set(tag, entry);
    }
  }

  // A campaign runs for weeks, so a tag is judged on the posts inside one
  // eight-week window — the window ending at its newest post. Ranking on the
  // whole catalogue instead picked tags whose posts were years apart and left
  // the demonstration campaign with one attributed post.
  const WINDOW_DAYS = 56;
  let best: { tag: string; startsOn: string; endsOn: string; posts: number; creators: number } | null =
    null;
  for (const [tag, entries] of byTag) {
    const endsOn = entries.map((entry) => entry.day).sort().at(-1)!;
    const opened = new Date(`${endsOn}T00:00:00.000Z`);
    opened.setUTCDate(opened.getUTCDate() - WINDOW_DAYS);
    const startsOn = opened.toISOString().slice(0, 10);
    const inWindow = entries.filter((entry) => entry.day >= startsOn);
    const creators = new Set(inWindow.map((entry) => entry.influencerId)).size;
    // A tag one creator used twice is not a campaign.
    if (creators < 2 && inWindow.length < 4) continue;
    const candidate = { tag, startsOn, endsOn, posts: inWindow.length, creators };
    if (
      best === null ||
      candidate.creators > best.creators ||
      (candidate.creators === best.creators && candidate.posts > best.posts)
    ) {
      best = candidate;
    }
  }
  if (!best) return fallback;
  return { hashtag: best.tag, startsOn: best.startsOn, endsOn: best.endsOn };
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
    deliverables: [
      { id: "dl_orbit_video", label: "Long-form review", platform: "youtube", format: "video", quantity: 1, dueOn: "2026-09-15" },
      { id: "dl_orbit_reel", label: "Launch reel", platform: "instagram", format: "reel", quantity: 2, dueOn: "2026-09-25" },
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
    deliverables: [
      { id: "dl_glow_reel", label: "Edit reel", platform: "instagram", format: "reel", quantity: 1, dueOn: "2026-06-20" },
    ],
  },
  ];
  return rows.map(withResolvedParticipants).map((row) => ({
    ...row,
    ...realTagWindow(
      row.participants.map((participant) => participant.influencerId),
      row.platforms,
      { hashtag: row.hashtag, startsOn: row.startsOn, endsOn: row.endsOn },
    ),
  }));
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
  // Real creators first. Demonstration records sort ahead of everything else
  // on id (`demo_…`), so the seeded shortlists and campaigns were built
  // entirely from the four fictional ones — and a campaign then attributed
  // fictional posts. They stay as a fallback for a database holding nothing
  // else.
  const all = [...readRecords().influencers].sort((a, b) => a.id.localeCompare(b.id));
  const ids = [
    ...all.filter((influencer) => !influencer.isDemo),
    ...all.filter((influencer) => influencer.isDemo),
  ].map((influencer) => influencer.id);
  return (index) => ids[index] ?? null;
}

/** Read through a function: under Postgres the array is installed at boot, after this module loads. */
const shortlists = () => appRows<ShortlistRow>("shortlists", () => seedShortlists(seedCreatorIds()));
const campaigns = () => appRows<CampaignRow>("campaigns", () => seedCampaigns(seedCreatorIds()));
/**
 * Agency brand scoping (D45). A member limited to a set of clients sees only
 * those clients' work — including work filed under no client, which is the
 * agency's own. The restriction rides on the session, so every list applies
 * it without a second lookup.
 */
function brandVisible(user: SessionUser, brandId: string | null | undefined): boolean {
  const allowed = currentBrandIds(user);
  if (allowed.length === 0) return true;
  return brandId != null && allowed.includes(brandId);
}

export const seedWorkspace = {
  shortlists: () => seedShortlists(seedCreatorIds()),
  campaigns: () => seedCampaigns(seedCreatorIds()),
};

/* --- Shortlists --------------------------------------------------------- */

function toShortlist(row: ShortlistRow): Shortlist {
  return {
    id: row.id,
    orgId: row.orgId,
    brandId: row.brandId ?? null,
    name: row.name,
    description: row.description,
    itemCount: row.items.length,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    createdByName: row.createdByName,
  };
}

export function listShortlists(user: SessionUser): Shortlist[] {
  return shortlists()
    .filter((row) => (user.orgKind === "platform" ? true : row.orgId === user.orgId))
    .filter((row) => brandVisible(user, row.brandId))
    .map(toShortlist);
}

/** The creators on a shortlist, for a roll-up that only needs the ids. */
export function shortlistCreatorIds(user: SessionUser, shortlistId: string): string[] {
  const row = shortlists().find((entry) => entry.id === shortlistId);
  if (!row) return [];
  assertTenantAccess(user, row.orgId);
  return row.items.map((item) => item.influencerId);
}

export function getShortlist(user: SessionUser, id: string): ShortlistDetail | null {
  const row = shortlists().find((entry) => entry.id === id);
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
  shortlists().push(row);
  persist("shortlists", [row]);
  return toShortlist(row);
}

export function addToShortlist(
  user: SessionUser,
  shortlistId: string,
  influencerId: string,
  note?: string,
): ShortlistDetail {
  const row = shortlists().find((entry) => entry.id === shortlistId);
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
  persist("shortlists", [row]);
  return getShortlist(user, shortlistId)!;
}

export function removeFromShortlist(
  user: SessionUser,
  shortlistId: string,
  influencerId: string,
): ShortlistDetail {
  const row = shortlists().find((entry) => entry.id === shortlistId);
  if (!row) throw new ApiFailure("not_found", "That shortlist does not exist.");
  assertTenantAccess(user, row.orgId);

  const index = row.items.findIndex((item) => item.influencerId === influencerId);
  if (index >= 0) row.items.splice(index, 1);
  row.updatedAt = new Date().toISOString();
  persist("shortlists", [row]);
  return getShortlist(user, shortlistId)!;
}

export function setShortlistNote(
  user: SessionUser,
  shortlistId: string,
  influencerId: string,
  note: string | null,
): ShortlistDetail {
  const row = shortlists().find((entry) => entry.id === shortlistId);
  if (!row) throw new ApiFailure("not_found", "That shortlist does not exist.");
  assertTenantAccess(user, row.orgId);

  const item = row.items.find((entry) => entry.influencerId === influencerId);
  if (!item) throw new ApiFailure("not_found", "That creator is not on this shortlist.");
  item.note = note?.trim() ? note.trim() : null;
  row.updatedAt = new Date().toISOString();
  persist("shortlists", [row]);
  return getShortlist(user, shortlistId)!;
}

/* --- Campaigns ---------------------------------------------------------- */

/** The attribution window a campaign row describes. */
function windowOf(row: CampaignRow): AttributionWindow {
  return {
    hashtag: row.hashtag,
    platforms: row.platforms,
    startsOn: row.startsOn,
    endsOn: row.endsOn,
    overrides: row.attribution,
  };
}

/** Posts every participant owes: the sum of the campaign's deliverables. */
function requiredPostsOf(row: CampaignRow): number {
  return (row.deliverables ?? []).reduce((sum, deliverable) => sum + deliverable.quantity, 0);
}

/** The earliest deliverable deadline, which is when a creator is first late. */
function earliestDueOn(row: CampaignRow): string | null {
  const dates = (row.deliverables ?? [])
    .map((deliverable) => deliverable.dueOn)
    .filter((date): date is string => date !== null)
    .sort();
  return dates[0] ?? null;
}

/**
 * Campaign performance, built only from posts this platform actually indexed
 * and matched to the tracking hashtag. A participant with no attributed posts
 * reports nulls and a zero post count — never a borrowed figure from their
 * general profile, and never a modelled one.
 */
function participantPerformance(
  row: CampaignRow,
  influencerId: string,
  now: Date = new Date(),
): CampaignParticipant["performance"] {
  const posts = attributedPostsFor(influencerId, windowOf(row));
  const totals = totalsOf(posts);
  const participant = row.participants.find((entry) => entry.influencerId === influencerId);
  const spend = participant?.agreedRate ?? 0;
  const matched = new Set(posts.map((post) => post.id));

  return {
    // Reach is not a figure any of these APIs publishes; views are what was
    // observed, so reach stays null rather than restating views under a name
    // that promises unique people.
    reach: null,
    views: totals.views,
    likes: totals.likes,
    comments: totals.comments,
    shares: totals.shares,
    engagementRate: totals.engagementRate,
    attributedPosts: totals.posts,
    campaignScore: campaignScoreOf(totals, requiredPostsOf(row)),
    costPerEngagement:
      totals.engagements && totals.engagements > 0 && spend > 0
        ? Number((spend / totals.engagements).toFixed(2))
        : null,
    formulaVersion: CAMPAIGN_FORMULA_VERSION,
    computedAt: totals.posts === 0 ? null : now.toISOString(),
    attributionVersion: ATTRIBUTION_VERSION,
    manualIncludes: (row.attribution?.include ?? []).filter((id) => matched.has(id)).length,
    manualExcludes: (row.attribution?.exclude ?? []).length,
  };
}

/** Progress against the campaign's deliverables, counted from real posts. */
function fulfilmentOf(
  row: CampaignRow,
  published: number,
  now: Date = new Date(),
): DeliverableFulfilment {
  const required = requiredPostsOf(row);
  const dueOn = earliestDueOn(row);
  if (required === 0) {
    return { required: 0, published, percent: null, state: "none_required", dueOn };
  }
  const percent = Number(Math.min(100, (published / required) * 100).toFixed(1));
  const overdue = dueOn !== null && now.toISOString().slice(0, 10) > dueOn;
  const state: DeliverableFulfilment["state"] =
    published >= required
      ? "fulfilled"
      : overdue
        ? "missed"
        : published === 0
          ? "not_started"
          : "in_progress";
  return { required, published, percent, state, dueOn };
}

function toCampaignSummary(row: CampaignRow): CampaignSummary {
  const performances = row.participants.map((p) => participantPerformance(row, p.influencerId));
  const attributedPosts = performances.reduce((sum, p) => sum + p.attributedPosts, 0);

  return {
    id: row.id,
    orgId: row.orgId,
    brandId: row.brandId ?? null,
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
    // Views, not "reach": these APIs publish views, and a campaign total is
    // the sum of what was observed or nothing at all.
    totalReach:
      performances.every((p) => p.views === null)
        ? null
        : performances.reduce((sum, p) => sum + (p.views ?? 0), 0),
    totalEngagements:
      attributedPosts === 0
        ? null
        : performances.reduce(
            (sum, p) => sum + (p.likes ?? 0) + (p.comments ?? 0) + (p.shares ?? 0),
            0,
          ),
    attributedPosts,
    fulfilmentPercent:
      requiredPostsOf(row) === 0 || row.participants.length === 0
        ? null
        : Number(
            Math.min(
              100,
              (attributedPosts / (requiredPostsOf(row) * row.participants.length)) * 100,
            ).toFixed(1),
          ),
    deliverableCount: (row.deliverables ?? []).length,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function listCampaigns(user: SessionUser): CampaignSummary[] {
  return campaigns()
    .filter((row) => (user.orgKind === "platform" ? true : row.orgId === user.orgId))
    .filter((row) => brandVisible(user, row.brandId))
    .map(toCampaignSummary);
}

/** Files a shortlist or campaign under one of the agency's clients. */
export function setBrand(
  user: SessionUser,
  kind: "shortlist" | "campaign",
  id: string,
  brandId: string | null,
): void {
  const row =
    kind === "shortlist"
      ? shortlists().find((entry) => entry.id === id)
      : campaigns().find((entry) => entry.id === id);
  if (!row) throw new ApiFailure("not_found", "Not found.");
  assertTenantAccess(user, row.orgId);
  if (!brandVisible(user, row.brandId)) throw new ApiFailure("forbidden", "Not yours to move.");
  row.brandId = brandId;
  row.updatedAt = new Date().toISOString();
  persist(kind === "shortlist" ? "shortlists" : "campaigns", [row]);
}

export function getCampaign(user: SessionUser, id: string): CampaignDetail | null {
  const row = campaigns().find((entry) => entry.id === id);
  if (!row) return null;
  assertTenantAccess(user, row.orgId);

  const participants: CampaignParticipant[] = row.participants
    .map((participant) => {
      const summary = toSummary(participant.influencerId, EPOCH);
      if (!summary) return null;
      const performance = participantPerformance(row, participant.influencerId);
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
        performance,
        fulfilment: fulfilmentOf(row, performance.attributedPosts),
      } satisfies CampaignParticipant;
    })
    .filter((item): item is CampaignParticipant => item !== null);

  // The real posts, with their real URLs, captions and figures. The previous
  // version synthesised one object per attributed post with an
  // `example.invalid` URL and an invented caption — a fabricated observation
  // on the one screen a client uses to check what they paid for.
  const included = new Set(row.attribution?.include ?? []);
  const attributedContent = participants
    .flatMap((participant) =>
      attributedPostsFor(participant.influencerId, windowOf(row)).map((post) => ({
        id: post.id,
        influencerId: participant.influencerId,
        influencerName: participant.displayName,
        platform: post.platform,
        url: post.url,
        thumbnailUrl: post.thumbnailUrl,
        caption: post.caption || post.title,
        publishedAt: post.publishedAt,
        views: post.views,
        engagements:
          post.likes === null && post.comments === null && post.shares === null
            ? null
            : (post.likes ?? 0) + (post.comments ?? 0) + (post.shares ?? 0),
        // The tracker reads the indexed catalogue, so a post is known from the
        // moment it was collected — that time, not a minted one.
        matchedAt: post.publishedAt,
        matchedBy: included.has(post.id) ? ("manual" as const) : ("hashtag" as const),
      })),
    )
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

  const timeline = buildTimeline(attributedContent);

  return {
    ...toCampaignSummary(row),
    brief: row.brief,
    deliverables: row.deliverables ?? [],
    participants,
    attributedContent,
    timeline,
  };
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
  const clash = campaigns().find(
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
  campaigns().push(row);
  persist("campaigns", [row]);
  return toCampaignSummary(row);
}

/** Creator ids on a shortlist, for pre-filling a campaign. */
/**
 * Replaces a campaign's deliverables. Requirements are campaign-wide — every
 * participant owes the same set — because per-creator requirements without a
 * per-creator contract is a promise the platform cannot keep track of yet.
 */
/**
 * Adds creators to a campaign that already exists — the path from a search
 * result or a shortlist straight into the brief, without a detour through a
 * shortlist first. Already-present creators are skipped rather than
 * duplicated, so the same click twice is not two participants.
 */
export function addParticipants(
  user: SessionUser,
  campaignId: string,
  influencerIds: string[],
): { added: number; skipped: number } {
  const row = campaigns().find((entry) => entry.id === campaignId);
  if (!row) throw new ApiFailure("not_found", "That campaign does not exist.");
  assertTenantAccess(user, row.orgId);

  const present = new Set(row.participants.map((participant) => participant.influencerId));
  let added = 0;
  for (const influencerId of influencerIds) {
    if (present.has(influencerId)) continue;
    // A creator the index does not hold cannot be a participant: the campaign
    // would carry a row nothing can ever be attributed to.
    if (!toSummary(influencerId, EPOCH)) continue;
    row.participants.push({
      influencerId,
      status: "shortlisted",
      talentRate: null,
      clientRate: null,
      agreedRate: null,
    });
    present.add(influencerId);
    added += 1;
  }
  if (added > 0) {
    row.updatedAt = new Date().toISOString();
    persist("campaigns", [row]);
  }
  return { added, skipped: influencerIds.length - added };
}

export function setCampaignDeliverables(
  user: SessionUser,
  campaignId: string,
  input: DeliverableInput[],
): CampaignDetail {
  const row = campaigns().find((entry) => entry.id === campaignId);
  if (!row) throw new ApiFailure("not_found", "Campaign not found.");
  assertTenantAccess(user, row.orgId);

  row.deliverables = input.map((deliverable, index) => ({
    id: `dl_${row.id}_${index}_${Date.now().toString(36)}`,
    label: deliverable.label,
    platform: deliverable.platform,
    format: deliverable.format,
    quantity: deliverable.quantity,
    dueOn: deliverable.dueOn,
  }));
  row.updatedAt = new Date().toISOString();
  persist("campaigns", [row]);
  return getCampaign(user, campaignId)!;
}

/**
 * An operator's correction to automatic detection: a post the tracker missed,
 * or one it matched that does not belong to this campaign. Recorded as an
 * override rather than by editing the post, so the detection rule and the
 * correction stay separately visible.
 */
export function setAttributionOverride(
  user: SessionUser,
  campaignId: string,
  contentId: string,
  action: "include" | "exclude" | "clear",
): CampaignDetail {
  const row = campaigns().find((entry) => entry.id === campaignId);
  if (!row) throw new ApiFailure("not_found", "Campaign not found.");
  assertTenantAccess(user, row.orgId);

  const current = row.attribution ?? { include: [], exclude: [] };
  const without = {
    include: current.include.filter((id) => id !== contentId),
    exclude: current.exclude.filter((id) => id !== contentId),
  };
  row.attribution =
    action === "include"
      ? { ...without, include: [...without.include, contentId] }
      : action === "exclude"
        ? { ...without, exclude: [...without.exclude, contentId] }
        : without;
  row.updatedAt = new Date().toISOString();
  persist("campaigns", [row]);
  return getCampaign(user, campaignId)!;
}

/**
 * Every campaign a creator participates in, across every organisation.
 *
 * Deliberately not tenant-scoped: this is the creator's own record, read by
 * the creator. A client sees their campaign; the creator sees the campaigns
 * they are on. The caller must already have proven it is that creator —
 * `requireOwnProfile` does — and only the fields a creator is entitled to
 * are returned, so one client's roster is never visible to another's.
 */
export function campaignsForCreator(influencerId: string): {
  campaignId: string;
  campaignName: string;
  orgId: string;
  hashtag: string;
  brief: string | null;
  status: CampaignSummary["status"];
  startsOn: string;
  endsOn: string;
  deliverables: CampaignDeliverable[];
  me: CampaignParticipant;
}[] {
  const out: ReturnType<typeof campaignsForCreator> = [];
  for (const row of campaigns()) {
    if (!row.participants.some((entry) => entry.influencerId === influencerId)) continue;
    const performance = participantPerformance(row, influencerId);
    const summary = toSummary(influencerId, EPOCH);
    const participant = row.participants.find((entry) => entry.influencerId === influencerId)!;
    if (!summary) continue;
    out.push({
      campaignId: row.id,
      campaignName: row.name,
      orgId: row.orgId,
      hashtag: row.hashtag,
      brief: row.brief,
      status: row.status,
      startsOn: row.startsOn,
      endsOn: row.endsOn,
      deliverables: row.deliverables ?? [],
      me: {
        id: `${row.id}:${influencerId}`,
        influencerId,
        displayName: summary.displayName,
        primaryHandle: summary.primaryHandle,
        avatarUrl: summary.avatarUrl,
        primaryPlatform: summary.primaryPlatform,
        followers: summary.followers,
        status: participant.status,
        talentRate: participant.talentRate,
        // A creator sees what was agreed with them, never what the client
        // internally budgeted for them.
        clientRate: null,
        agreedRate: participant.agreedRate,
        currency: row.budgetCurrency,
        healthScore: summary.healthScore,
        campaignFit: summary.campaignFit,
        performance,
        fulfilment: fulfilmentOf(row, performance.attributedPosts),
      },
    });
  }
  return out.sort((a, b) => b.startsOn.localeCompare(a.startsOn));
}

export function shortlistMemberIds(user: SessionUser, shortlistId: string): string[] {
  const row = shortlists().find((entry) => entry.id === shortlistId);
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
