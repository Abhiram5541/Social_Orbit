import type { HealthComponentKey } from "@/lib/contracts/score";

/* ---------------------------------------------------------------------------
 * Specimen data.
 *
 * Fictional creators with plausible figures, disclosed once on the page rather
 * than stamped on every surface. Kept in one module so a reader can check in a
 * single place exactly which numbers on the marketing site were chosen rather
 * than measured — which is the least a product built on provenance can do
 * about its own homepage.
 *
 * Everything NOT in this file that appears on the landing page is live: the
 * coverage figures come from `databaseStats()` against the running database.
 * ------------------------------------------------------------------------ */

export interface SpecimenCreator {
  name: string;
  handle: string;
  market: string;
  categories: string[];
  platform: string;
  followers: string;
  medianViews: string;
  engagement: string;
  health: number;
  confidence: number;
  verified: boolean;
  risk: "low" | "medium" | "high" | "unknown";
  activity: "Active" | "Recent" | "Slowing";
}

export const SPECIMEN_RESULTS: SpecimenCreator[] = [
  { name: "Northlight Studio", handle: "northlightstudio", market: "Canada", categories: ["Technology"], platform: "YouTube", followers: "1.2M", medianViews: "268.9K", engagement: "5.4%", health: 91, confidence: 94, verified: true, risk: "low", activity: "Active" },
  { name: "Saffron & Salt", handle: "saffronandsalt", market: "India", categories: ["Food & Beverage", "Lifestyle"], platform: "YouTube", followers: "486K", medianViews: "108.9K", engagement: "7.1%", health: 88, confidence: 92, verified: true, risk: "low", activity: "Active" },
  { name: "Meridian Field", handle: "meridianfield", market: "United Kingdom", categories: ["Travel"], platform: "Instagram", followers: "742K", medianViews: "191.4K", engagement: "4.8%", health: 84, confidence: 88, verified: true, risk: "low", activity: "Active" },
  { name: "Atlas Grain", handle: "atlasgrain", market: "Portugal", categories: ["Travel", "Lifestyle"], platform: "Instagram", followers: "892K", medianViews: "198.5K", engagement: "1.1%", health: 72, confidence: 74, verified: false, risk: "medium", activity: "Slowing" },
  { name: "Kestrel & Co", handle: "kestrelandco", market: "Australia", categories: ["Fashion"], platform: "Instagram", followers: "2.4M", medianViews: "412.7K", engagement: "0.9%", health: 58, confidence: 61, verified: false, risk: "high", activity: "Recent" },
  { name: "Halcyon Test Lab", handle: "halcyontestlab", market: "Germany", categories: ["Technology"], platform: "YouTube", followers: "318K", medianViews: "84.2K", engagement: "6.2%", health: 81, confidence: 43, verified: false, risk: "unknown", activity: "Active" },
  { name: "Verdant Table", handle: "verdanttable", market: "United States", categories: ["Food & Beverage"], platform: "Instagram", followers: "1.1M", medianViews: "204.6K", engagement: "2.7%", health: 69, confidence: 79, verified: true, risk: "low", activity: "Slowing" },
];

/** The creator whose full dossier is shown in the evaluate section. */
export const SPECIMEN_DOSSIER = SPECIMEN_RESULTS[0];

export const SPECIMEN_COMPONENTS: Record<HealthComponentKey, number | null> = {
  authenticity: 93,
  engagementQuality: 96,
  engagementRate: 88,
  growthPattern: 84,
  viewConsistency: 91,
  audienceActivity: 95,
  commentQuality: 87,
  uploadConsistency: 79,
  brandSafety: 94,
};

/** Facets with counts, as the discovery rail renders them. */
export const SPECIMEN_FACETS = [
  {
    group: "Audience size",
    options: [
      ["Micro · 10K–100K", "1,284"],
      ["Mid · 100K–500K", "3,918"],
      ["Macro · 500K–1M", "1,102"],
      ["Mega · 1M+", "846"],
    ],
  },
  {
    group: "Audience quality",
    options: [
      ["Low risk", "4,617"],
      ["Medium risk", "912"],
      ["High risk", "268"],
    ],
  },
  {
    group: "Verification",
    options: [
      ["SocialOrbit Verified", "2,046"],
      ["Connection pending", "184"],
    ],
  },
] as const;

/** The AI enrichment output, as the profile renders it. */
export const SPECIMEN_ENRICHMENT = {
  creatorType: "Independent hardware reviewer",
  audienceIntent:
    "Viewers arrive to decide whether to buy a specific device, and stay for teardown detail they cannot get from a spec sheet.",
  strengths: [
    "Sustained technical depth that survives a long-form format",
    "Discloses gifted hardware on camera, consistently",
    "Comment threads carry substantive follow-up questions, not emoji",
  ],
  risks: [
    "Reviews occasionally name competitor products directly",
    "Publishing cadence drops around major launch cycles",
  ],
  themes: [
    "laptop and workstation reviews",
    "thermal and acoustic testing",
    "long-term durability follow-ups",
  ],
  brandSafety: 94,
  commercialIntent: 88,
  provider: "openai",
  model: "gpt-5.1",
  promptVersion: "1.0.0",
} as const;

/** Campaign delivery, as the campaign detail page renders it. */
export const SPECIMEN_CAMPAIGN = {
  name: "Orbit Series launch",
  hashtag: "OrbitSeries2026",
  score: 78,
  attributedPosts: 14,
  reach: "4.1M",
  engagements: "182.4K",
  costPerEngagement: "£0.21",
  spend: "£38.2K",
  budget: "£45K",
  participants: [
    { name: "Northlight Studio", handle: "northlightstudio", posts: 4, reach: "1.4M", engagement: "5.4%", score: 95, rate: "£12.0K" },
    { name: "Saffron & Salt", handle: "saffronandsalt", posts: 5, reach: "1.2M", engagement: "7.1%", score: 88, rate: "£9.5K" },
    { name: "Meridian Field", handle: "meridianfield", posts: 3, reach: "986K", engagement: "4.8%", score: 74, rate: "£10.2K" },
    { name: "Atlas Grain", handle: "atlasgrain", posts: 2, reach: "512K", engagement: "1.1%", score: 55, rate: "£6.5K" },
  ],
} as const;

/**
 * Points for the quality-against-evidence canvas.
 *
 * Deliberately shaped like the real distribution rather than a flattering
 * diagonal: most creators sit mid-health on moderate evidence, a thin band
 * reaches high confidence, and a few score well on evidence too thin to rely
 * on — which is the case the whole confidence axis exists to expose.
 */
export const SPECIMEN_QUALITY_POINTS: { x: number; y: number; tone: "positive" | "brand" | "caution" | "critical" }[] = [
  ...seededCluster(58, 60, 34, 13, "caution"),
  ...seededCluster(74, 76, 26, 11, "brand"),
  ...seededCluster(88, 89, 12, 9, "positive"),
  ...seededCluster(41, 52, 18, 13, "critical"),
  // The case the section is about: strong scores standing on evidence inside
  // the preliminary band, which every other tool would print as a clean number.
  ...seededCluster(81, 26, 9, 10, "brand"),
  { x: 88, y: 22, tone: "positive" },
  { x: 76, y: 18, tone: "brand" },
];

/**
 * A deterministic scatter. A random one would move on every render and, in a
 * server component, differ between the server and client trees.
 */
function seededCluster(
  centreX: number,
  centreY: number,
  count: number,
  spread: number,
  tone: "positive" | "brand" | "caution" | "critical",
) {
  const points: { x: number; y: number; tone: typeof tone }[] = [];
  let seed = centreX * 7919 + centreY * 104729;
  const next = () => {
    seed = (seed * 1103515245 + 12345) % 2147483648;
    return seed / 2147483648;
  };
  for (let i = 0; i < count; i += 1) {
    points.push({
      x: clamp(centreX + (next() - 0.5) * spread * 2),
      y: clamp(centreY + (next() - 0.5) * spread * 2),
      tone,
    });
  }
  return points;
}

function clamp(value: number) {
  return Math.max(2, Math.min(98, Number(value.toFixed(2))));
}
