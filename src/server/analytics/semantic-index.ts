import { CATEGORY_LABEL } from "@/lib/contracts/common";
import { readRecords } from "@/server/data/records";
import { ingestedRevision } from "@/server/data/ingested-store";
import { shared } from "@/server/data/process-store";

/* ---------------------------------------------------------------------------
 * Semantic search over the creator corpus.
 *
 * The existing free-text filter is an exact substring match over a name, a
 * handle and a category label: "Telugu cooking creators in Hyderabad" matches
 * nothing, because no creator's *name* contains those words. What the
 * database does hold is the text the creators themselves wrote — bios, upload
 * titles, captions — and meaning can be read out of that corpus without
 * sending it anywhere.
 *
 * So this is TF-IDF with cosine similarity, built from the corpus itself:
 * deterministic, reproducible, versioned, and explainable down to which terms
 * matched. Not an embedding model — and deliberately not, for three reasons.
 * It needs no external provider, so it works on a deployment with no AI key
 * at all; it cannot hallucinate a creator into a result; and its ranking can
 * be defended in a meeting, which on this product matters more than the last
 * few points of recall.
 *
 * ponytail: TF-IDF over ~9k documents, rebuilt in-process when the store
 * changes. Move to embeddings behind the same two functions when recall
 * actually falls short, or to a real index when the corpus stops fitting.
 * ------------------------------------------------------------------------ */

export const SEMANTIC_VERSION = "semantic-1.0.0";

/** Upload titles sampled per creator. Enough for a theme, not a transcript. */
const TITLES_PER_CREATOR = 40;

const STOPWORDS = new Set([
  "the", "and", "for", "you", "your", "with", "this", "that", "from", "are", "was", "were",
  "have", "has", "had", "how", "what", "why", "who", "our", "out", "not", "but", "all", "can",
  "will", "just", "new", "get", "got", "one", "two", "its", "his", "her", "they", "them",
  "their", "about", "into", "more", "most", "best", "top", "video", "videos", "subscribe",
  "channel", "official", "watch", "full", "part", "shorts", "short", "live", "com", "www",
  "http", "https", "please", "like", "share", "comment", "follow", "link", "bio", "www",
  "creator", "creators", "find", "me", "a", "an", "of", "in", "on", "to", "is", "it", "at",
  "by", "or", "be", "as", "we", "us", "i", "my", "do", "does", "want", "need", "should",
  "work", "working", "campaign", "someone", "anyone", "people", "who",
]);

/** Lowercase, strip punctuation, drop stopwords and a crude plural. */
export function tokenise(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2 && token.length < 24 && !STOPWORDS.has(token))
    .map((token) => (token.length > 4 && token.endsWith("s") && !token.endsWith("ss") ? token.slice(0, -1) : token));
}

interface Document {
  id: string;
  /** term -> L2-normalised tf-idf weight. */
  vector: Map<string, number>;
}

interface Index {
  revision: number;
  documents: Document[];
  byId: Map<string, Document>;
  idf: Map<string, number>;
}

function build(): Index {
  const records = readRecords();
  const titles = new Map<string, string[]>();
  for (const content of records.content) {
    const list = titles.get(content.influencerId) ?? titles.set(content.influencerId, []).get(content.influencerId)!;
    if (list.length < TITLES_PER_CREATOR) list.push(`${content.title} ${content.caption}`);
  }

  const termCounts: Map<string, number>[] = [];
  const ids: string[] = [];
  const documentFrequency = new Map<string, number>();

  for (const influencer of records.influencers) {
    const text = [
      influencer.displayName,
      influencer.primaryHandle,
      influencer.bio,
      influencer.countryName,
      ...influencer.categories.map((category) => CATEGORY_LABEL[category] ?? category),
      ...(titles.get(influencer.id) ?? []),
    ].join(" ");

    const counts = new Map<string, number>();
    for (const token of tokenise(text)) counts.set(token, (counts.get(token) ?? 0) + 1);
    if (counts.size === 0) continue;

    ids.push(influencer.id);
    termCounts.push(counts);
    for (const term of counts.keys()) {
      documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
    }
  }

  const total = termCounts.length || 1;
  const idf = new Map<string, number>();
  for (const [term, frequency] of documentFrequency) {
    // A term in nearly every document carries no signal; smoothed so it goes
    // to ~0 rather than negative.
    idf.set(term, Math.log(1 + total / (1 + frequency)));
  }

  const documents: Document[] = termCounts.map((counts, index) => {
    const vector = new Map<string, number>();
    let norm = 0;
    for (const [term, count] of counts) {
      const weight = (1 + Math.log(count)) * (idf.get(term) ?? 0);
      if (weight <= 0) continue;
      vector.set(term, weight);
      norm += weight * weight;
    }
    norm = Math.sqrt(norm) || 1;
    for (const [term, weight] of vector) vector.set(term, weight / norm);
    return { id: ids[index], vector };
  });

  return {
    revision: ingestedRevision(),
    documents,
    byId: new Map(documents.map((document) => [document.id, document])),
    idf,
  };
}

/** Built once per store revision — the corpus only changes when it is written to. */
function index(): Index {
  const state = shared("semantic-index", () => ({ current: null as Index | null }));
  if (!state.current || state.current.revision !== ingestedRevision()) state.current = build();
  return state.current;
}

function queryVector(text: string, idf: Map<string, number>): Map<string, number> {
  const counts = new Map<string, number>();
  for (const token of tokenise(text)) counts.set(token, (counts.get(token) ?? 0) + 1);

  const vector = new Map<string, number>();
  let norm = 0;
  for (const [term, count] of counts) {
    const weight = (1 + Math.log(count)) * (idf.get(term) ?? 0);
    if (weight <= 0) continue;
    vector.set(term, weight);
    norm += weight * weight;
  }
  norm = Math.sqrt(norm) || 1;
  for (const [term, weight] of vector) vector.set(term, weight / norm);
  return vector;
}

/** Cosine, iterating the shorter side — both vectors are already normalised. */
function cosine(a: Map<string, number>, b: Map<string, number>): number {
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let score = 0;
  for (const [term, weight] of small) {
    const other = large.get(term);
    if (other !== undefined) score += weight * other;
  }
  return score;
}

export interface SemanticHit {
  id: string;
  score: number;
  /** The terms that actually earned the score, strongest first. */
  terms: string[];
}

/**
 * Creators whose own text is closest in meaning to the request. Returns
 * nothing when no word in the request appears anywhere in the corpus — an
 * empty result is the honest answer, not the whole index in arbitrary order.
 */
export function semanticSearch(text: string, limit = 20): SemanticHit[] {
  const { documents, idf } = index();
  const query = queryVector(text, idf);
  if (query.size === 0) return [];

  const hits: SemanticHit[] = [];
  for (const document of documents) {
    const score = cosine(query, document.vector);
    if (score <= 0) continue;
    hits.push({ id: document.id, score, terms: overlap(query, document.vector) });
  }
  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, limit);
}

/** Creators whose corpus resembles this one's. */
export function similarCreators(influencerId: string, limit = 8): SemanticHit[] {
  const { documents, byId } = index();
  const source = byId.get(influencerId);
  if (!source) return [];

  const hits: SemanticHit[] = [];
  for (const document of documents) {
    if (document.id === influencerId) continue;
    const score = cosine(source.vector, document.vector);
    if (score <= 0) continue;
    hits.push({ id: document.id, score, terms: overlap(source.vector, document.vector) });
  }
  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, limit);
}

function overlap(a: Map<string, number>, b: Map<string, number>): string[] {
  const common: { term: string; weight: number }[] = [];
  for (const [term, weight] of a) {
    const other = b.get(term);
    if (other !== undefined) common.push({ term, weight: weight * other });
  }
  common.sort((x, y) => y.weight - x.weight);
  return common.slice(0, 5).map((entry) => entry.term);
}
