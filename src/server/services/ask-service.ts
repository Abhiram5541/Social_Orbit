import { Category, CATEGORY_LABEL, Platform } from "@/lib/contracts/common";
import { FollowerBand, type SearchQuery } from "@/lib/contracts/search";

/* ---------------------------------------------------------------------------
 * Ask SENSO — a sentence becomes the structured filters the search already
 * has, and the parsed criteria are shown before anything runs.
 *
 * Deterministic on purpose. A language model is an excellent parser and a
 * terrible source of truth, and this product's whole claim is that its
 * numbers are checkable: a query that silently became different filters than
 * the person asked for would be the same failure as a fabricated metric.
 * So the grammar below is the parser, every clause it recognises is shown
 * back with the words that produced it, and anything it did not understand
 * is reported rather than guessed at.
 *
 * It also means the feature works with no AI provider configured, which is
 * the state this deployment is in.
 * ------------------------------------------------------------------------ */

export const ASK_VERSION = "ask-1.0.0";

export interface ParsedCriterion {
  /** The filter this set, in the query string. */
  field: string;
  value: string;
  /** What the person wrote that produced it. */
  from: string;
  label: string;
}

export interface AskResult {
  query: SearchQuery;
  criteria: ParsedCriterion[];
  /** Words that matched no rule, so a reader can see what was ignored. */
  unparsed: string[];
  version: string;
}

/**
 * 50k, 1.2m, 500 000, "1 lakh".
 *
 * Suffixes are listed longest first. With `l` ahead of `lakh` the alternation
 * matched "1 l" out of "1 lakh" and left "akh" behind, which then became a
 * free-text filter and narrowed the search to nothing.
 */
function parseCount(raw: string): number | null {
  const text = raw.toLowerCase().replace(/[, ]/g, "");
  const match = /^(\d+(?:\.\d+)?)(lakh|crore|mn|cr|k|m|l)?$/.exec(text);
  if (!match) return null;
  const value = Number(match[1]);
  const scale: Record<string, number> = {
    k: 1_000,
    m: 1_000_000,
    mn: 1_000_000,
    l: 100_000,
    lakh: 100_000,
    cr: 10_000_000,
    crore: 10_000_000,
  };
  return Math.round(value * (match[2] ? scale[match[2]] : 1));
}

const COUNTRY_BY_NAME: Record<string, string> = {
  india: "IN", indian: "IN",
  "united states": "US", usa: "US", us: "US", american: "US",
  "united kingdom": "GB", uk: "GB", british: "GB",
  canada: "CA", australia: "AU", germany: "DE", france: "FR",
  spain: "ES", brazil: "BR", mexico: "MX", indonesia: "ID",
  japan: "JP", "south korea": "KR", pakistan: "PK", singapore: "SG",
  uae: "AE", "united arab emirates": "AE", nigeria: "NG", "south africa": "ZA",
};

const LANGUAGE_BY_NAME: Record<string, string> = {
  english: "en", hindi: "hi", telugu: "te", tamil: "ta", spanish: "es",
  portuguese: "pt", russian: "ru", arabic: "ar", french: "fr", german: "de",
  indonesian: "id", japanese: "ja", korean: "ko", bengali: "bn", marathi: "mr",
  kannada: "kn", malayalam: "ml", punjabi: "pa", urdu: "ur",
};

const BAND_WORDS: Record<string, FollowerBand> = {
  nano: "nano", micro: "micro", mid: "mid", "mid-tier": "mid",
  macro: "macro", mega: "mega", celebrity: "mega",
};

/**
 * Parses one request into filters. Order matters: ranges are read before
 * bare numbers, so "50k–500k followers" does not become two minimums.
 */
export function parseAsk(input: string): AskResult {
  const text = input.toLowerCase();
  const criteria: ParsedCriterion[] = [];
  const consumed: [number, number][] = [];

  const take = (match: RegExpMatchArray | null) => {
    if (match?.index !== undefined) consumed.push([match.index, match.index + match[0].length]);
    return match;
  };
  const add = (field: string, value: string, from: string, label: string) =>
    criteria.push({ field, value, from: from.trim(), label });

  const query: Record<string, string> = {};

  /* --- how many to return --------------------------------------------- */
  const count = take(/\b(?:find|show|give me|get)\s+(\d{1,3})\b/.exec(text));
  if (count) {
    query.pageSize = String(Math.min(100, Number(count[1])));
    add("pageSize", query.pageSize, count[0], `Return ${query.pageSize}`);
  }

  /* --- budget ----------------------------------------------------------
   * Runs *before* the follower rules, and they now refuse a number carrying a
   * currency mark. "under 1 lakh followers" is an audience; "under ₹1 lakh"
   * is a budget, and reading the second as the first was silently returning
   * creators with fewer than one hundred thousand rupees of audience.
   * ------------------------------------------------------------------- */
  const CUR = "(?:₹|rs\\.?|inr|\\$|usd|€|eur|£|gbp)";
  const CURRENCY_CODE: Record<string, string> = {
    "₹": "INR", rs: "INR", "rs.": "INR", inr: "INR",
    $: "USD", usd: "USD", "€": "EUR", eur: "EUR", "£": "GBP", gbp: "GBP",
  };
  const currencyOf = (mark: string): string =>
    CURRENCY_CODE[mark.trim().toLowerCase()] ?? "INR";

  const budgetRange = take(
    new RegExp(
      `\\b(?:between\\s*)?${CUR}\\s*([\\d.,]+\\s*(?:lakh|crore|mn|cr|k|m|l)?)\\s*(?:-|–|to|and)\\s*${CUR}?\\s*([\\d.,]+\\s*(?:lakh|crore|mn|cr|k|m|l)?)`,
      "i",
    ).exec(text),
  );
  const budgetUnder = budgetRange
    ? null
    : take(
        new RegExp(
          `\\b(?:under|below|less than|cheaper than|up to|max|<)\\s*${CUR}\\s*([\\d.,]+\\s*(?:lakh|crore|mn|cr|k|m|l)?)`,
          "i",
        ).exec(text),
      );
  const budgetOver = budgetRange
    ? null
    : take(
        new RegExp(
          `\\b(?:over|above|more than|at least|from|>)\\s*${CUR}\\s*([\\d.,]+\\s*(?:lakh|crore|mn|cr|k|m|l)?)`,
          "i",
        ).exec(text),
      );

  const markOf = (matched: string): string =>
    new RegExp(CUR, "i").exec(matched)?.[0] ?? "₹";

  if (budgetRange) {
    const min = parseCount(budgetRange[1]);
    const max = parseCount(budgetRange[2]);
    if (min !== null && max !== null) {
      query.rateCurrency = currencyOf(markOf(budgetRange[0]));
      query.rateMin = String(min);
      query.rateMax = String(max);
      add("rate", `${min}–${max}`, budgetRange[0], `Budget ${budgetRange[0].trim()} per placement (estimated)`);
    }
  } else if (budgetUnder) {
    const max = parseCount(budgetUnder[1]);
    if (max !== null) {
      query.rateCurrency = currencyOf(markOf(budgetUnder[0]));
      query.rateMax = String(max);
      add("rateMax", String(max), budgetUnder[0], `Under ${budgetUnder[0].replace(/^\w+\s*/, "").trim()} per placement (estimated)`);
    }
  } else if (budgetOver) {
    const min = parseCount(budgetOver[1]);
    if (min !== null) {
      query.rateCurrency = currencyOf(markOf(budgetOver[0]));
      query.rateMin = String(min);
      add("rateMin", String(min), budgetOver[0], `Over ${budgetOver[0].replace(/^\w+\s*/, "").trim()} per placement (estimated)`);
    }
  }

  /* --- follower ranges ------------------------------------------------- */
  const range = take(
    /\b([\d.,]+\s*(?:lakh|crore|mn|cr|k|m|l)?)\s*(?:-|–|to|and)\s*([\d.,]+\s*(?:lakh|crore|mn|cr|k|m|l)?)\s*(?:followers|subs|subscribers|audience)/.exec(text),
  );
  if (range) {
    const min = parseCount(range[1]);
    const max = parseCount(range[2]);
    if (min !== null && max !== null) {
      query.followersMin = String(min);
      query.followersMax = String(max);
      add("followers", `${min}–${max}`, range[0], `Audience ${range[1].trim()}–${range[2].trim()}`);
    }
  } else {
    const over = take(
      /\b(?:over|above|more than|at least|>)\s*([\d.,]+\s*(?:lakh|crore|mn|cr|k|m|l)?)\s*(?:followers|subs|subscribers|audience)?/.exec(text),
    );
    if (over) {
      const min = parseCount(over[1]);
      if (min !== null) {
        query.followersMin = String(min);
        add("followersMin", String(min), over[0], `Over ${over[1].trim()} followers`);
      }
    }
    const under = take(
      /\b(?:under|below|less than|fewer than|<)\s*([\d.,]+\s*(?:lakh|crore|mn|cr|k|m|l)?)\s*(?:followers|subs|subscribers|audience)?/.exec(text),
    );
    if (under) {
      const max = parseCount(under[1]);
      if (max !== null) {
        query.followersMax = String(max);
        add("followersMax", String(max), under[0], `Under ${under[1].trim()} followers`);
      }
    }
  }

  /* --- audience band --------------------------------------------------- */
  for (const [word, band] of Object.entries(BAND_WORDS)) {
    if (query.followersMin || query.followersMax) break;
    const match = take(new RegExp(`\\b${word}(?:[- ]influencers?|[- ]creators?)?\\b`).exec(text));
    if (match) {
      query.followerBand = band;
      add("followerBand", band, match[0], `${word[0].toUpperCase()}${word.slice(1)} audience`);
      break;
    }
  }

  /* --- category -------------------------------------------------------- */
  const categories: string[] = [];
  for (const category of Category.options) {
    const label = CATEGORY_LABEL[category].toLowerCase();
    const match = take(new RegExp(`\\b(${category}|${label})\\b`).exec(text));
    if (match) {
      categories.push(category);
      add("category", category, match[0], CATEGORY_LABEL[category]);
    }
  }
  if (categories.length > 0) query.category = categories.join(",");

  /* --- platform -------------------------------------------------------- */
  const platforms: string[] = [];
  for (const platform of Platform.options) {
    const match = take(new RegExp(`\\b${platform}\\b`).exec(text));
    if (match) {
      platforms.push(platform);
      add("platform", platform, match[0], `On ${platform}`);
    }
  }
  if (platforms.length > 0) query.platform = platforms.join(",");

  /* --- country and language -------------------------------------------- */
  for (const [name, code] of Object.entries(COUNTRY_BY_NAME)) {
    const match = take(new RegExp(`\\b${name}\\b`).exec(text));
    if (match) {
      query.country = code;
      add("country", code, match[0], `In ${name.replace(/^\w/, (c) => c.toUpperCase())}`);
      break;
    }
  }
  for (const [name, code] of Object.entries(LANGUAGE_BY_NAME)) {
    const match = take(new RegExp(`\\b${name}(?:[- ]speaking|[- ]language)\\b`).exec(text));
    if (match) {
      query.language = code;
      add("language", code, match[0], `${name.replace(/^\w/, (c) => c.toUpperCase())}-speaking`);
      break;
    }
  }

  /* --- quality --------------------------------------------------------- */
  const engagement = take(/\b(?:engagement|engaged)\s*(?:rate)?\s*(?:over|above|at least|>)\s*([\d.]+)\s*%/.exec(text));
  if (engagement) {
    query.engagementMin = engagement[1];
    add("engagementMin", engagement[1], engagement[0], `Engagement over ${engagement[1]}%`);
  } else if (take(/\b(?:strong|high|good|great)\s+engagement\b/.exec(text))) {
    // A named quality maps to a stated threshold rather than a private one:
    // the person can see exactly what "strong" was taken to mean.
    query.engagementMin = "3";
    add("engagementMin", "3", "strong engagement", "Engagement over 3%");
  }

  const health = take(/\b(?:health|score)\s*(?:over|above|at least|>)\s*(\d{1,3})\b/.exec(text));
  if (health) {
    query.healthMin = health[1];
    add("healthMin", health[1], health[0], `SENSO Health over ${health[1]}`);
  } else if (take(/\b(?:high[- ]quality|top[- ]performing|best|strongest)\b/.exec(text))) {
    query.healthMin = "70";
    add("healthMin", "70", "high quality", "SENSO Health over 70");
  }

  if (take(/\bverified\b/.exec(text))) {
    query.verification = "verified";
    add("verification", "verified", "verified", "SENSO Verified only");
  }
  if (take(/\b(?:active|posting|publishing)\b/.exec(text))) {
    query.activity = "active";
    add("activity", "active", "active", "Actively publishing");
  }
  if (take(/\b(?:low[- ]risk|safe|brand[- ]safe)\b/.exec(text))) {
    query.risk = "low";
    add("risk", "low", "low risk", "Low audience risk");
  }

  /* --- sort ------------------------------------------------------------ */
  const sort = take(/\bsort(?:ed)?\s+by\s+(followers|engagement|health|growth|views)\b/.exec(text));
  if (sort) {
    const key: Record<string, string> = {
      followers: "followers_desc",
      engagement: "engagement_desc",
      health: "health_score_desc",
      growth: "growth_desc",
      views: "median_views_desc",
    };
    query.sort = key[sort[1]];
    add("sort", query.sort, sort[0], `Sorted by ${sort[1]}`);
  } else if (criteria.length > 0) {
    query.sort = "health_score_desc";
  }

  /* --- leftovers as a keyword search ------------------------------------ */
  const STOP = new Set([
    "find", "show", "me", "get", "give", "with", "and", "or", "in", "on", "for",
    "a", "an", "the", "creators", "creator", "influencers", "influencer", "who",
    "that", "are", "is", "of", "to", "from", "followers", "subscribers", "subs",
    "audience", "please", "i", "want", "need", "looking", "some", "any", "at",
    "least", "more", "than", "over", "under", "above", "below", "between",
  ]);
  const leftover = maskConsumed(text, consumed)
    .split(/[^a-z0-9#']+/)
    .filter((word) => word.length > 2 && !STOP.has(word));

  if (leftover.length > 0) {
    query.q = leftover.join(" ");
    add("q", query.q, leftover.join(" "), `Matching “${leftover.join(" ")}”`);
  }

  return {
    query: query as unknown as SearchQuery,
    criteria,
    unparsed: leftover,
    version: ASK_VERSION,
  };
}

/** Blanks the spans a rule already claimed, so they cannot become keywords. */
function maskConsumed(text: string, spans: [number, number][]): string {
  const chars = [...text];
  for (const [start, end] of spans) {
    for (let i = start; i < end && i < chars.length; i += 1) chars[i] = " ";
  }
  return chars.join("");
}

/** The parsed query as a discovery URL, so a result is shareable. */
export function askToSearchParams(result: AskResult): string {
  const params = new URLSearchParams(result.query as unknown as Record<string, string>);
  return params.toString();
}

/* --- Refinements -------------------------------------------------------- */

/**
 * Follow-ups such as "show 10 more", "under 1 lakh", "remove beauty".
 * Applied to the previous query rather than re-parsed from scratch, so a
 * conversation narrows instead of restarting.
 */
export function refineAsk(previous: SearchQuery, instruction: string): AskResult {
  const text = instruction.toLowerCase();
  const query: Record<string, string> = { ...(previous as unknown as Record<string, string>) };
  const criteria: ParsedCriterion[] = [];

  const more = /\bshow\s+(\d{1,3})\s+more\b/.exec(text);
  const remove = /\bremove\s+([a-z ]+)$/.exec(text.trim());

  // The fresh clause is merged first so a removal cannot be undone by the
  // same sentence that asked for it — "remove beauty" parses "beauty" as a
  // category, and applying that after the removal would put it straight back.
  const fresh = parseAsk(instruction);
  if (!remove) {
    Object.assign(query, fresh.query as unknown as Record<string, string>);
    for (const criterion of fresh.criteria) {
      if (criterion.field === "q" && more) continue;
      criteria.push(criterion);
    }
  }

  if (more) {
    const size = Number(previous.pageSize ?? 25) + Number(more[1]);
    query.pageSize = String(Math.min(100, size));
    criteria.push({ field: "pageSize", value: query.pageSize, from: more[0], label: `Return ${query.pageSize}` });
    delete query.q;
  }

  let removedNothing = false;
  if (remove) {
    const word = remove[1].trim();
    let hit = false;

    const drop = (field: string, value: string, label: string) => {
      const kept = (query[field] ?? "").split(",").filter((entry) => entry && entry !== value);
      if (kept.length > 0) query[field] = kept.join(",");
      else delete query[field];
      criteria.push({ field, value: `-${value}`, from: remove![0], label: `Without ${label}` });
      hit = true;
    };

    for (const category of Category.options) {
      if (!word.includes(category) && !word.includes(CATEGORY_LABEL[category].toLowerCase())) continue;
      drop("category", category, CATEGORY_LABEL[category]);
    }
    // Removing anything else the grammar can name: a country, a language, a
    // platform, a verification state, or the free-text clause.
    const named = parseAsk(word);
    for (const criterion of named.criteria) {
      if (criterion.field === "q" || criterion.field === "pageSize") continue;
      const values = String(
        (named.query as unknown as Record<string, string>)[criterion.field] ?? "",
      ).split(",");
      for (const value of values) if (value) drop(criterion.field, value, criterion.label);
    }
    if (!hit && query.q && query.q.toLowerCase().includes(word)) {
      delete query.q;
      criteria.push({ field: "q", value: `-${word}`, from: remove[0], label: `Without “${word}”` });
      hit = true;
    }
    // Nothing in the query was called that. The caller may still be able to
    // resolve it — a watchlist name, for instance — so it is reported rather
    // than silently ignored.
    removedNothing = !hit;
  }

  return {
    query: query as unknown as SearchQuery,
    criteria,
    unparsed: removedNothing && remove ? [remove[1].trim()] : fresh.unparsed,
    version: ASK_VERSION,
  };
}
