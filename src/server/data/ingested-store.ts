import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { gunzipSync } from "node:zlib";
import {
  applyWrites,
  countInfluencersStored,
  ensureSchema,
  loadAll,
  TABLES,
  postgresDriver,
  type WriteOp,
} from "./postgres";
import { replaceShared, shared } from "./process-store";
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

/**
 * The same records, gzipped, for a deployment target that cannot carry the
 * plain file.
 *
 * A serverless bundle is copied per function, and 41MB of JSON copied that
 * many times is a deployment that either fails or costs a fortune to move.
 * Gzipped it is 6.7MB, and inflating it costs 62ms once per cold start
 * against the 105ms the parse costs anyway — so the packed copy is what ships
 * and the plain file is what a developer works against.
 *
 * Written by `npm run data:pack`, never by the app: the app writing its own
 * archive would put a second, staler copy of the database on disk with nothing
 * saying which one is current.
 */
const PACKED_FILE = `${DATA_FILE}.gz`;

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

/** The plain file wins when both exist: on a developer's machine it is live. */
function readStored(): { text: string; from: string } | null {
  if (existsSync(DATA_FILE)) return { text: readFileSync(DATA_FILE, "utf8"), from: DATA_FILE };
  if (existsSync(PACKED_FILE)) {
    return { text: gunzipSync(readFileSync(PACKED_FILE)).toString("utf8"), from: PACKED_FILE };
  }
  return null;
}

function load(): IngestedRecords {
  if (postgresDriver()) {
    // The database is loaded by `warmIngestedStore` before the first request.
    // Reading the JSON file here instead would silently serve a stale copy of
    // a different database, and then write on top of it.
    console.warn("[data] ingested store read before warm-up; serving empty until it runs.");
    return empty();
  }
  return loadFromDisk();
}

/**
 * Loads the database into the process under the Postgres driver. Called once
 * from `instrumentation.ts`, before the server accepts requests.
 *
 * A database with no creators and a JSON file beside it is a machine that ran
 * the development driver until now: the file is imported once, so switching
 * drivers loses nothing and needs no separate migration step.
 */
export async function warmIngestedStore(): Promise<void> {
  if (!postgresDriver()) return;
  await ensureSchema();

  if ((await countInfluencersStored()) === 0 && readStored()) {
    const fromDisk = loadFromDisk();
    console.log(`[data] postgres is empty; importing ${fromDisk.influencers.length} creators from ${DATA_FILE}`);
    await applyWrites(TABLES.map((table) => ({ table, upsert: fromDisk[table] })));
  }

  const records = await loadAll();
  replaceShared("ingested", records);
  console.log(`[data] loaded ${records.influencers.length} creators from postgres`);
}

function loadFromDisk(): IngestedRecords {
  const stored = readStored();
  if (!stored) return empty();
  try {
    const parsed: unknown = JSON.parse(stored.text);
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
    throw new Error(`Ingested data at ${stored.from} could not be read: ${String(error)}`);
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
  if (postgresDriver()) return;
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

/**
 * Writes are applied to the database strictly in the order they were made to
 * memory, or two mutations of the same creator could land reversed.
 */
let chain: Promise<void> = Promise.resolve();

/**
 * Records a mutation. Memory is already updated by the time this is called;
 * the returned promise resolves once the database has it too. Under the
 * development driver the whole file is rewritten and the promise is already
 * settled.
 */
function commit(current: IngestedRecords, ops: WriteOp[]): Promise<void> {
  current.revision += 1;
  if (!postgresDriver()) {
    persist(current);
    return Promise.resolve();
  }
  const run = chain.then(() => applyWrites(ops));
  chain = run.catch(() => undefined);
  return run;
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
export function upsertIngested(records: IngestedRecord[]): Promise<void> {
  if (records.length === 0) return Promise.resolve();
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

  const owners = [...ids];
  return commit(current, [
    { table: "influencers", upsert: records.map((record) => record.influencer) },
    { table: "accounts", deleteOwners: owners },
    { table: "accounts", upsert: records.flatMap((record) => record.accounts) },
    { table: "content", deleteOwners: owners },
    { table: "content", upsert: records.flatMap((record) => record.content) },
    { table: "snapshots", upsert: records.map((record) => record.snapshot) },
  ]);
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
export function upsertAiOutputs(outputs: RawAiOutput[]): Promise<void> {
  if (outputs.length === 0) return Promise.resolve();
  const current = store();
  const ids = new Set(outputs.map((output) => output.influencerId));
  current.ai = [...current.ai.filter((item) => !ids.has(item.influencerId)), ...outputs];
  return commit(current, [{ table: "ai", upsert: outputs }]);
}

/**
 * Records a creator's OAuth grant, replacing any earlier one for that account.
 *
 * A reconnection supersedes the previous grant entirely: the old refresh token
 * is dead the moment the creator consents again, and keeping it around is a
 * live credential nobody can use and everybody could leak.
 */
export function upsertGrant(grant: RawOAuthGrant): Promise<void> {
  const current = store();
  current.grants = [
    ...current.grants.filter((item) => item.accountId !== grant.accountId),
    grant,
  ];
  return commit(current, [{ table: "grants", upsert: [grant] }]);
}

export function removeGrant(accountId: string): Promise<void> {
  const current = store();
  current.grants = current.grants.filter((item) => item.accountId !== accountId);
  return commit(current, [{ table: "grants", deleteKeys: [accountId] }]);
}

/**
 * Replaces one creator's stored upload history.
 *
 * Replaced rather than merged: a deeper read is a superset of a shallower one,
 * and merging would leave duplicates of every video read twice.
 */
export function upsertViewHistory(influencerId: string, points: RawViewPoint[]): Promise<void> {
  const current = store();
  current.viewHistory = [
    ...current.viewHistory.filter((point) => point.influencerId !== influencerId),
    ...points,
  ];
  return commit(current, [
    { table: "viewHistory", deleteOwners: [influencerId] },
    { table: "viewHistory", upsert: points },
  ]);
}

/**
 * Persists accounts edited in place — a field flipped on a row the store
 * already holds, where building a replacement record would be ceremony.
 */
export function upsertAccounts(accounts: RawAccount[]): Promise<void> {
  if (accounts.length === 0) return Promise.resolve();
  return commit(store(), [{ table: "accounts", upsert: accounts }]);
}

/**
 * Writes snapshots directly, replacing any reading already held for the same
 * account and day.
 *
 * `upsertIngested` carries exactly one snapshot per creator because an ingest
 * observes one moment. Backfilling a series needs to write many at once.
 */
export function upsertSnapshots(points: RawSnapshot[]): Promise<void> {
  if (points.length === 0) return Promise.resolve();
  const current = store();
  const keys = new Set(points.map((point) => `${point.accountId}@${point.date}`));
  current.snapshots = [
    ...current.snapshots.filter((point) => !keys.has(`${point.accountId}@${point.date}`)),
    ...points,
  ];
  return commit(current, [{ table: "snapshots", upsert: points }]);
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
): Promise<void> {
  const current = store();
  current.signals = [
    ...current.signals.filter((item) => item.influencerId !== influencerId),
    ...(signals ? [signals] : []),
  ];
  current.audience = [
    ...current.audience.filter((item) => item.influencerId !== influencerId),
    ...(audience ? [audience] : []),
  ];
  return commit(current, [
    { table: "signals", deleteOwners: [influencerId] },
    { table: "signals", upsert: signals ? [signals] : [] },
    { table: "audience", deleteOwners: [influencerId] },
    { table: "audience", upsert: audience ? [audience] : [] },
  ]);
}

/** Removes every record belonging to the given creators, across all tables. */
export function removeInfluencers(ids: string[]): Promise<number> {
  if (ids.length === 0) return Promise.resolve(0);
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

  const removed = before - current.influencers.length;
  return commit(current, [
    ...TABLES.filter((table) => table !== "snapshots").map((table) => ({ table, deleteOwners: ids })),
    { table: "snapshots", deleteOwners: [...accountIds] },
  ]).then(() => removed);
}

/** Test seam, and the operator's "start over". */
export function clearIngested(): Promise<void> {
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
  return commit(current, TABLES.map((table) => ({ table, truncate: true as const })));
}
