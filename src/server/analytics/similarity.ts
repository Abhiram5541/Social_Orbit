/* ---------------------------------------------------------------------------
 * Creator similarity — deterministic, explainable, and reproducible.
 *
 * Not an embedding and not a model call. Similarity here is a weighted overlap
 * of attributes the platform already holds, which means every score can be
 * explained in a sentence ("same categories, similar size, shared themes")
 * rather than defended as the output of a black box. DPR §24 says semantic
 * search waits until scale demands it; this is what serves until then.
 * ------------------------------------------------------------------------ */

export interface SimilarityCandidate {
  id: string;
  categories: string[];
  /** Free-text themes and keywords, from AI classification where it has run. */
  themes: string[];
  followers: number | null;
  country: string | null;
  language: string | null;
}

export interface Lookalike {
  id: string;
  score: number;
  /** Why these two resemble each other, in the order that mattered most. */
  reasons: string[];
}

const WEIGHTS = {
  category: 0.4,
  themes: 0.25,
  size: 0.2,
  country: 0.1,
  language: 0.05,
} as const;

function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const left = new Set(a.map((value) => value.toLowerCase()));
  const right = new Set(b.map((value) => value.toLowerCase()));
  let shared = 0;
  for (const value of left) if (right.has(value)) shared += 1;
  return shared / (left.size + right.size - shared);
}

/**
 * Closeness in audience size, on a log scale.
 *
 * Linear distance is useless across this range: 10k and 60k are peers in a way
 * that 10M and 10.05M are not, though the raw gap is a thousand times larger.
 */
function sizeCloseness(a: number | null, b: number | null): number {
  if (!a || !b || a <= 0 || b <= 0) return 0;
  const gap = Math.abs(Math.log10(a) - Math.log10(b));
  // A full order of magnitude apart scores zero.
  return Math.max(0, 1 - gap);
}

/** Nearest creators to `subject`, best first. Never returns the subject. */
export function lookalikes(
  subject: SimilarityCandidate,
  pool: SimilarityCandidate[],
  limit = 6,
): Lookalike[] {
  const scored: Lookalike[] = [];

  for (const candidate of pool) {
    if (candidate.id === subject.id) continue;

    const category = jaccard(subject.categories, candidate.categories);
    // Without a shared category two creators are not lookalikes, however much
    // else they have in common — a 2M-subscriber cook and a 2M-subscriber
    // gamer are the same size and nothing else.
    if (category === 0) continue;

    const themes = jaccard(subject.themes, candidate.themes);
    const size = sizeCloseness(subject.followers, candidate.followers);
    const country = subject.country && subject.country === candidate.country ? 1 : 0;
    const language = subject.language && subject.language === candidate.language ? 1 : 0;

    const score =
      category * WEIGHTS.category +
      themes * WEIGHTS.themes +
      size * WEIGHTS.size +
      country * WEIGHTS.country +
      language * WEIGHTS.language;

    const reasons: { weight: number; text: string }[] = [
      { weight: category * WEIGHTS.category, text: "shares a category" },
      { weight: themes * WEIGHTS.themes, text: "covers similar themes" },
      { weight: size * WEIGHTS.size, text: "similar audience size" },
      { weight: country * WEIGHTS.country, text: "same country" },
      { weight: language * WEIGHTS.language, text: "same language" },
    ];

    scored.push({
      id: candidate.id,
      score: Number((score * 100).toFixed(1)),
      reasons: reasons
        .filter((reason) => reason.weight > 0)
        .sort((a, b) => b.weight - a.weight)
        .map((reason) => reason.text),
    });
  }

  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}
