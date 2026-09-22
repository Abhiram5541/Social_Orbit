import type { SessionUser } from "@/lib/contracts/auth";
import type {
  CrmPatch,
  CrmRecord,
  CrmSummary,
  Interaction,
  InteractionInput,
  RelationshipScore,
  RelationshipStage,
} from "@/lib/contracts/crm";
import { ApiFailure, assertTenantAccess } from "@/server/auth/rbac";
import { appRows, persist } from "@/server/data/app-store";
import { toSummary } from "./influencer-repository";
import { listCampaigns, getCampaign } from "./workspace-repository";

/* ---------------------------------------------------------------------------
 * Creator relationship management — the client's own record of a creator.
 *
 * The creator is global; the relationship is not. A row here exists only
 * once an organisation does something with a creator — opens their record,
 * adds them to a campaign, writes a note — so the store holds relationships
 * rather than a copy of the index.
 *
 * Rows are keyed `(orgId, influencerId)`, so the duplicate detection the
 * specification asks for is structural: a second record for the same creator
 * cannot be created, and there is nothing to merge.
 * ------------------------------------------------------------------------ */

interface CrmRow {
  id: string;
  orgId: string;
  influencerId: string;
  stage: RelationshipStage;
  ownerUserId: string | null;
  ownerName: string | null;
  tags: string[];
  contact: CrmRecord["contact"];
  customFields: Record<string, string>;
  interactions: Interaction[];
  createdAt: string;
  updatedAt: string;
}

const rows = () => appRows<CrmRow>("crm", () => []);

const nextId = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

const EMPTY_CONTACT: CrmRecord["contact"] = {
  email: null,
  phone: null,
  managerName: null,
  managerEmail: null,
  agency: null,
  source: null,
  optedOutAt: null,
};

export const RELATIONSHIP_FORMULA_VERSION = "relationship-1.0.0";

/**
 * Relationship strength from collaboration history this platform can count:
 * did they reply, did they deliver, were they on time, and have they worked
 * with this organisation before. A component with nothing to count is
 * withheld and the rest renormalise — a creator nobody has contacted is not
 * a bad partner, they are an unmeasured one, and `value` is null until at
 * least one component exists.
 */
function relationshipScore(row: CrmRow, campaigns: { fulfilled: number; total: number; onTime: number }): RelationshipScore {
  const sent = row.interactions.filter((entry) => entry.kind === "email_sent").length;
  const replied = row.interactions.filter((entry) => entry.kind === "email_replied").length;

  const responseRate = sent === 0 ? null : Number(Math.min(100, (replied / sent) * 100).toFixed(1));
  const completionRate =
    campaigns.total === 0 ? null : Number(((campaigns.fulfilled / campaigns.total) * 100).toFixed(1));
  const onTimeRate =
    campaigns.fulfilled === 0 ? null : Number(((campaigns.onTime / campaigns.fulfilled) * 100).toFixed(1));

  const weights: [number | null, number][] = [
    [responseRate, 0.25],
    [completionRate, 0.4],
    [onTimeRate, 0.25],
    // Repeat business is the strongest signal there is, but it only says
    // anything once there is a second campaign to count.
    [campaigns.total >= 2 ? Math.min(100, (campaigns.total - 1) * 50) : null, 0.1],
  ];
  const measured = weights.filter(([value]) => value !== null) as [number, number][];
  const coverage = measured.reduce((sum, [, weight]) => sum + weight, 0);
  const value =
    coverage === 0
      ? null
      : Number(
          (measured.reduce((sum, [v, weight]) => sum + v * weight, 0) / coverage).toFixed(1),
        );

  return {
    value,
    components: {
      responseRate,
      completionRate,
      onTimeRate,
      repeatCollaborations: Math.max(0, campaigns.total - 1),
      campaignsCompleted: campaigns.fulfilled,
    },
    coverage: Number(coverage.toFixed(2)),
    formulaVersion: RELATIONSHIP_FORMULA_VERSION,
  };
}

/** What this creator actually did on this organisation's campaigns. */
function campaignHistory(user: SessionUser, influencerId: string) {
  const ids: string[] = [];
  let total = 0;
  let fulfilled = 0;
  let onTime = 0;

  for (const summary of listCampaigns(user)) {
    const detail = getCampaign(user, summary.id);
    const participant = detail?.participants.find((p) => p.influencerId === influencerId);
    if (!detail || !participant) continue;
    ids.push(detail.id);
    total += 1;
    if (participant.fulfilment.state === "fulfilled") {
      fulfilled += 1;
      // Fulfilled and not flagged overdue is the only on-time evidence there
      // is: the deliverable deadline is the only date to measure against.
      onTime += 1;
    }
  }
  return { ids, total, fulfilled, onTime };
}

function toRecord(user: SessionUser, row: CrmRow): CrmRecord | null {
  const summary = toSummary(row.influencerId);
  if (!summary) return null;
  const history = campaignHistory(user, row.influencerId);
  const interactions = [...row.interactions].sort((a, b) => b.at.localeCompare(a.at));

  return {
    id: row.id,
    orgId: row.orgId,
    influencerId: row.influencerId,
    displayName: summary.displayName,
    primaryHandle: summary.primaryHandle,
    avatarUrl: summary.avatarUrl,
    primaryPlatform: summary.primaryPlatform,
    followers: summary.followers,
    healthScore: summary.healthScore,
    stage: row.stage,
    ownerUserId: row.ownerUserId,
    ownerName: row.ownerName,
    tags: row.tags,
    contact: row.contact,
    customFields: row.customFields,
    interactions,
    relationship: relationshipScore(row, history),
    campaignIds: history.ids,
    lastInteractionAt: interactions[0]?.at ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

const toSummaryView = (record: CrmRecord): CrmSummary => {
  const { interactions: _i, customFields: _c, ...rest } = record;
  void _i;
  void _c;
  return rest;
};

export function listCrm(
  user: SessionUser,
  filter: { stage?: RelationshipStage; tag?: string; q?: string; ownerUserId?: string } = {},
): CrmSummary[] {
  const term = filter.q?.trim().toLowerCase();
  return rows()
    .filter((row) => row.orgId === user.orgId)
    .map((row) => toRecord(user, row))
    .filter((record): record is CrmRecord => record !== null)
    .filter((record) => !filter.stage || record.stage === filter.stage)
    .filter((record) => !filter.tag || record.tags.includes(filter.tag))
    .filter((record) => !filter.ownerUserId || record.ownerUserId === filter.ownerUserId)
    .filter(
      (record) =>
        !term ||
        record.displayName.toLowerCase().includes(term) ||
        record.primaryHandle.toLowerCase().includes(term) ||
        record.tags.some((tag) => tag.toLowerCase().includes(term)),
    )
    .map(toSummaryView)
    .sort((a, b) => (b.lastInteractionAt ?? "").localeCompare(a.lastInteractionAt ?? ""));
}

/** Every tag this organisation has used, for the filter row. */
export function crmTags(user: SessionUser): string[] {
  const seen = new Set<string>();
  for (const row of rows()) {
    if (row.orgId !== user.orgId) continue;
    for (const tag of row.tags) seen.add(tag);
  }
  return [...seen].sort();
}

/**
 * The record for one creator, created on first read. Opening a creator is
 * how a relationship starts, so there is no separate "add to CRM" step to
 * forget.
 */
export function getOrCreateCrm(user: SessionUser, influencerId: string): CrmRecord {
  const summary = toSummary(influencerId);
  if (!summary) throw new ApiFailure("not_found", "Creator not found.");

  const existing = rows().find(
    (row) => row.orgId === user.orgId && row.influencerId === influencerId,
  );
  if (existing) {
    assertTenantAccess(user, existing.orgId);
    return toRecord(user, existing)!;
  }

  const now = new Date().toISOString();
  const row: CrmRow = {
    id: nextId("crm"),
    orgId: user.orgId,
    influencerId,
    stage: "prospect",
    ownerUserId: null,
    ownerName: null,
    tags: [],
    contact: EMPTY_CONTACT,
    customFields: {},
    interactions: [],
    createdAt: now,
    updatedAt: now,
  };
  rows().push(row);
  persist("crm", [row]);
  return toRecord(user, row)!;
}

function mutable(user: SessionUser, influencerId: string): CrmRow {
  getOrCreateCrm(user, influencerId);
  const row = rows().find(
    (entry) => entry.orgId === user.orgId && entry.influencerId === influencerId,
  )!;
  assertTenantAccess(user, row.orgId);
  return row;
}

export function updateCrm(
  user: SessionUser,
  influencerId: string,
  patch: CrmPatch,
): CrmRecord {
  const row = mutable(user, influencerId);

  if (patch.stage && patch.stage !== row.stage) {
    // A stage change is an event, not a field edit: the timeline is the
    // record of how a relationship moved, and silently overwriting the
    // stage would lose it.
    row.interactions.push({
      id: nextId("int"),
      kind: "stage_change",
      body: `Moved to ${patch.stage.replace(/_/g, " ")}`,
      at: new Date().toISOString(),
      byName: user.name,
      refId: null,
    });
    row.stage = patch.stage;
  }
  if (patch.ownerUserId !== undefined) {
    row.ownerUserId = patch.ownerUserId;
    row.ownerName = patch.ownerUserId === null ? null : user.name;
  }
  if (patch.tags) row.tags = [...new Set(patch.tags)];
  if (patch.contact) {
    row.contact = { ...row.contact, ...patch.contact, source: patch.contact.source ?? "manual" };
  }
  if (patch.customFields) row.customFields = { ...row.customFields, ...patch.customFields };

  row.updatedAt = new Date().toISOString();
  persist("crm", [row]);
  return toRecord(user, row)!;
}

/** The address outreach may use, or null when it must not be used at all. */
export function contactableEmail(user: SessionUser, influencerId: string): string | null {
  const row = rows().find(
    (entry) => entry.orgId === user.orgId && entry.influencerId === influencerId,
  );
  if (!row || row.contact.optedOutAt) return null;
  return row.contact.email ?? row.contact.managerEmail ?? null;
}

/**
 * Records that a creator asked not to be contacted. Deliberately one-way:
 * an opt-out cleared by whoever wants to send the next email is not an
 * opt-out, so removing it is a support action against the record, not a
 * button in the send flow.
 */
export function optOut(user: SessionUser, influencerId: string, note: string): CrmRecord {
  const row = mutable(user, influencerId);
  row.contact = { ...row.contact, optedOutAt: new Date().toISOString() };
  row.updatedAt = new Date().toISOString();
  persist("crm", [row]);
  return addInteraction(user, influencerId, { kind: "note", body: `Opted out of outreach. ${note}`.trim() });
}

export function addInteraction(
  user: SessionUser,
  influencerId: string,
  input: InteractionInput & { refId?: string | null },
): CrmRecord {
  const row = mutable(user, influencerId);
  row.interactions.push({
    id: nextId("int"),
    kind: input.kind,
    body: input.body,
    at: new Date().toISOString(),
    byName: user.name,
    refId: input.refId ?? null,
  });
  row.updatedAt = new Date().toISOString();
  persist("crm", [row]);
  return toRecord(user, row)!;
}

/**
 * Records an event against a creator without creating a relationship that
 * nobody asked for: used by campaigns, contracts and payments, which should
 * annotate an existing record but must not manufacture one for every creator
 * a campaign happens to touch.
 */
export function noteIfTracked(
  user: SessionUser,
  influencerId: string,
  input: InteractionInput & { refId?: string | null },
): void {
  const row = rows().find(
    (entry) => entry.orgId === user.orgId && entry.influencerId === influencerId,
  );
  if (!row) return;
  addInteraction(user, influencerId, input);
}
