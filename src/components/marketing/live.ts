import { CATEGORY_LABEL, type Category } from "@/lib/contracts/common";
import type { InfluencerProfile, InfluencerSummary } from "@/lib/contracts/influencer";
import { formatCompact, formatRelativeTime } from "@/lib/format";
import { allSummaries, toProfile } from "@/server/repositories/influencer-repository";
import type { SpecimenCreator } from "./specimen";

/* ---------------------------------------------------------------------------
 * Live creators for the landing page.
 *
 * The specimen module (specimen.ts) was written when the database was a few
 * hundred channels and no creator was worth putting on a homepage. With seven
 * thousand indexed, the surfaces that show *a creator* now show a real one —
 * the figures, the score and its confidence exactly as the application
 * computes them. What stays illustrative is what has to be: the campaign
 * example (SENSO holds no client's campaign) and the AI extract (enrichment
 * has not run on these creators yet). Both are still disclosed.
 *
 * Selection is deterministic for a given database — highest health among
 * creators with a photo, a country, a real audience and a brand-safe
 * category — so the page does not reshuffle between two visits.
 * ------------------------------------------------------------------------ */

/** Categories a marketing director expects to see on a first screen. */
const SHOWCASE: Category[] = [
  "entertainment", "food", "lifestyle", "technology", "beauty", "fashion",
  "travel", "fitness", "gaming", "education", "sports", "health",
];

function showcaseWorthy(s: InfluencerSummary): boolean {
  return (
    !s.isDemo &&
    s.healthScore !== null &&
    s.avatarUrl !== null &&
    s.countryName !== null &&
    (s.followers ?? 0) >= 250_000 &&
    s.categories.some((c) => SHOWCASE.includes(c))
  );
}

/** The creator the hero and the dossier are built around, and the search rows. */
export function landingCreators(): { hero: InfluencerProfile | null; rows: SpecimenCreator[] } {
  const ranked = allSummaries()
    .filter(showcaseWorthy)
    .sort((a, b) => (b.healthScore ?? 0) - (a.healthScore ?? 0));

  // Indian creators lead — the launch market — then the rest, one per country
  // so the table reads as a global index rather than one market's chart.
  const seen = new Set<string>();
  const picked: InfluencerSummary[] = [];
  for (const pass of [ranked.filter((s) => s.countryCode === "IN"), ranked]) {
    for (const s of pass) {
      if (picked.length >= 7) break;
      if (picked.includes(s) || seen.has(s.countryName!)) continue;
      seen.add(s.countryName!);
      picked.push(s);
    }
  }

  const hero = picked[0] ? toProfile(picked[0].id) : null;
  return { hero, rows: picked.map(toSpecimenShape) };
}

function toSpecimenShape(s: InfluencerSummary): SpecimenCreator {
  return {
    id: s.id,
    name: s.displayName,
    handle: s.primaryHandle,
    avatarUrl: s.avatarUrl,
    market: s.countryName ?? "—",
    categories: s.categories.map((c) => CATEGORY_LABEL[c]),
    platform: s.primaryPlatform === "youtube" ? "YouTube" : s.primaryPlatform === "instagram" ? "Instagram" : "X",
    followers: s.followers === null ? "—" : formatCompact(s.followers),
    medianViews: s.medianViews === null ? "—" : formatCompact(s.medianViews),
    engagement: s.engagementRate === null ? "—" : `${s.engagementRate.toFixed(1)}%`,
    health: Math.round(s.healthScore ?? 0),
    confidence: Math.round(s.confidence),
    verified: s.verification === "verified",
    risk: s.risk,
    activity: s.activity === "active" ? "Active" : s.activity === "slowing" ? "Slowing" : "Recent",
  };
}

/** Live facet counts for the search surface's rail. */
export function landingFacets(): { group: string; options: [string, string][] }[] {
  const all = allSummaries().filter((s) => !s.isDemo);
  const band = (f: number | null) => (f === null ? null : f >= 1_000_000 ? "mega" : f >= 500_000 ? "macro" : f >= 100_000 ? "mid" : f >= 10_000 ? "micro" : null);
  const count = (fn: (s: InfluencerSummary) => boolean) => all.filter(fn).length.toLocaleString("en-US");
  return [
    {
      group: "Audience size",
      options: [
        ["Micro · 10K–100K", count((s) => band(s.followers) === "micro")],
        ["Mid · 100K–500K", count((s) => band(s.followers) === "mid")],
        ["Macro · 500K–1M", count((s) => band(s.followers) === "macro")],
        ["Mega · 1M+", count((s) => band(s.followers) === "mega")],
      ],
    },
    {
      group: "Audience quality",
      options: [
        ["Low risk", count((s) => s.risk === "low")],
        ["Medium risk", count((s) => s.risk === "medium")],
        ["High risk", count((s) => s.risk === "high")],
      ],
    },
    {
      group: "Platform",
      options: [
        ["YouTube", count((s) => s.primaryPlatform === "youtube")],
        ["Instagram", count((s) => s.primaryPlatform === "instagram")],
      ],
    },
  ];
}

/** Every scored creator as (health, confidence), one point per occupied cell. */
export function landingQualityPoints(): { x: number; y: number; tone: "positive" | "brand" | "caution" | "critical" }[] {
  const cells = new Map<string, { x: number; y: number; tone: "positive" | "brand" | "caution" | "critical" }>();
  for (const s of allSummaries()) {
    if (s.isDemo || s.healthScore === null) continue;
    const x = Math.round(s.healthScore);
    const y = Math.round(s.confidence);
    const key = `${x}:${y}`;
    if (cells.has(key)) continue;
    cells.set(key, { x, y, tone: x >= 85 ? "positive" : x >= 70 ? "brand" : x >= 50 ? "caution" : "critical" });
  }
  return [...cells.values()];
}

export function collectedAgo(profile: InfluencerProfile): string {
  return formatRelativeTime(profile.lastRefreshedAt ?? new Date().toISOString());
}
