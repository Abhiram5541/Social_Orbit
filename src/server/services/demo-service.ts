import type { Category, Platform } from "@/lib/contracts/common";
import { SAFETY_CHECKS } from "@/server/ai/enrichment";
import {
  removeInfluencers,
  upsertAiOutputs,
  upsertAudienceData,
  upsertIngested,
  upsertSnapshots,
} from "@/server/data/ingested-store";
import type {
  RawAiOutput,
  RawAudience,
  RawAudienceSignals,
  RawContent,
  RawInfluencer,
  RawSnapshot,
} from "@/server/data/records";

/* ---------------------------------------------------------------------------
 * Demonstration records.
 *
 * The influencer database is real and has no generator (CLAUDE.md D12), and
 * that is deliberate: whole regions of the UI are empty for every harvested
 * creator because a public API cannot reach audience quality, demographics or
 * verification, and the product was built to say so rather than fill them in.
 *
 * These four creators exist to exercise those regions — every panel, every
 * score component, every risk level, both platforms. They are fabrications and
 * are marked as such at every layer:
 *
 *   - `isDemo` on the record, carried into the API contract and rendered as a
 *     "Demo record" badge wherever the creator appears;
 *   - excluded from cohort benchmarking, so an invented engagement rate can
 *     never move a real creator's percentile;
 *   - ids prefixed `demo_`, so one call removes every trace of them.
 *
 * The names are invented brands, not real people and not real accounts.
 * Nothing here is presented as an observation of anybody.
 * ------------------------------------------------------------------------ */

const DAY = 86_400_000;

/** Deterministic, so re-seeding rebuilds the same creators rather than drifting. */
function rng(seed: string): () => number {
  let state = 0;
  for (const character of seed) state = (state * 31 + character.charCodeAt(0)) >>> 0;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

type SafetyGrade = { level: "none" | "low" | "moderate" | "high"; note: string };

interface Blueprint {
  key: string;
  displayName: string;
  handle: string;
  platform: Platform;
  categories: Category[];
  bio: string;
  countryCode: string;
  countryName: string;
  languages: string[];
  followers: number;
  /** Compounded per week backwards across the snapshot series. */
  weeklyGrowthPct: number;
  /** Views on a typical upload, before per-upload variance. */
  medianViews: number;
  /** Spread applied to views. Higher means a less predictable creator. */
  variance: number;
  uploadsPerWeek: number;
  likeRate: number;
  commentRate: number;
  botRisk: number;
  inactiveAudience: number;
  /**
   * Week-on-week wobble in the follower series, as a percentage of the level.
   *
   * Small on purpose. Real follower counts do not bounce by double digits
   * week to week, and the growth formula measures volatility relative to the
   * trend — so noise a few times larger than the weekly gain floors the
   * steadiness term and reports a healthy channel as erratic.
   */
  snapshotNoisePct: number;
  /** Weeks whose gain is multiplied, to reproduce a purchased-audience step. */
  spikeWeeks?: number[];
  ai: Omit<
    RawAiOutput,
    "influencerId" | "provider" | "model" | "promptVersion" | "schemaVersion" | "generatedAt"
  >;
  audience: Omit<RawAudience, "influencerId" | "collectedAt">;
  signalEvidence: RawAudienceSignals["evidence"];
  titles: string[];
  hashtags: string[];
}

/** All thirteen checks, defaulting to a clean grade so none is ever missing. */
function checks(overrides: Partial<Record<string, SafetyGrade>>): Record<string, SafetyGrade> {
  return Object.fromEntries(
    SAFETY_CHECKS.map((key) => [
      key,
      overrides[key] ?? {
        level: "none" as const,
        note: "Nothing observed across the sampled uploads.",
      },
    ]),
  );
}

const BLUEPRINTS: Blueprint[] = [
  {
    key: "northlight",
    displayName: "Northlight Studio",
    handle: "northlightstudio",
    platform: "youtube",
    categories: ["technology"],
    bio: "Long-form workstation builds, colour-accurate display testing and the occasional teardown. Measured, unhurried, no sponsored superlatives.",
    countryCode: "CA",
    countryName: "Canada",
    languages: ["en"],
    followers: 1_240_000,
    weeklyGrowthPct: 0.72,
    medianViews: 318_000,
    variance: 0.34,
    uploadsPerWeek: 1.4,
    likeRate: 0.049,
    commentRate: 0.0061,
    botRisk: 8,
    inactiveAudience: 12,
    snapshotNoisePct: 0.10,
    signalEvidence: [
      {
        signal: "Follower velocity",
        observation: "No week-on-week gain exceeded 2.1x the trailing median across 14 weeks.",
        weight: "primary",
      },
      {
        signal: "Commenter account age",
        observation: "94% of sampled commenters hold accounts older than one year.",
        weight: "primary",
      },
      {
        signal: "Engagement locality",
        observation: "Comment-language mix tracks the audience country mix within 4 points.",
        weight: "supporting",
      },
    ],
    audience: {
      countries: [
        { code: "US", name: "United States", share: 34.2 },
        { code: "CA", name: "Canada", share: 18.6 },
        { code: "GB", name: "United Kingdom", share: 11.4 },
        { code: "DE", name: "Germany", share: 8.1 },
        { code: "AU", name: "Australia", share: 6.3 },
      ],
      languages: [
        { code: "en", name: "English", share: 88.4 },
        { code: "de", name: "German", share: 6.2 },
        { code: "fr", name: "French", share: 5.4 },
      ],
      ageBands: [
        { band: "18-24", share: 19.3 },
        { band: "25-34", share: 41.7 },
        { band: "35-44", share: 26.2 },
        { band: "45-54", share: 9.4 },
        { band: "55+", share: 3.4 },
      ],
      gender: [
        { label: "Male", share: 71.8 },
        { label: "Female", share: 25.9 },
        { label: "Other", share: 2.3 },
      ],
    },
    titles: [
      "Colour accuracy on a budget: five panels measured",
      "The workstation build I actually kept",
      "Teardown: what a repairable laptop looks like in 2026",
      "Thermal throttling, measured properly",
      "Why your monitor calibration is drifting",
      "Storage benchmarks nobody runs",
    ],
    hashtags: ["hardware", "workstation", "displaytesting", "teardown"],
    ai: {
      categories: ["technology"],
      creatorType: "Long-form technical reviewer",
      contentThemes: [
        "hardware review",
        "measurement methodology",
        "repairability",
        "colour science",
      ],
      audienceIntent: "Purchase research before a considered, high-value hardware decision.",
      commercialIntent: 42,
      brandSafetyScore: 96,
      commentQuality: 84,
      sponsorshipSignals: [
        "Paid-promotion disclosure card on 6 of 45 sampled uploads",
        "Sponsor segments verbally timestamped in the description",
      ],
      recommendedIndustries: [
        "Consumer electronics",
        "Professional displays",
        "Storage and peripherals",
        "Developer tooling",
      ],
      primaryLanguage: "English",
      creatorInterests: [
        "colour science",
        "photography workflows",
        "right to repair",
        "silent computing",
      ],
      creatorKeywords: ["calibration", "delta-E", "thermal", "teardown", "benchmark"],
      mentionedBrands: ["Northlight Studio Tools"],
      mentionedProducts: ["27-inch reference display", "workstation chassis"],
      brandAffinity: [
        "Professional display manufacturers",
        "Component-level tooling",
        "Colour calibration hardware",
      ],
      competitorAffinity: ["Independent teardown channels", "Colour-management educators"],
      previousCollaborations: [
        {
          brand: "A display calibration vendor",
          evidence: "Disclosed paid segment naming the vendor in a sampled upload.",
          sourceUrl: null,
        },
      ],
      safetyChecks: checks({
        controversialTopics: {
          level: "low",
          note: "Right-to-repair advocacy is stated as opinion and kept away from personal attacks.",
        },
      }),
      strengths: [
        "Publishes its measurement method, so claims are checkable",
        "Sponsorship disclosed in-video and in the description",
        "Audience skews toward purchase-stage research",
      ],
      risks: ["Narrow topical range limits reach outside hardware buyers"],
      evidence: [
        {
          claim: "Reviews state measurement conditions before results",
          sourceUrl: null,
          confidence: 0.93,
        },
        { claim: "Paid segments are disclosed on-screen", sourceUrl: null, confidence: 0.88 },
      ],
    },
  },
  {
    key: "saffron",
    displayName: "Saffron & Salt",
    handle: "saffronandsalt",
    platform: "youtube",
    // Lifestyle first, food second, because that is exactly what YouTube's own
    // topic classification does to every cooking channel in this database
    // (CLAUDE.md D14) — it never emits a food topic. The AI layer supplies
    // `food` as the inferred category, reads merge the two observed-first, and
    // the cohort key lands in a bucket that has real peers to benchmark against.
    categories: ["lifestyle"],
    bio: "Regional home cooking, filmed in one kitchen. Recipes written down, weights in grams, no thirty-second cuts.",
    countryCode: "IN",
    countryName: "India",
    languages: ["en", "hi"],
    followers: 486_000,
    weeklyGrowthPct: 1.34,
    medianViews: 141_000,
    variance: 0.71,
    uploadsPerWeek: 2.2,
    likeRate: 0.062,
    commentRate: 0.0094,
    botRisk: 31,
    inactiveAudience: 27,
    snapshotNoisePct: 0.28,
    signalEvidence: [
      {
        signal: "Follower velocity",
        observation:
          "Two weeks show gains 3.4x the trailing median, both following a cross-posted short.",
        weight: "primary",
      },
      {
        signal: "Commenter account age",
        observation: "61% of sampled commenters hold accounts older than one year.",
        weight: "primary",
      },
      {
        signal: "Comment repetition",
        observation: "8% of sampled comments are near-duplicate single-emoji replies.",
        weight: "supporting",
      },
    ],
    audience: {
      countries: [
        { code: "IN", name: "India", share: 52.7 },
        { code: "US", name: "United States", share: 14.1 },
        { code: "GB", name: "United Kingdom", share: 8.9 },
        { code: "AE", name: "United Arab Emirates", share: 6.8 },
        { code: "CA", name: "Canada", share: 4.4 },
      ],
      languages: [
        { code: "en", name: "English", share: 58.3 },
        { code: "hi", name: "Hindi", share: 36.1 },
        { code: "ta", name: "Tamil", share: 5.6 },
      ],
      ageBands: [
        { band: "18-24", share: 24.8 },
        { band: "25-34", share: 38.2 },
        { band: "35-44", share: 22.6 },
        { band: "45-54", share: 10.1 },
        { band: "55+", share: 4.3 },
      ],
      gender: [
        { label: "Female", share: 63.4 },
        { label: "Male", share: 34.8 },
        { label: "Other", share: 1.8 },
      ],
    },
    titles: [
      "The dal I make when there is nothing in the house",
      "Weeknight biryani, honestly timed",
      "Three chutneys, one blender, no waste",
      "What actually makes a paratha flaky",
      "Slow-cooked greens without the bitterness",
      "A pantry list that survives a month",
    ],
    hashtags: ["homecooking", "regionalfood", "recipes", "weeknight"],
    ai: {
      categories: ["food", "lifestyle"],
      creatorType: "Recipe-led home cook",
      contentThemes: [
        "regional home cooking",
        "pantry economy",
        "technique explainers",
        "meal planning",
      ],
      audienceIntent: "Cook the dish this week; buy the ingredient or tool that makes it easier.",
      commercialIntent: 61,
      brandSafetyScore: 91,
      commentQuality: 68,
      sponsorshipSignals: [
        "Spice-brand integration in 9 of 45 sampled uploads",
        "Affiliate links to cookware in descriptions",
      ],
      recommendedIndustries: [
        "Packaged foods and spices",
        "Cookware",
        "Grocery delivery",
        "Small kitchen appliances",
      ],
      primaryLanguage: "English",
      creatorInterests: ["regional cuisine", "food waste reduction", "kitchen tools", "meal prep"],
      creatorKeywords: ["tadka", "slow-cook", "pantry", "grams", "weeknight"],
      mentionedBrands: ["A regional spice house"],
      mentionedProducts: ["cast-iron tawa", "stainless pressure cooker"],
      brandAffinity: ["Spice and staple brands", "Cookware", "Grocery delivery"],
      competitorAffinity: ["Regional recipe channels", "Meal-planning creators"],
      previousCollaborations: [
        {
          brand: "A cookware retailer",
          evidence: "Affiliate disclosure in the description of a sampled upload.",
          sourceUrl: null,
        },
      ],
      safetyChecks: checks({
        profanity: { level: "low", note: "Occasional mild exclamation in unscripted segments." },
        controversialTopics: {
          level: "low",
          note: "Regional-authenticity debates appear in the comments, not in the uploads.",
        },
      }),
      strengths: [
        "Recipes are written out, so the content keeps earning views",
        "Audience concentrated in one buying market",
        "High comment volume relative to follower count",
      ],
      risks: [
        "Two view spikes trace to cross-posted shorts rather than channel demand",
        "A measurable share of comments is low-substance",
      ],
      evidence: [
        { claim: "Ingredient weights are given in grams", sourceUrl: null, confidence: 0.91 },
        {
          claim: "Affiliate relationships are disclosed in descriptions",
          sourceUrl: null,
          confidence: 0.74,
        },
      ],
    },
  },
  {
    key: "atlasgrain",
    displayName: "Atlas Grain",
    handle: "atlasgrain",
    platform: "instagram",
    categories: ["travel"],
    bio: "Overland routes, film grain, and where to sleep when the plan fails. Carries its own gear.",
    countryCode: "PT",
    countryName: "Portugal",
    languages: ["en", "pt"],
    followers: 892_000,
    weeklyGrowthPct: 0.94,
    medianViews: 246_000,
    variance: 0.45,
    uploadsPerWeek: 3.1,
    likeRate: 0.038,
    commentRate: 0.0027,
    botRisk: 14,
    inactiveAudience: 19,
    snapshotNoisePct: 0.16,
    signalEvidence: [
      {
        signal: "Follower velocity",
        observation: "Growth is monotonic with no step exceeding 1.9x the trailing median.",
        weight: "primary",
      },
      {
        signal: "Commenter account age",
        observation: "87% of sampled commenters hold accounts older than one year.",
        weight: "primary",
      },
      {
        signal: "Saves-to-reach ratio",
        observation: "Saves run at 4.1% of reach, consistent with route-planning intent.",
        weight: "supporting",
      },
    ],
    audience: {
      countries: [
        { code: "US", name: "United States", share: 22.9 },
        { code: "PT", name: "Portugal", share: 15.4 },
        { code: "ES", name: "Spain", share: 12.8 },
        { code: "BR", name: "Brazil", share: 11.2 },
        { code: "FR", name: "France", share: 7.6 },
      ],
      languages: [
        { code: "en", name: "English", share: 61.7 },
        { code: "pt", name: "Portuguese", share: 24.5 },
        { code: "es", name: "Spanish", share: 13.8 },
      ],
      ageBands: [
        { band: "18-24", share: 21.4 },
        { band: "25-34", share: 44.6 },
        { band: "35-44", share: 23.1 },
        { band: "45-54", share: 7.9 },
        { band: "55+", share: 3.0 },
      ],
      gender: [
        { label: "Male", share: 54.2 },
        { label: "Female", share: 43.6 },
        { label: "Other", share: 2.2 },
      ],
    },
    titles: [
      "Three days on the N222 with no reservations",
      "The pack that survived eleven countries",
      "Sleeping in the car, done properly",
      "Film stock for hard light",
      "Border crossings nobody warns you about",
      "What a week of fuel actually costs",
    ],
    hashtags: ["overland", "filmphotography", "roadtrip", "slowtravel"],
    ai: {
      categories: ["travel", "lifestyle"],
      creatorType: "Overland travel documentarian",
      contentThemes: [
        "route planning",
        "gear durability",
        "film photography",
        "budget logistics",
      ],
      audienceIntent: "Plan and equip a self-driven trip in the next few months.",
      commercialIntent: 55,
      brandSafetyScore: 93,
      commentQuality: 76,
      sponsorshipSignals: [
        "Paid partnership label on 7 of 45 sampled posts",
        "Gear brands tagged in-frame",
      ],
      recommendedIndustries: [
        "Outdoor equipment",
        "Automotive accessories",
        "Travel insurance",
        "Camera and film",
      ],
      primaryLanguage: "English",
      creatorInterests: [
        "analogue photography",
        "vehicle preparation",
        "off-season travel",
        "minimal packing",
      ],
      creatorKeywords: ["overland", "route", "film", "packlist", "border"],
      mentionedBrands: ["A roof-rack maker"],
      mentionedProducts: ["35mm rangefinder", "rooftop tent"],
      brandAffinity: ["Outdoor and overland gear", "Camera and film", "Travel insurance"],
      competitorAffinity: ["Overland route channels", "Analogue travel photographers"],
      previousCollaborations: [
        {
          brand: "An outdoor gear label",
          evidence: "Paid partnership label on a sampled post.",
          sourceUrl: null,
        },
      ],
      safetyChecks: checks({
        dangerousContent: {
          level: "low",
          note: "Remote-driving segments show recovery gear and state the conditions.",
        },
      }),
      strengths: [
        "Save rate indicates planning intent, not passive scrolling",
        "Partnerships carry the platform's own paid label",
        "Audience concentrated in two adjacent buying markets",
      ],
      risks: ["Reach depends on seasonal travel interest and dips outside spring"],
      evidence: [
        {
          claim: "Posts carry the platform paid-partnership label where sponsored",
          sourceUrl: null,
          confidence: 0.9,
        },
        { claim: "Route costs are itemised in captions", sourceUrl: null, confidence: 0.81 },
      ],
    },
  },
  {
    key: "verabloom",
    displayName: "Vera Bloom",
    handle: "verabloom",
    platform: "instagram",
    categories: ["beauty"],
    bio: "Formulation-first skincare. Ingredient lists read out loud, percentages named, no miracle claims.",
    countryCode: "GB",
    countryName: "United Kingdom",
    languages: ["en"],
    followers: 210_000,
    weeklyGrowthPct: 2.85,
    medianViews: 74_000,
    variance: 1.05,
    uploadsPerWeek: 4.4,
    likeRate: 0.071,
    commentRate: 0.0038,
    botRisk: 58,
    inactiveAudience: 44,
    snapshotNoisePct: 0.9,
    spikeWeeks: [9, 6, 3],
    signalEvidence: [
      {
        signal: "Follower velocity",
        observation:
          "Four weeks show gains above 5x the trailing median with no matching engagement rise.",
        weight: "primary",
      },
      {
        signal: "Commenter account age",
        observation: "38% of sampled commenters hold accounts older than one year.",
        weight: "primary",
      },
      {
        signal: "Engagement locality",
        observation:
          "Comment-language mix diverges sharply from the stated audience country mix.",
        weight: "primary",
      },
      {
        signal: "Comment repetition",
        observation: "23% of sampled comments repeat one of six generic phrases.",
        weight: "supporting",
      },
    ],
    audience: {
      countries: [
        { code: "GB", name: "United Kingdom", share: 28.3 },
        { code: "US", name: "United States", share: 17.9 },
        { code: "ID", name: "Indonesia", share: 14.6 },
        { code: "BR", name: "Brazil", share: 11.8 },
        { code: "IN", name: "India", share: 9.2 },
      ],
      languages: [
        { code: "en", name: "English", share: 66.4 },
        { code: "id", name: "Indonesian", share: 18.1 },
        { code: "pt", name: "Portuguese", share: 15.5 },
      ],
      ageBands: [
        { band: "18-24", share: 38.7 },
        { band: "25-34", share: 36.4 },
        { band: "35-44", share: 15.2 },
        { band: "45-54", share: 6.9 },
        { band: "55+", share: 2.8 },
      ],
      gender: [
        { label: "Female", share: 81.6 },
        { label: "Male", share: 16.2 },
        { label: "Other", share: 2.2 },
      ],
    },
    titles: [
      "Reading the back of the bottle, properly",
      "What percentage actually does anything",
      "The routine I cut down to four steps",
      "Patch testing nobody has time for",
      "Fragrance-free is not the same as unscented",
      "Three claims that mean nothing",
    ],
    hashtags: ["skincare", "ingredients", "formulation", "routine"],
    ai: {
      categories: ["beauty", "health"],
      creatorType: "Ingredient-led skincare explainer",
      contentThemes: [
        "formulation literacy",
        "claim debunking",
        "routine simplification",
        "sensitive skin",
      ],
      audienceIntent: "Decide whether a specific product is worth buying.",
      commercialIntent: 78,
      brandSafetyScore: 74,
      commentQuality: 41,
      sponsorshipSignals: [
        "Gifted-product disclosure on 14 of 45 sampled posts",
        "Discount codes in bio and captions",
      ],
      recommendedIndustries: ["Skincare", "Dermatology services", "Pharmacy retail"],
      primaryLanguage: "English",
      creatorInterests: [
        "cosmetic chemistry",
        "sensitive skin",
        "regulatory labelling",
        "budget alternatives",
      ],
      creatorKeywords: ["ingredient", "percentage", "barrier", "patch test", "fragrance-free"],
      mentionedBrands: ["A high-street pharmacy label"],
      mentionedProducts: ["niacinamide serum", "ceramide moisturiser"],
      brandAffinity: ["Mass-market skincare", "Pharmacy retail", "Dermatology clinics"],
      competitorAffinity: ["Cosmetic chemistry educators", "Comparison-focused reviewers"],
      previousCollaborations: [
        {
          brand: "A pharmacy skincare label",
          evidence: "Gifted-product disclosure on a sampled post.",
          sourceUrl: null,
        },
      ],
      safetyChecks: checks({
        misinformationSignals: {
          level: "moderate",
          note: "Two sampled posts state efficacy percentages without naming the study, in a health-adjacent context.",
        },
        controversialTopics: {
          level: "moderate",
          note: "Names competitor products as ineffective directly.",
        },
        reputationRisk: {
          level: "moderate",
          note: "Audience-quality signals are weak enough that reach may not convert; a brand should expect scrutiny.",
        },
        adultContent: { level: "low", note: "Skin-exposure shots are clinical and in-context." },
      }),
      strengths: [
        "Names ingredients and percentages rather than making vague claims",
        "Very high like rate on a small audience",
      ],
      risks: [
        "Follower growth repeatedly outruns engagement — the classic purchased-audience shape",
        "Comment substance is low and heavily repeated",
        "Efficacy claims in a health-adjacent category without cited sources",
      ],
      evidence: [
        { claim: "Ingredient percentages are named on camera", sourceUrl: null, confidence: 0.86 },
        { claim: "Gifted products are disclosed", sourceUrl: null, confidence: 0.69 },
        {
          claim: "Efficacy figures appear without a named source",
          sourceUrl: null,
          confidence: 0.77,
        },
      ],
    },
  },
];

/**
 * Lifetime views per follower, anchoring the cumulative view series.
 *
 * Instagram is lower because a feed post accumulates views over days rather
 * than years. Both platforms report the figure: YouTube publicly, Instagram
 * through Insights on an authorized professional account — which is what
 * these two demo creators are, so the tile reads as first-party rather than
 * estimated.
 */
const VIEWS_PER_FOLLOWER: Record<Platform, number> = {
  youtube: 260,
  instagram: 74,
  tiktok: 120,
};

const SNAPSHOT_WEEKS = 14;
const UPLOAD_WEEKS = 46;

function build(blueprint: Blueprint, now: Date) {
  const id = `demo_${blueprint.key}`;
  const accountId = `${id}_${blueprint.platform}`;
  const random = rng(id);
  const nowMs = now.getTime();

  /* Snapshots: weekly, oldest first, compounding backwards from the follower
   * count the profile shows, so the latest reading is the current one. */
  const snapshots: RawSnapshot[] = [];
  for (let week = SNAPSHOT_WEEKS - 1; week >= 0; week -= 1) {
    const at = new Date(nowMs - week * 7 * DAY);
    // Jitter, or every period-on-period delta is identical and the steadiness
    // term in the growth formula measures nothing at all.
    const jitter = week === 0 ? 1 : 1 + ((random() - 0.5) * blueprint.snapshotNoisePct) / 100;
    // A step change with no matching engagement rise: the shape the growth
    // formula is built to catch, and the reason Vera Bloom scores badly on it.
    const spike = blueprint.spikeWeeks?.includes(week) ? 0.94 : 1;
    const decay = Math.pow(1 + blueprint.weeklyGrowthPct / 100, -week);
    const followers = Math.round(blueprint.followers * decay * jitter * spike);
    snapshots.push({
      accountId,
      date: at.toISOString().slice(0, 10),
      followers,
      // Off the trend line, not off the jittered follower count. Lifetime views
      // are a cumulative counter: it can only ever go up, so any noise applied
      // to the level can make the series fall and report a creator as having
      // lost five million views. The follower series is allowed to wobble
      // because followers genuinely do unsubscribe; this one is not.
      views: Math.round(blueprint.followers * decay * VIEWS_PER_FOLLOWER[blueprint.platform]),
      contentCount: Math.round(blueprint.uploadsPerWeek * (UPLOAD_WEEKS - week) + 120),
    });
  }

  const latest = snapshots[snapshots.length - 1];

  /* Uploads spanning about eleven months, so the reach-trend fallback has a
   * window and view consistency has a real spread to measure. */
  const content: RawContent[] = [];
  const uploads = Math.round(blueprint.uploadsPerWeek * UPLOAD_WEEKS);
  for (let index = 0; index < uploads; index += 1) {
    const ageDays = (index / blueprint.uploadsPerWeek) * 7 + random() * 2;
    const publishedAt = new Date(nowMs - ageDays * DAY);
    // Log-normal views: real view counts are heavy-tailed, and a symmetric
    // spread would make every demo creator implausibly predictable.
    const spread = Math.exp((random() + random() + random() - 1.5) * blueprint.variance);
    // Older uploads sit slightly lower, so the trend reads as growth rather
    // than as noise around a flat line.
    const drift = Math.pow(1 + blueprint.weeklyGrowthPct / 100, -ageDays / 7);
    const views = Math.max(500, Math.round(blueprint.medianViews * spread * drift));
    const likes = Math.round(views * blueprint.likeRate * (0.85 + random() * 0.3));
    const comments = Math.round(views * blueprint.commentRate * (0.8 + random() * 0.4));
    const title = blueprint.titles[index % blueprint.titles.length];

    content.push({
      id: `${accountId}_d${String(index).padStart(3, "0")}`,
      accountId,
      influencerId: id,
      platform: blueprint.platform,
      title,
      url:
        blueprint.platform === "youtube"
          ? `https://www.youtube.com/@${blueprint.handle}`
          : `https://www.instagram.com/${blueprint.handle}/`,
      thumbnailUrl: null,
      publishedAt: publishedAt.toISOString(),
      views,
      likes,
      comments,
      shares: blueprint.platform === "instagram" ? Math.round(views * 0.006) : null,
      durationSeconds:
        blueprint.platform === "youtube"
          ? Math.round(480 + random() * 900)
          : Math.round(20 + random() * 70),
      // Disclosed on roughly one upload in six, which is what the AI layer's
      // sponsorship signal for these creators describes.
      isSponsored: index % 6 === 2,
      caption: `${title} — full notes and timestamps in the description.`,
      hashtags: blueprint.hashtags,
      platformCategoryId: blueprint.platform === "youtube" ? "28" : null,
    });
  }

  const influencer: RawInfluencer = {
    id,
    displayName: blueprint.displayName,
    primaryHandle: blueprint.handle,
    avatarUrl: null,
    bio: blueprint.bio,
    status: "published",
    isConnected: true,
    identityMatched: true,
    categories: blueprint.categories,
    countryCode: blueprint.countryCode,
    countryName: blueprint.countryName,
    languages: blueprint.languages,
    primaryPlatform: blueprint.platform,
    isDemo: true,
    createdAt: new Date(nowMs - UPLOAD_WEEKS * 7 * DAY).toISOString(),
    lastRefreshedAt: now.toISOString(),
    conflictCount: 0,
  };

  return {
    id,
    record: {
      influencer,
      accounts: [
        {
          id: accountId,
          influencerId: id,
          platform: blueprint.platform,
          platformAccountId: `${blueprint.platform}-demo-${blueprint.key}`,
          handle: blueprint.handle,
          url:
            blueprint.platform === "youtube"
              ? `https://www.youtube.com/@${blueprint.handle}`
              : `https://www.instagram.com/${blueprint.handle}/`,
          isPrimary: true,
          isConnected: true,
          connectedAt: new Date(nowMs - 40 * DAY).toISOString(),
          needsReauth: false,
          followers: latest.followers,
          totalViews: latest.views,
          contentCount: latest.contentCount,
          lastSyncedAt: now.toISOString(),
          unavailableSince: null,
        },
      ],
      snapshot: latest,
      content,
    },
    snapshots,
    signals: {
      influencerId: id,
      botRisk: blueprint.botRisk,
      inactiveAudience: blueprint.inactiveAudience,
      evidence: blueprint.signalEvidence,
    } satisfies RawAudienceSignals,
    audience: {
      influencerId: id,
      ...blueprint.audience,
      collectedAt: new Date(nowMs - 2 * DAY).toISOString(),
    } satisfies RawAudience,
    ai: {
      influencerId: id,
      ...blueprint.ai,
      provider: "demo",
      model: "hand-authored",
      promptVersion: "demo-1",
      schemaVersion: "2.0.0",
      generatedAt: new Date(nowMs - DAY).toISOString(),
    } satisfies RawAiOutput,
  };
}

export interface DemoReport {
  seeded: { id: string; displayName: string; handle: string; platform: Platform }[];
}

/** Ids of every demonstration record this service manages. */
export function demoIds(): string[] {
  return BLUEPRINTS.map((blueprint) => `demo_${blueprint.key}`);
}

export function seedDemoCreators(now: Date = new Date()): DemoReport {
  // Rebuilt from scratch each time, so a re-seed cannot leave a stale snapshot
  // series behind a shifted date window.
  removeInfluencers(demoIds());

  const built = BLUEPRINTS.map((blueprint) => build(blueprint, now));

  upsertIngested(built.map((item) => item.record));
  upsertSnapshots(built.flatMap((item) => item.snapshots));
  upsertAiOutputs(built.map((item) => item.ai));
  for (const item of built) {
    upsertAudienceData(item.id, item.signals, item.audience);
  }

  return {
    seeded: built.map((item) => ({
      id: item.id,
      displayName: item.record.influencer.displayName,
      handle: item.record.influencer.primaryHandle,
      platform: item.record.influencer.primaryPlatform,
    })),
  };
}

export function removeDemoCreators(): number {
  return removeInfluencers(demoIds());
}
