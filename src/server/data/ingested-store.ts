import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { shared } from "./process-store";
import type {
  RawAccount,
  RawAiOutput,
  RawAudience,
  RawAudienceSignals,
  RawContent,
  RawInfluencer,
  RawOAuthGrant,
  RawSnapshot,
  RawViewPoint,
} from "./records";

/* ---------------------------------------------------------------------------
 * Records written by a real connector.
 *
 * These are *not* fixtures: every row came off a platform API. They live here
 * only because the repository currently resolves against the development
 * driver (CLAUDE.md D2) — under the Postgres driver they are ordinary rows and
 * this file goes away with the rest of the directory.
 *
 * Persisted to disk because they are expensive to reacquire: refilling the
 * database costs real API quota against a daily budget, so a process restart
 * must not throw it away. The file is the driver's storage, not a fixture, and
 * is gitignored for the same reason a database file would be.
 * ------------------------------------------------------------------------ */

const DATA_FILE = join(process.cwd(), ".data", "ingested.json");

export interface IngestedRecords {
  influencers: RawInfluencer[];
  accounts: RawAccount[];
  snapshots: RawSnapshot[];
  content: RawContent[];
  /** Model classifications, kept apart from measurements by design (DPR §7). */
  ai: RawAiOutput[];
  /** Lean upload history — publish date and views only. */
  viewHistory: RawViewPoint[];
  /** OAuth grants, tokens sealed. Never leaves the server (CLAUDE.md §10). */
  grants: RawOAuthGrant[];
  /** Audience-quality readings. Only reachable with authorized access. */
  signals: RawAudienceSignals[];
  /** Demographic breakdowns. Only reachable with authorized access. */
  audience: RawAudience[];
  /** Bumped on every write. Read-side caches derived from the whole database
   *  compare it to know when their basis has changed. */
  revision: number;
}

function empty(): IngestedRecords {
  return {
    influencers: [],
    accounts: [],
    snapshots: [],
    content: [],
    ai: [],
    viewHistory: [],
    grants: [],
    signals: [],
    audience: [],
    revision: 0,
  };
}

function load(): IngestedRecords {
  if (!existsSync(DATA_FILE)) return empty();
  try {
    const parsed: unknown = JSON.parse(readFileSync(DATA_FILE, "utf8"));
    if (!parsed || typeof parsed !== "object") return empty();
    const records = parsed as Partial<IngestedRecords>;
    return {
      influencers: records.influencers ?? [],
      accounts: records.accounts ?? [],
      snapshots: records.snapshots ?? [],
      content: records.content ?? [],
      ai: records.ai ?? [],
      viewHistory: records.viewHistory ?? [],
      grants: records.grants ?? [],
      signals: records.signals ?? [],
      audience: records.audience ?? [],
      revision: 0,
    };
  } catch (error) {
    // Starting empty would silently discard a database. Refuse instead: the
    // file is either readable or something is wrong that a human should see.
    throw new Error(`Ingested data at ${DATA_FILE} could not be read: ${String(error)}`);
  }
}

/**
 * Written via a temporary file so a crash mid-write cannot truncate the store.
 *
 * A failure here is not fatal. Serverless hosts give a function a read-only
 * filesystem, so the write cannot succeed there — but the records are already
 * in memory and every read still works. Losing durability is worth reporting;
 * losing the request is not.
 */
function persist(records: IngestedRecords): void {
  try {
    mkdirSync(dirname(DATA_FILE), { recursive: true });
    const temporary = `${DATA_FILE}.tmp`;
    writeFileSync(temporary, JSON.stringify(records), "utf8");
    renameSync(temporary, DATA_FILE);
  } catch (error) {
    console.warn(
      `[data] ingested records held in memory only — ${DATA_FILE} is not writable ` +
        `(${String(error)}). They will be lost when this process ends.`,
    );
  }
}

/**
 * The one place the store is reached, and the one place its shape is repaired.
 *
 * The object lives on `globalThis` and outlives a hot reload, so code can be
 * handed a store built by an older revision of this file — one with no `ai`
 * array, or no `grants`, or no `viewHistory`. Guarding each reader and writer
 * separately failed three times in a row: whichever call site was forgotten
 * threw on `undefined.filter`.
 *
 * Repairing on access covers every consumer at once and costs a few property
 * checks. The driver is the right layer for it: the shape of what is stored
 * always lags the shape of the code that reads it.
 */
function store(): IngestedRecords {
  const current = shared<IngestedRecords>("ingested", load);

  current.influencers ??= [];
  current.accounts ??= [];
  current.snapshots ??= [];
  current.content ??= [];
  current.ai ??= [];
  current.viewHistory ??= [];
  current.grants ??= [];
  current.signals ??= [];
  current.audience ??= [];
  current.revision ??= 0;

  return current;
}

export function ingestedRecords(): IngestedRecords {
  return store();
}

export function ingestedCount(): number {
  return store().influencers.length;
}

/** Changes whenever the ingested record set does. */
export function ingestedRevision(): number {
  return store().revision;
}

export interface IngestedRecord {
  influencer: RawInfluencer;
  accounts: RawAccount[];
  snapshot: RawSnapshot;
  content: RawContent[];
}

/**
 * Writes creators' records, replacing any previous pass over the same creator —
 * except snapshots, which accumulate. A snapshot is an observation of a moment;
 * overwriting the history would destroy the only thing that makes a trend line
 * meaningful (DPR §16.1).
 *
 * Takes a batch because a per-creator write rebuilds every array, and a
 * 400-channel harvest doing that once per channel is quadratic over the whole
 * content table.
 */
export function upsertIngested(records: IngestedRecord[]): void {
  if (records.length === 0) return;
  const current = store();
  const ids = new Set(records.map((record) => record.influencer.id));

  current.influencers = [
    ...current.influencers.filter((item) => !ids.has(item.id)),
    ...records.map((record) => record.influencer),
  ];
  current.accounts = [
    ...current.accounts.filter((item) => !ids.has(item.influencerId)),
    ...records.flatMap((record) => record.accounts),
  ];
  current.content = [
    ...current.content.filter((item) => !ids.has(item.influencerId)),
    ...records.flatMap((record) => record.content),
  ];

  // One snapshot per account per day: re-running an ingest on the same day
  // corrects that day's reading rather than appending a duplicate point.
  const sameDay = new Set(
    records.map((record) => `${record.snapshot.accountId}@${record.snapshot.date}`),
  );
  current.snapshots = [
    ...current.snapshots.filter((point) => !sameDay.has(`${point.accountId}@${point.date}`)),
    ...records.map((record) => record.snapshot),
  ];

  current.revision += 1;
  persist(current);
}

/**
 * Stores one creator's AI classification, replacing any earlier pass.
 *
 * Separate from `upsertIngested` on purpose: enrichment runs long after
 * ingestion and must not disturb a single observed row. Re-ingesting a creator
 * likewise leaves their enrichment alone — the observations changed, not the
 * classification, and re-running the model would cost tokens to learn the same
 * thing.
 */
export function upsertAiOutputs(outputs: RawAiOutput[]): void {
  if (outputs.length === 0) return;
  const current = store();
  const ids = new Set(outputs.map((output) => output.influencerId));
  current.ai = [...current.ai.filter((item) => !ids.has(item.influencerId)), ...outputs];
  current.revision += 1;
  persist(current);
}

/**
 * Records a creator's OAuth grant, replacing any earlier one for that account.
 *
 * A reconnection supersedes the previous grant entirely: the old refresh token
 * is dead the moment the creator consents again, and keeping it around is a
 * live credential nobody can use and everybody could leak.
 */
export function upsertGrant(grant: RawOAuthGrant): void {
  const current = store();
  current.grants = [
    ...current.grants.filter((item) => item.accountId !== grant.accountId),
    grant,
  ];
  current.revision += 1;
  persist(current);
}

export function removeGrant(accountId: string): void {
  const current = store();
  current.grants = current.grants.filter((item) => item.accountId !== accountId);
  current.revision += 1;
  persist(current);
}

/**
 * Persists an in-place edit to the stored records and invalidates read caches.
 *
 * For changes made by mutating a record the store already holds, where building
 * a whole replacement batch would be ceremony around a single field.
 */
/**
 * Replaces one creator's stored upload history.
 *
 * Replaced rather than merged: a deeper read is a superset of a shallower one,
 * and merging would leave duplicates of every video read twice.
 */
export function upsertViewHistory(influencerId: string, points: RawViewPoint[]): void {
  const current = store();
  current.viewHistory = [
    ...current.viewHistory.filter((point) => point.influencerId !== influencerId),
    ...points,
  ];
  current.revision += 1;
  persist(current);
}

export function touchIngested(): void {
  const current = store();
  current.revision += 1;
  persist(current);
}

/**
 * Writes snapshots directly, replacing any reading already held for the same
 * account and day.
 *
 * `upsertIngested` carries exactly one snapshot per creator because an ingest
 * observes one moment. Backfilling a series needs to write many at once.
 */
export function upsertSnapshots(points: RawSnapshot[]): void {
  if (points.length === 0) return;
  const current = store();
  const keys = new Set(points.map((point) => `${point.accountId}@${point.date}`));
  current.snapshots = [
    ...current.snapshots.filter((point) => !keys.has(`${point.accountId}@${point.date}`)),
    ...points,
  ];
  current.revision += 1;
  persist(current);
}

/**
 * Replaces one creator's audience-quality readings and demographic breakdown.
 *
 * Both are authorized-access facts, so both arrive together from the same
 * grant and are stored the same way. Passing null clears the reading rather
 * than leaving a stale one behind a revoked consent.
 */
export function upsertAudienceData(
  influencerId: string,
  signals: RawAudienceSignals | null,
  audience: RawAudience | null,
): void {
  const current = store();
  current.signals = [
    ...current.signals.filter((item) => item.influencerId !== influencerId),
    ...(signals ? [signals] : []),
  ];
  current.audience = [
    ...current.audience.filter((item) => item.influencerId !== influencerId),
    ...(audience ? [audience] : []),
  ];
  current.revision += 1;
  persist(current);
}

/** Removes every record belonging to the given creators, across all tables. */
export function removeInfluencers(ids: string[]): number {
  if (ids.length === 0) return 0;
  const current = store();
  const set = new Set(ids);
  const before = current.influencers.length;
  const accountIds = new Set(
    current.accounts.filter((item) => set.has(item.influencerId)).map((item) => item.id),
  );

  current.influencers = current.influencers.filter((item) => !set.has(item.id));
  current.accounts = current.accounts.filter((item) => !set.has(item.influencerId));
  current.content = current.content.filter((item) => !set.has(item.influencerId));
  current.ai = current.ai.filter((item) => !set.has(item.influencerId));
  current.viewHistory = current.viewHistory.filter((item) => !set.has(item.influencerId));
  current.signals = current.signals.filter((item) => !set.has(item.influencerId));
  current.audience = current.audience.filter((item) => !set.has(item.influencerId));
  current.grants = current.grants.filter((item) => !set.has(item.influencerId));
  current.snapshots = current.snapshots.filter((point) => !accountIds.has(point.accountId));

  current.revision += 1;
  persist(current);
  return before - current.influencers.length;
}

/** Test seam, and the operator's "start over". */
export function clearIngested(): void {
  const current = store();
  current.influencers = [];
  current.accounts = [];
  current.snapshots = [];
  current.content = [];
  current.ai = [];
  current.viewHistory = [];
  current.grants = [];
  current.signals = [];
  current.audience = [];
  current.revision += 1;
  persist(current);
}
