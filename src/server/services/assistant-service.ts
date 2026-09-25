import { z } from "zod";
import type { SessionUser } from "@/lib/contracts/auth";
import { Category } from "@/lib/contracts/common";
import { SearchQuery } from "@/lib/contracts/search";
import { AiUnavailable, extract, openAiKey, openAiModel } from "@/server/ai/openai";
import { formatCompact } from "@/lib/format";
import { semanticSearch } from "@/server/analytics/semantic-index";
import { listWatchlists } from "./comparative-service";
import { campaignContext, campaignTopicOf } from "./assistant-campaign";
import { matchReasons } from "./match-reasons";
import { toSummary } from "@/server/repositories/influencer-repository";
import { parseAsk, refineAsk, type ParsedCriterion } from "./ask-service";
import { searchInfluencers } from "./search-service";

/* ---------------------------------------------------------------------------
 * The assistant: ask in your own words, get an answer over SENSO's own data.
 *
 * The split is the whole design, and it is the §7 rule made structural:
 *
 *   - The model may *translate* a sentence into filters, and it may *narrate*
 *     rows it was handed. It never produces a figure. Its translation schema
 *     holds only filter values, and its narration schema holds only prose and
 *     creator ids — there is no field for a follower count to arrive in.
 *   - The deterministic grammar (`parseAsk`) runs first and wins wherever it
 *     read something. AI is asked only about what the grammar left behind, so
 *     a sentence the product already understands never becomes a model call,
 *     and an assistant with no key is still useful rather than broken.
 *   - Every number a person sees comes from the search result, rendered by
 *     this application. The narration is checked against those rows before it
 *     is shown, and dropped whole if it states a figure that was not in them.
 * ------------------------------------------------------------------------ */

export const ASSISTANT_VERSION = "assistant-1.0.0";
export const ASSISTANT_PROMPT_VERSION = "1.0.0";

/** What the model may set. Filter values only — never a fact about a creator. */
const Interpretation = z.object({
  categories: z.array(Category).max(4),
  country: z.string().nullable(),
  language: z.string().nullable(),
  platform: z.enum(["youtube", "instagram", "any"]),
  followersMin: z.number().int().nullable(),
  followersMax: z.number().int().nullable(),
  healthMin: z.number().int().nullable(),
  verifiedOnly: z.boolean(),
  sort: z.enum(["health_score_desc", "followers_desc", "engagement_desc", "relevance"]),
  /** Free text the search matches against titles, bios and place mentions. */
  keywords: z.string().nullable(),
  /** The model's own account of what it could not turn into a filter. */
  notCaptured: z.array(z.string()).max(5),
});
type Interpretation = z.infer<typeof Interpretation>;

/** Prose plus pointers. There is no numeric field, on purpose. */
const Narration = z.object({
  answer: z.string(),
  highlights: z.array(z.object({ influencerId: z.string(), why: z.string() })).max(5),
});

export interface AssistantAnswer {
  question: string;
  /** Set when the question was about work rather than about creators. */
  topic: "creators" | "campaign" | "benchmark" | "attention";
  /** The facts a work answer was drawn from, each checkable on the screen. */
  facts: string[];
  href: string | null;
  query: SearchQuery;
  criteria: ParsedCriterion[];
  /** What the grammar could not read and the model was asked about. */
  unparsed: string[];
  results: {
    id: string;
    displayName: string;
    primaryHandle: string;
    primaryPlatform: string;
    followers: number | null;
    healthScore: number | null;
    engagementRate: number | null;
    country: string | null;
    categories: string[];
    confidence: number | null;
    /** Which of the asked-for criteria this creator satisfied. */
    reasons: { field: string; detail: string }[];
  }[];
  total: number;
  /** Null when there is no AI, or when the narration failed its check. */
  answer: string | null;
  highlights: { influencerId: string; why: string }[];
  /** Why the answer is missing, when it is. */
  degraded: "no_ai" | "ai_unavailable" | "ungrounded" | null;
  /** True when the filters matched nothing and these are the closest by meaning. */
  semantic: boolean;
  /** The corpus terms that earned the semantic ranking, when it was used. */
  matchedTerms: string[];
  model: string | null;
  promptVersion: string;
  version: string;
}

const TRANSLATE_SYSTEM = [
  "You turn a marketer's request into search filters for an influencer database.",
  "Return filter values only. You must never state or guess a creator's follower count,",
  "engagement rate, demographics or any other measured figure — those come from the",
  "database, not from you.",
  "Categories are single lowercase words such as beauty, technology, food, fitness,",
  "gaming, finance, travel, education, parenting, lifestyle, comedy, music, sports.",
  "country is an ISO 3166-1 alpha-2 code, language an ISO 639-1 code.",
  "Leave a field null when the request does not imply it. Do not invent constraints.",
  "List in notCaptured anything asked for that no filter can express.",
].join(" ");

const NARRATE_SYSTEM = [
  "You explain a set of creator search results to a marketer.",
  "Use ONLY the figures given to you in the rows below. Never calculate, estimate or",
  "recall a number that is not printed in them, and never state a figure for a creator",
  "whose row shows it as absent — say it was not reported instead.",
  "Two or three sentences. Name creators by their display name. Do not repeat every row.",
].join(" ");

function toQuery(base: SearchQuery, interpretation: Interpretation): SearchQuery {
  const next: SearchQuery = { ...base };
  // The grammar's reading wins wherever it read something: it is
  // deterministic, reproducible, and the person can see which words produced
  // it. The model only fills what was left empty.
  if (!next.category?.length && interpretation.categories.length > 0) {
    next.category = interpretation.categories;
  }
  if (!next.country?.length && interpretation.country?.length === 2) {
    next.country = [interpretation.country.toUpperCase()];
  }
  if (!next.language?.length && interpretation.language) {
    next.language = [interpretation.language.toLowerCase()];
  }
  if (!next.platform?.length && interpretation.platform !== "any") {
    next.platform = [interpretation.platform];
  }
  if (next.followersMin === undefined && interpretation.followersMin !== null) {
    next.followersMin = interpretation.followersMin;
  }
  if (next.followersMax === undefined && interpretation.followersMax !== null) {
    next.followersMax = interpretation.followersMax;
  }
  if (next.healthMin === undefined && interpretation.healthMin !== null) {
    next.healthMin = interpretation.healthMin;
  }
  if (interpretation.verifiedOnly && !next.verification?.length) {
    next.verification = ["verified"];
  }
  if (!next.q && interpretation.keywords) next.q = interpretation.keywords;
  if (next.sort === "relevance" && interpretation.sort !== "relevance") {
    next.sort = interpretation.sort;
  }
  return next;
}

/**
 * Every number a narration is allowed to contain, in the forms this app
 * prints them. Checked as strings rather than parsed out of prose: the point
 * is that a figure on screen can be found in the rows, not that the sentence
 * parses.
 */
function groundedNumbers(rows: AssistantAnswer["results"], total: number): Set<string> {
  const allowed = new Set<string>([String(total), String(rows.length)]);
  for (const row of rows) {
    for (const value of [row.followers, row.healthScore, row.confidence]) {
      if (value === null) continue;
      allowed.add(String(value));
      allowed.add(String(Math.round(value)));
      allowed.add(formatCompact(value));
    }
    if (row.engagementRate !== null) {
      allowed.add(row.engagementRate.toFixed(1));
      allowed.add(row.engagementRate.toFixed(2));
      allowed.add(String(Math.round(row.engagementRate)));
    }
  }
  return allowed;
}

/**
 * True when every figure worth checking in the narration appears in the rows.
 * Small integers are ignored: "three creators" and "top 5" are counting the
 * answer, not quoting the database, and rejecting those would reject every
 * usable sentence.
 */
export function isGrounded(text: string, allowed: Set<string>): boolean {
  // The suffix must be attached to the digits and not run into a word, or
  // "12 matches" reads as "12M" and every plain sentence fails the check.
  const tokens = text.match(/\d[\d.,]*(?:[KMB](?![A-Za-z]))?%?/g) ?? [];
  for (const raw of tokens) {
    const token = raw.replace(/[.,]$/, "");
    const bare = token.replace(/[%]/g, "");
    const numeric = Number(bare.replace(/[KMB]/gi, "").replace(/,/g, ""));
    if (!Number.isNaN(numeric) && numeric < 100 && !/[KMB%]/i.test(token)) continue;
    if (allowed.has(bare) || allowed.has(bare.toUpperCase()) || allowed.has(bare.replace(/,/g, ""))) {
      continue;
    }
    return false;
  }
  return true;
}

/** The empty shell a work answer fills in, so both halves return one shape. */
function emptyAnswer(question: string, query: SearchQuery): AssistantAnswer {
  return {
    question,
    topic: "creators",
    facts: [],
    href: null,
    query,
    criteria: [],
    unparsed: [],
    results: [],
    total: 0,
    semantic: false,
    matchedTerms: [],
    answer: null,
    highlights: [],
    degraded: null,
    model: null,
    promptVersion: ASSISTANT_PROMPT_VERSION,
    version: ASSISTANT_VERSION,
  };
}

const WORK_SYSTEM = [
  "You answer a marketer's question about their own campaign from the facts below.",
  "Use ONLY those facts. Never calculate a figure they do not contain, never estimate,",
  "and where a fact says something was not reported, say it was not reported.",
  "Two or three sentences, plain and specific.",
].join(" ");

export async function askAssistant(
  user: SessionUser,
  question: string,
  options: { previous?: SearchQuery; limit?: number } = {},
): Promise<AssistantAnswer> {
  // A question about a campaign, a benchmark or what needs attention is not a
  // creator search, and running it as one returns a plausible list of
  // strangers instead of an answer.
  const topic = options.previous ? null : campaignTopicOf(question);
  if (topic) {
    const context = campaignContext(user, question, topic);
    if (context) {
      const shell = emptyAnswer(question, SearchQuery.parse({}));
      shell.topic = context.topic;
      shell.facts = context.facts;
      shell.href = context.href;
      if (!openAiKey()) {
        shell.degraded = "no_ai";
        return shell;
      }
      try {
        const call = await extract(Narration, {
          schemaName: "senso_assistant_answer",
          system: WORK_SYSTEM,
          user: `Question: ${question}\n\nFacts:\n${context.facts.join("\n")}`,
          maxTokens: 700,
        });
        shell.model = call.model;
        // Same check as the creator half: a number that is not in the facts
        // drops the whole sentence.
        const allowed = new Set<string>();
        for (const fact of context.facts) {
          for (const token of fact.match(/\d[\d.,]*(?:[KMB](?![A-Za-z]))?%?/g) ?? []) {
            allowed.add(token.replace(/[.,]$/, "").replace(/%/g, ""));
          }
        }
        if (isGrounded(call.value.answer, allowed)) shell.answer = call.value.answer;
        else shell.degraded = "ungrounded";
      } catch (error) {
        if (!(error instanceof AiUnavailable)) throw error;
        shell.degraded = "ai_unavailable";
      }
      return shell;
    }
  }

  const parsed = options.previous ? refineAsk(options.previous, question) : parseAsk(question);

  // "remove competitors" only means something once you know who they are.
  // The grammar cannot: it is pure and has no session. Here we do — so a word
  // it could not place is matched against the organisation's own watchlists,
  // and a hit expands into an exclusion of that list's creators.
  const unresolved = parsed.unparsed.filter((word) => word.length > 2);
  if (unresolved.length > 0 && /\bremove|exclude|without\b/i.test(question)) {
    for (const list of listWatchlists(user)) {
      const name = list.name.toLowerCase();
      if (!unresolved.some((word) => name.includes(word) || word.includes(name) || word === list.kind)) {
        continue;
      }
      const existing = parsed.query.excludeIds ?? [];
      parsed.query.excludeIds = [...new Set([...existing, ...list.influencerIds])];
      parsed.criteria.push({
        field: "excludeIds",
        value: list.id,
        from: question,
        label: `Without the ${list.name} list (${list.influencerIds.length})`,
      });
      parsed.unparsed = parsed.unparsed.filter(
        (word) => !(name.includes(word) || word.includes(name) || word === list.kind),
      );
    }
  }
  // The grammar builds a query the way a URL carries one — comma strings for
  // the list filters — so it goes back through the schema before the search
  // layer, which expects arrays.
  let query = SearchQuery.parse({ ...parsed.query, pageSize: options.limit ?? 10, page: 1 });
  let degraded: AssistantAnswer["degraded"] = openAiKey() ? null : "no_ai";
  let model: string | null = null;

  // The model is consulted only about words the grammar could not read.
  if (!degraded && parsed.unparsed.length > 0) {
    try {
      const call = await extract(Interpretation, {
        schemaName: "senso_search_interpretation",
        system: TRANSLATE_SYSTEM,
        user: `Request: ${question}\n\nAlready understood: ${
          parsed.criteria.map((criterion) => criterion.label).join(", ") || "nothing"
        }\nNot understood: ${parsed.unparsed.join(", ")}`,
        maxTokens: 800,
      });
      query = toQuery(query, call.value);
      model = call.model;
    } catch (error) {
      if (!(error instanceof AiUnavailable)) throw error;
      degraded = "ai_unavailable";
    }
  }

  const search = await searchInfluencers(user, query);
  let total = search.page.total;
  let semantic = false;
  let matchedTerms: string[] = [];
  let items = search.page.items;

  // Nothing matched the filters. Rather than an empty page, read the corpus:
  // the creators' own bios and upload titles hold what the request was about,
  // and the result is labelled as "closest by meaning" rather than passed off
  // as a filter match.
  if (items.length === 0) {
    const hits = semanticSearch(question, options.limit ?? 10);
    const found = hits
      .map((hit) => ({ hit, summary: toSummary(hit.id) }))
      .filter((entry): entry is { hit: (typeof hits)[number]; summary: NonNullable<ReturnType<typeof toSummary>> } => entry.summary !== null);
    if (found.length > 0) {
      items = found.map((entry) => entry.summary);
      total = found.length;
      semantic = true;
      matchedTerms = [...new Set(found.flatMap((entry) => entry.hit.terms))].slice(0, 8);
    }
  }

  const results = items.map((item) => ({
    id: item.id,
    displayName: item.displayName,
    primaryHandle: item.primaryHandle,
    primaryPlatform: item.primaryPlatform,
    followers: item.followers,
    healthScore: item.healthScore,
    engagementRate: item.engagementRate,
    country: item.countryName ?? item.countryCode,
    categories: item.categories,
    confidence: item.confidence,
    reasons: matchReasons(item, query),
  }));

  let answer: string | null = null;
  let highlights: AssistantAnswer["highlights"] = [];

  if (!degraded && results.length > 0) {
    try {
      const rows = results
        .map(
          (row) =>
            `${row.id} | ${row.displayName} (@${row.primaryHandle}, ${row.primaryPlatform}) | followers ${
              row.followers ?? "not reported"
            } | health ${row.healthScore ?? "not scored"} | engagement ${
              row.engagementRate === null ? "not reported" : `${row.engagementRate.toFixed(1)}%`
            } | country ${row.country ?? "not reported"} | ${row.categories.join(", ") || "uncategorised"}`,
        )
        .join("\n");
      const call = await extract(Narration, {
        schemaName: "senso_assistant_answer",
        system: NARRATE_SYSTEM,
        user: `Question: ${question}\n\n${
          semantic
            ? "No creator matched the filters exactly; these are the closest by what they write about. Say so."
            : `Matches: ${total}`
        }\n\nRows:\n${rows}`,
        maxTokens: 900,
      });
      model = call.model;
      const allowed = groundedNumbers(results, total);
      if (isGrounded(call.value.answer, allowed)) {
        answer = call.value.answer;
        // A highlight pointing at a creator that is not on screen is a
        // hallucinated citation, which is worse than no citation.
        const ids = new Set(results.map((row) => row.id));
        highlights = call.value.highlights.filter((entry) => ids.has(entry.influencerId));
      } else {
        degraded = "ungrounded";
      }
    } catch (error) {
      if (!(error instanceof AiUnavailable)) throw error;
      degraded = "ai_unavailable";
    }
  }

  return {
    question,
    topic: "creators",
    facts: [],
    href: null,
    query,
    criteria: parsed.criteria,
    unparsed: parsed.unparsed,
    results,
    total,
    semantic,
    matchedTerms,
    answer,
    highlights,
    degraded,
    model: model ?? (openAiKey() ? openAiModel() : null),
    promptVersion: ASSISTANT_PROMPT_VERSION,
    version: ASSISTANT_VERSION,
  };
}
