import type { DiscoveryQuery } from "./harvest-service";

/* ---------------------------------------------------------------------------
 * Where new creators are looked for.
 *
 * Discovery is `search.list` at 100 quota units a call, so the plan is a
 * fixed, rotating list rather than anything adaptive: every query gets its
 * turn, a day's budget decides how many turns a day, and the same list is what
 * an operator sweeps by hand — the scheduler and the script cannot disagree
 * about what "the places" are.
 * ------------------------------------------------------------------------ */

// Active in the last ~18 months. A channel silent longer than that is not a
// creator anyone is going to brief.
const publishedAfter = "2025-03-01T00:00:00Z";
const IN = { regionCode: "IN", order: "relevance", publishedAfter } as const;
const en = (q: string, extra: Partial<DiscoveryQuery> = {}): DiscoveryQuery => ({ q, relevanceLanguage: "en", ...IN, ...extra });
const te = (q: string, extra: Partial<DiscoveryQuery> = {}): DiscoveryQuery => ({ q, relevanceLanguage: "te", ...IN, ...extra });
const kn = (q: string, extra: Partial<DiscoveryQuery> = {}): DiscoveryQuery => ({ q, relevanceLanguage: "kn", ...IN, ...extra });

/**
 * Searches phrased as a local would write them, ranked by relevance so the
 * results are *about* the place rather than merely popular, in the local
 * script where that is what local creators write in.
 */
export const PLACE_QUERIES: Record<"Hyderabad" | "Bengaluru" | "Rajahmundry", DiscoveryQuery[]> = {
  Hyderabad: [
    en("Hyderabad vlog"),
    en("Hyderabad food vlog"),
    en("Hyderabad street food"),
    te("హైదరాబాద్ vlog"),
    en("Hyderabad biryani review"),
    en("Hyderabad shopping haul"),
    en("Hyderabad tech review", { videoCategoryId: "28" }),
    en("Hyderabad fitness gym", { videoCategoryId: "17" }),
    en("Hyderabad fashion"),
    en("Hyderabad makeup", { videoCategoryId: "26" }),
    en("Hyderabad travel places", { videoCategoryId: "19" }),
    en("Hyderabad comedy", { videoCategoryId: "23" }),
    te("hyderabad telugu vlog"),
    te("హైదరాబాద్ food"),
    en("Hyderabad cafe restaurant review"),
    en("Hyderabad real estate"),
    en("Hyderabad startup"),
    en("Hyderabadi"),
    en("Hyderabad cars bikes", { videoCategoryId: "2" }),
    en("Hyderabad cricket", { videoCategoryId: "17" }),
    te("Hyderabad daily vlog family"),
    en("Hyderabad education coaching", { videoCategoryId: "27" }),
  ],
  Bengaluru: [
    en("Bangalore vlog"),
    en("Bengaluru vlog"),
    en("Bangalore food vlog"),
    kn("ಬೆಂಗಳೂರು vlog"),
    en("Bangalore street food"),
    en("Bangalore cafe review"),
    en("Bangalore tech review", { videoCategoryId: "28" }),
    en("Bangalore startup"),
    en("Bangalore fitness gym", { videoCategoryId: "17" }),
    en("Bangalore fashion"),
    en("Bangalore makeup", { videoCategoryId: "26" }),
    en("Bangalore weekend getaway travel", { videoCategoryId: "19" }),
    en("Bangalore comedy", { videoCategoryId: "23" }),
    en("Bangalore real estate apartment"),
    kn("Bengaluru kannada vlog"),
    en("Bangalore traffic"),
    en("Bangalore cars bikes", { videoCategoryId: "2" }),
    en("Bangalore PG hostel life"),
    en("Bengaluru cricket football", { videoCategoryId: "17" }),
    en("Bangalore software engineer life"),
  ],
  Rajahmundry: [
    en("Rajahmundry vlog"),
    te("రాజమండ్రి vlog"),
    en("Rajahmundry food"),
    en("Rajamahendravaram"),
    te("రాజమండ్రి"),
    en("Rajahmundry street food"),
    te("Rajahmundry Godavari"),
    te("Rajahmundry telugu comedy"),
    en("Rajahmundry travel"),
    en("Rajahmundry shopping"),
    te("Rajahmundry daily vlog"),
    te("East Godavari vlog"),
  ],
};

const top = (q: string, lang: string, extra: Partial<DiscoveryQuery> = {}): DiscoveryQuery => ({
  q,
  relevanceLanguage: lang,
  ...IN,
  ...extra,
  order: "viewCount",
});

/**
 * The same places ranked by view count: the biggest channels that keep making
 * content about them. Broad phrasings only — with view-count ranking a narrow
 * query returns the same few viral videos every time.
 */
export const TOP_PLACE_QUERIES: Record<keyof typeof PLACE_QUERIES, DiscoveryQuery[]> = {
  Hyderabad: [
    top("Hyderabad", "en"),
    top("హైదరాబాద్", "te"),
    top("Hyderabad vlog", "en"),
    top("Hyderabad food", "en"),
    top("హైదరాబాద్ vlog", "te"),
    top("Hyderabadi", "en"),
    top("Hyderabad telugu", "te"),
    top("Hyderabad comedy", "en", { videoCategoryId: "23" }),
  ],
  Bengaluru: [
    top("Bangalore", "en"),
    top("ಬೆಂಗಳೂರು", "kn"),
    top("Bengaluru", "en"),
    top("Bangalore vlog", "en"),
    top("Bangalore food", "en"),
    top("Bengaluru kannada", "kn"),
    top("Bangalore comedy", "en", { videoCategoryId: "23" }),
    top("Bangalore tech", "en", { videoCategoryId: "28" }),
  ],
  Rajahmundry: [
    top("Rajahmundry", "en"),
    top("రాజమండ్రి", "te"),
    top("Rajamahendravaram", "te"),
    top("Rajahmundry vlog", "te"),
    top("Godavari", "te"),
    top("East Godavari", "te"),
  ],
};

/** Round-robin across places, so a budget that runs out still touched every city. */
export function interleave(lists: DiscoveryQuery[][]): DiscoveryQuery[] {
  const out: DiscoveryQuery[] = [];
  for (let i = 0; i < Math.max(...lists.map((list) => list.length)); i += 1) {
    for (const list of lists) if (list[i]) out.push(list[i]);
  }
  return out;
}

export const PLANS = {
  places: interleave(Object.values(PLACE_QUERIES)),
  top: interleave(Object.values(TOP_PLACE_QUERIES)),
} as const;
export type PlanName = keyof typeof PLANS;
