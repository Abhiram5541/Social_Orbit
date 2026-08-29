import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { shared } from "./process-store";
import type { RawAccount, RawAiOutput, RawContent, RawInfluencer, RawSnapshot } from "./records";

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
  /** Bumped on every write. Read-side caches derived from the whole database
   *  compare it to know when their basis has changed. */
  revision: number;
}

function empty(): IngestedRecords {
  return { influencers: [], accounts: [], snapshots: [], content: [], ai: [], revision: 0 };
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

function store(): IngestedRecords {
  return shared<IngestedRecords>("ingested", load);
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

/** Test seam, and the operator's "start over". */
export function clearIngested(): void {
  const current = store();
  current.influencers = [];
  current.accounts = [];
  current.snapshots = [];
  current.content = [];
  current.ai = [];
  current.revision += 1;
  persist(current);
}
