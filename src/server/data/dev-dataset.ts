import type { Category, Platform } from "@/lib/contracts/common";

/* ---------------------------------------------------------------------------
 * DEVELOPMENT DATASET — see README.md in this directory.
 *
 * Emits raw, platform-shaped observations only. Every analytic, score, band,
 * risk level and confidence figure in the product is computed from these by
 * the real engines at read time.
 * ------------------------------------------------------------------------ */

/** Fixed so generated history is identical in every process and test run. */
export const EPOCH = new Date("2026-08-26T09:00:00.000Z");

/** Deterministic PRNG. Same seed, same dataset, forever. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

const pick = <T>(rng: () => number, list: readonly T[]): T =>
  list[Math.floor(rng() * list.length)];

const between = (rng: () => number, min: number, max: number) => min + rng() * (max - min);

const intBetween = (rng: () => number, min: number, max: number) =>
  Math.floor(between(rng, min, max + 1));

const daysBefore = (days: number, from: Date = EPOCH) =>
  new Date(from.getTime() - days * 86_400_000);

/* --- Raw record shapes -------------------------------------------------- */

export interface RawAccount {
  id: string;
  influencerId: string;
  platform: Platform;
  platformAccountId: string;
  handle: string;
  url: string;
  isPrimary: boolean;
  isConnected: boolean;
  connectedAt: string | null;
  needsReauth: boolean;
  followers: number;
  totalViews: number | null;
  contentCount: number;
  lastSyncedAt: string;
}

export interface RawSnapshot {
  accountId: string;
  date: string;
  followers: number;
  views: number | null;
  contentCount: number;
}

export interface RawContent {
  id: string;
  accountId: string;
  influencerId: string;
  platform: Platform;
  title: string;
  url: string;
  thumbnailUrl: string | null;
  publishedAt: string;
  views: number | null;
  likes: number;
  comments: number;
  shares: number;
  durationSeconds: number | null;
  isSponsored: boolean;
  caption: string;
  hashtags: string[];
}

/**
 * Audience data exists only where a connected professional account authorises
 * it. Unconnected creators legitimately have none, and the UI says so rather
 * than inventing a breakdown.
 */
export interface RawAudience {
  influencerId: string;
  countries: { code: string; name: string; share: number }[];
  languages: { code: string; name: string; share: number }[];
  ageBands: { band: string; share: number }[];
  gender: { label: string; share: number }[];
  collectedAt: string;
}

/** Classifications a model produced. Kept apart from measurements by design. */
export interface RawAiOutput {
  influencerId: string;
  creatorType: string;
  contentThemes: string[];
  audienceIntent: string;
  commercialIntent: number;
  brandSafetyScore: number;
  commentQuality: number;
  sponsorshipSignals: string[];
  recommendedIndustries: string[];
  strengths: string[];
  risks: string[];
  evidence: { claim: string; sourceUrl: string | null; confidence: number }[];
  provider: string;
  model: string;
  promptVersion: string;
  schemaVersion: string;
  generatedAt: string;
}

/** Audience-quality signals a connector/inference step measured. */
export interface RawAudienceSignals {
  influencerId: string;
  botRisk: number;
  inactiveAudience: number;
  evidence: { signal: string; observation: string; weight: "supporting" | "primary" }[];
}

export interface RawInfluencer {
  id: string;
  displayName: string;
  primaryHandle: string;
  avatarUrl: string | null;
  bio: string;
  status: "draft" | "in_review" | "published" | "archived";
  isConnected: boolean;
  identityMatched: boolean;
  categories: Category[];
  countryCode: string;
  countryName: string;
  languages: string[];
  primaryPlatform: Platform;
  createdAt: string;
  lastRefreshedAt: string;
  conflictCount: number;
}

/* --- Source pools ------------------------------------------------------- */

const FIRST = [
  "Aria", "Kabir", "Meera", "Rohan", "Ishita", "Dev", "Nadia", "Arjun", "Leila", "Tanvi",
  "Owen", "Priya", "Marcus", "Sana", "Diego", "Yuki", "Amara", "Felix", "Neha", "Jonas",
  "Clara", "Vikram", "Elena", "Rahul", "Mina", "Theo", "Zoya", "Anders", "Divya", "Luca",
  "Nora", "Aditya", "Farah", "Caleb", "Rhea", "Mateo", "Simran", "Iris", "Karan", "Talia",
] as const;

const LAST = [
  "Chen", "Sharma", "Okafor", "Lindqvist", "Rao", "Mendes", "Haruna", "Kapoor", "Novak",
  "Silva", "Ahmed", "Whitfield", "Iyer", "Duarte", "Kowalski", "Nakamura", "Bello", "Reyes",
  "Fitzgerald", "Menon", "Petrov", "Achebe", "Lund", "Basu", "Moreau", "Vargas",
] as const;

const COUNTRIES = [
  { code: "IN", name: "India", languages: ["en", "hi"] },
  { code: "US", name: "United States", languages: ["en"] },
  { code: "GB", name: "United Kingdom", languages: ["en"] },
  { code: "BR", name: "Brazil", languages: ["pt"] },
  { code: "DE", name: "Germany", languages: ["de", "en"] },
  { code: "AE", name: "United Arab Emirates", languages: ["en", "ar"] },
  { code: "SG", name: "Singapore", languages: ["en"] },
  { code: "ES", name: "Spain", languages: ["es"] },
  { code: "NG", name: "Nigeria", languages: ["en"] },
  { code: "JP", name: "Japan", languages: ["ja", "en"] },
] as const;

const CATEGORIES: Category[] = [
  "technology", "beauty", "fashion", "fitness", "food", "travel", "gaming",
  "finance", "education", "lifestyle", "parenting", "automotive", "health", "business",
];

const THEMES: Record<string, string[]> = {
  technology: ["device reviews", "developer tooling", "AI explainers", "buying guides"],
  beauty: ["skincare routines", "product breakdowns", "ingredient science", "tutorials"],
  fashion: ["styling series", "haul reviews", "sustainable labels", "runway commentary"],
  fitness: ["training programmes", "form breakdowns", "nutrition basics", "recovery"],
  food: ["regional cooking", "restaurant reviews", "meal prep", "technique explainers"],
  travel: ["itineraries", "budget guides", "solo travel", "long-form documentary"],
  gaming: ["reviews", "competitive analysis", "playthroughs", "hardware"],
  finance: ["personal finance", "market commentary", "tax explainers", "product reviews"],
  education: ["exam preparation", "study method", "concept explainers", "career advice"],
  lifestyle: ["home organisation", "daily vlogs", "productivity", "interiors"],
  parenting: ["early years", "school routines", "product safety", "family travel"],
  automotive: ["road tests", "ownership costs", "EV coverage", "maintenance"],
  health: ["preventive care", "sleep", "mental health", "clinical explainers"],
  business: ["operator interviews", "go-to-market", "hiring", "case studies"],
};

const TITLE_SHAPES = [
  "Why {theme} changed how I work",
  "{theme}: what nobody tells you",
  "I tested {theme} for 30 days",
  "The honest guide to {theme}",
  "{theme} — a complete breakdown",
  "5 mistakes people make with {theme}",
  "Answering your questions on {theme}",
  "{theme} in 2026: what actually matters",
] as const;

/* --- Generation --------------------------------------------------------- */

/**
 * One creator's raw record set. A creator's whole shape — size, cadence,
 * audience quality, whether they connected an account — is derived from their
 * seed, so re-running produces the identical profile.
 */
function generateInfluencer(index: number) {
  const id = `inf_${String(index + 1).padStart(4, "0")}`;
  const rng = mulberry32(hashSeed(id));

  const firstName = pick(rng, FIRST);
  const lastName = pick(rng, LAST);
  const displayName = `${firstName} ${lastName}`;
  const country = pick(rng, COUNTRIES);
  const primaryCategory = pick(rng, CATEGORIES);
  const secondaryCategory = pick(rng, CATEGORIES);

  const handle = `${firstName.toLowerCase()}${pick(rng, ["", "_", "."])}${primaryCategory.slice(0, 4)}`;
  const primaryPlatform: Platform = rng() < 0.55 ? "youtube" : "instagram";

  // Size follows a power law — most creators are small, a few are very large.
  const sizeRoll = rng();
  const followers = Math.round(
    sizeRoll < 0.35
      ? between(rng, 8_000, 100_000)
      : sizeRoll < 0.7
        ? between(rng, 100_000, 500_000)
        : sizeRoll < 0.9
          ? between(rng, 500_000, 1_500_000)
          : between(rng, 1_500_000, 6_000_000),
  );

  // Engagement falls as audience grows — the well-documented inverse relation.
  const sizePenalty = Math.log10(followers) / 7;
  const baseEngagement = between(rng, 1.2, 9) * (1.35 - sizePenalty);

  const isConnected = rng() < 0.34;
  const identityMatched = isConnected && rng() < 0.87;
  const cadencePerWeek = between(rng, 0.2, 4.5);
  const audienceQualityRoll = rng();

  const influencer: RawInfluencer = {
    id,
    displayName,
    primaryHandle: handle,
    avatarUrl: null,
    bio: `${THEMES[primaryCategory][0]} and ${THEMES[primaryCategory][1]}. ${country.name}-based.`,
    status: rng() < 0.06 ? "in_review" : "published",
    isConnected,
    identityMatched,
    categories:
      secondaryCategory === primaryCategory
        ? [primaryCategory]
        : [primaryCategory, secondaryCategory],
    countryCode: country.code,
    countryName: country.name,
    languages: [...country.languages],
    primaryPlatform,
    createdAt: daysBefore(intBetween(rng, 200, 900)).toISOString(),
    lastRefreshedAt: daysBefore(between(rng, 0.02, isConnected ? 1.5 : 9)).toISOString(),
    conflictCount: rng() < 0.12 ? intBetween(rng, 1, 3) : 0,
  };

  /* Accounts ------------------------------------------------------------ */
  const platforms: Platform[] = [primaryPlatform];
  if (rng() < 0.55) platforms.push(primaryPlatform === "youtube" ? "instagram" : "youtube");

  const accounts: RawAccount[] = platforms.map((platform, position) => {
    const isPrimary = position === 0;
    const platformFollowers = isPrimary
      ? followers
      : Math.round(followers * between(rng, 0.15, 0.75));
    const contentCount = Math.max(
      12,
      Math.round(cadencePerWeek * between(rng, 60, 190) * (isPrimary ? 1 : 0.6)),
    );

    return {
      id: `${id}_${platform}`,
      influencerId: id,
      platform,
      platformAccountId:
        platform === "youtube"
          ? `UC${hashSeed(`${id}${platform}`).toString(36).padEnd(22, "x").slice(0, 22)}`
          : String(17_000_000_000 + hashSeed(`${id}${platform}`) % 900_000_000),
      handle: platform === "youtube" ? `@${handle}` : handle,
      url:
        platform === "youtube"
          ? `https://www.youtube.com/@${handle}`
          : `https://www.instagram.com/${handle}`,
      isPrimary,
      isConnected: isConnected && (isPrimary || rng() < 0.4),
      connectedAt: isConnected && isPrimary ? daysBefore(intBetween(rng, 20, 300)).toISOString() : null,
      needsReauth: isConnected && isPrimary && rng() < 0.1,
      followers: platformFollowers,
      totalViews:
        platform === "youtube"
          ? Math.round(platformFollowers * between(rng, 30, 160))
          : null,
      contentCount,
      lastSyncedAt: influencer.lastRefreshedAt,
    };
  });

  /* Snapshots ----------------------------------------------------------- */
  // Weekly. History depth varies so the "building history" state is genuinely
  // reachable rather than theoretical.
  const historyWeeks = rng() < 0.15 ? intBetween(rng, 2, 5) : intBetween(rng, 14, 52);
  const weeklyGrowth = between(rng, -0.004, 0.022);
  const volatility = audienceQualityRoll < 0.2 ? between(rng, 0.02, 0.07) : between(rng, 0.002, 0.012);

  const snapshots: RawSnapshot[] = [];
  for (const account of accounts) {
    let value = account.followers / (1 + weeklyGrowth) ** historyWeeks;
    let views = account.totalViews ? account.totalViews * 0.55 : null;

    for (let week = historyWeeks; week >= 0; week -= 1) {
      const shock = (rng() - 0.5) * 2 * volatility;
      value = value * (1 + weeklyGrowth + shock);

      // A minority of accounts show the sawtooth typical of purchased audience.
      if (audienceQualityRoll < 0.12 && week % 7 === 0) value *= 1 + between(rng, 0.06, 0.18);

      if (views !== null) views += (account.totalViews! * 0.45) / (historyWeeks + 1);

      snapshots.push({
        accountId: account.id,
        date: daysBefore(week * 7).toISOString().slice(0, 10),
        followers: Math.max(0, Math.round(value)),
        views: views === null ? null : Math.round(views),
        contentCount: Math.max(
          0,
          Math.round(account.contentCount - (cadencePerWeek * week) / 1),
        ),
      });
    }
  }

  /* Content ------------------------------------------------------------- */
  const themes = THEMES[primaryCategory];
  const content: RawContent[] = [];
  const dormant = rng() < 0.14;
  const gapDays = dormant ? intBetween(rng, 95, 210) : between(rng, 0, 9);

  for (const account of accounts) {
    const sampleSize = Math.min(account.contentCount, intBetween(rng, 22, 48));
    const accountFollowers = account.followers;
    const medianViewRatio = between(rng, 0.06, 0.42);

    for (let i = 0; i < sampleSize; i += 1) {
      const ageDays = gapDays + (i * 7) / Math.max(0.2, cadencePerWeek) + between(rng, -1.5, 1.5);
      const publishedAt = daysBefore(Math.max(0.1, ageDays));

      // Views are lognormal around the creator's own level, with occasional
      // genuine outliers the anomaly detector should find.
      const outlier = rng() < 0.05 ? between(rng, 2.6, 7) : 1;
      const views = Math.round(
        accountFollowers * medianViewRatio * Math.exp(between(rng, -0.55, 0.55)) * outlier,
      );

      const engagement = (baseEngagement / 100) * between(rng, 0.65, 1.45);
      const base = account.platform === "youtube" ? views : accountFollowers;
      const interactions = Math.max(1, Math.round(base * engagement));
      const theme = pick(rng, themes);

      content.push({
        id: `${account.id}_c${String(i).padStart(3, "0")}`,
        accountId: account.id,
        influencerId: id,
        platform: account.platform,
        title: pick(rng, TITLE_SHAPES).replace("{theme}", theme),
        url: `${account.url}/post/${i}`,
        thumbnailUrl: null,
        publishedAt: publishedAt.toISOString(),
        views: account.platform === "youtube" ? views : rng() < 0.7 ? views : null,
        likes: Math.round(interactions * 0.86),
        comments: Math.round(interactions * 0.09),
        shares: Math.round(interactions * 0.05),
        durationSeconds:
          account.platform === "youtube" ? intBetween(rng, 90, 1_800) : intBetween(rng, 15, 90),
        isSponsored: rng() < 0.16,
        caption: `${theme} — full breakdown in the video.`,
        hashtags: [primaryCategory, theme.split(" ")[0]].map((tag) =>
          tag.replace(/[^a-z0-9]/gi, ""),
        ),
      });
    }
  }

  /* Audience-quality signals -------------------------------------------- */
  const botRisk =
    audienceQualityRoll < 0.12
      ? between(rng, 45, 82)
      : audienceQualityRoll < 0.35
        ? between(rng, 18, 45)
        : between(rng, 3, 18);

  const inactiveAudience =
    audienceQualityRoll < 0.2 ? between(rng, 30, 62) : between(rng, 4, 30);

  const signals: RawAudienceSignals = {
    influencerId: id,
    botRisk: Number(botRisk.toFixed(1)),
    inactiveAudience: Number(inactiveAudience.toFixed(1)),
    evidence: [
      {
        signal: "Follower-to-engagement ratio",
        observation: `Median engagement of ${baseEngagement.toFixed(1)}% against ${
          followers > 1_000_000 ? "a mega" : followers > 100_000 ? "a mid-tier" : "a micro"
        } audience.`,
        weight: "primary",
      },
      {
        signal: "Growth continuity",
        observation:
          audienceQualityRoll < 0.12
            ? "Repeated step increases in weekly follower counts outside the account's own baseline."
            : "Weekly follower change stays within the account's established range.",
        weight: audienceQualityRoll < 0.12 ? "primary" : "supporting",
      },
      {
        signal: "Comment-to-like ratio",
        observation: `Comments run at ${(9).toFixed(0)}% of interactions, ${
          botRisk > 40 ? "below" : "in line with"
        } the category cohort.`,
        weight: "supporting",
      },
    ],
  };

  /* Authorized audience data — only where an account is actually connected */
  const audience: RawAudience | null =
    isConnected && identityMatched
      ? {
          influencerId: id,
          countries: normaliseShares([
            { code: country.code, name: country.name, share: between(rng, 38, 72) },
            { code: "US", name: "United States", share: between(rng, 6, 22) },
            { code: "GB", name: "United Kingdom", share: between(rng, 3, 11) },
            { code: "AE", name: "United Arab Emirates", share: between(rng, 2, 8) },
            { code: "CA", name: "Canada", share: between(rng, 2, 7) },
          ]),
          languages: normaliseShares(
            country.languages.map((code, position) => ({
              code,
              name: { en: "English", hi: "Hindi", pt: "Portuguese", de: "German", ar: "Arabic", es: "Spanish", ja: "Japanese" }[code] ?? code,
              share: position === 0 ? between(rng, 55, 85) : between(rng, 10, 40),
            })),
          ),
          ageBands: normaliseShares([
            { band: "13–17", share: between(rng, 1, 6) },
            { band: "18–24", share: between(rng, 18, 40) },
            { band: "25–34", share: between(rng, 26, 45) },
            { band: "35–44", share: between(rng, 10, 24) },
            { band: "45+", share: between(rng, 4, 14) },
          ]),
          gender: normaliseShares([
            { label: "Female", share: between(rng, 25, 72) },
            { label: "Male", share: between(rng, 25, 72) },
            { label: "Not specified", share: between(rng, 1, 5) },
          ]),
          collectedAt: influencer.lastRefreshedAt,
        }
      : null;

  /* AI classification ---------------------------------------------------- */
  const ai: RawAiOutput = {
    influencerId: id,
    creatorType: `${primaryCategory === "technology" ? "High-authority" : "Established"} ${primaryCategory} creator with ${
      botRisk < 20 ? "strong audience trust" : "a mixed audience quality profile"
    }.`,
    contentThemes: themes.slice(0, 3),
    audienceIntent:
      primaryCategory === "finance" || primaryCategory === "technology"
        ? "Research-led; audience arrives with a purchase decision already in progress."
        : "Discovery-led; audience follows for routine and inspiration rather than a specific purchase.",
    commercialIntent: Math.round(between(rng, 35, 92)),
    brandSafetyScore: Math.round(rng() < 0.08 ? between(rng, 42, 68) : between(rng, 72, 97)),
    commentQuality: Math.round(
      botRisk > 40 ? between(rng, 32, 62) : between(rng, 58, 92),
    ),
    sponsorshipSignals: [
      `${Math.round(between(rng, 8, 26))}% of indexed posts carry a paid-partnership marker`,
      rng() < 0.5 ? "Consistent affiliate linking in descriptions" : "Occasional brand integrations",
    ],
    recommendedIndustries: [primaryCategory, secondaryCategory]
      .filter((value, position, list) => list.indexOf(value) === position)
      .map((value) => value.charAt(0).toUpperCase() + value.slice(1)),
    strengths: [
      cadencePerWeek > 1.5 ? "Publishing cadence is above the category median" : "Long-form depth over volume",
      botRisk < 20 ? "Audience-quality signals are clean" : "Engagement concentrated in a core audience",
    ],
    risks: [
      dormant ? "No qualifying publication in over three months" : "Publishing cadence has softened recently",
      botRisk > 40 ? "Follower growth shows step changes outside the account baseline" : "No material risk signals detected",
    ],
    evidence: [
      {
        claim: `Primary category classified as ${primaryCategory}`,
        sourceUrl: accounts[0].url,
        confidence: Number(between(rng, 0.78, 0.97).toFixed(2)),
      },
      {
        claim: `Content language identified as ${country.languages[0]}`,
        sourceUrl: accounts[0].url,
        confidence: Number(between(rng, 0.7, 0.95).toFixed(2)),
      },
    ],
    provider: "openai",
    model: "gpt-5.1",
    promptVersion: "profile-enrichment@3",
    schemaVersion: "profile-intelligence@2",
    generatedAt: daysBefore(between(rng, 0.1, 6)).toISOString(),
  };

  return { influencer, accounts, snapshots, content, signals, audience, ai };
}

function normaliseShares<T extends { share: number }>(items: T[]): T[] {
  const total = items.reduce((sum, item) => sum + item.share, 0);
  return items
    .map((item) => ({ ...item, share: Number(((item.share / total) * 100).toFixed(1)) }))
    .sort((a, b) => b.share - a.share);
}

/* --- Assembled dataset -------------------------------------------------- */

export const DEV_INFLUENCER_COUNT = 84;

function build() {
  const influencers: RawInfluencer[] = [];
  const accounts: RawAccount[] = [];
  const snapshots: RawSnapshot[] = [];
  const content: RawContent[] = [];
  const signals = new Map<string, RawAudienceSignals>();
  const audience = new Map<string, RawAudience>();
  const ai = new Map<string, RawAiOutput>();

  for (let index = 0; index < DEV_INFLUENCER_COUNT; index += 1) {
    const record = generateInfluencer(index);
    influencers.push(record.influencer);
    accounts.push(...record.accounts);
    snapshots.push(...record.snapshots);
    content.push(...record.content);
    signals.set(record.influencer.id, record.signals);
    if (record.audience) audience.set(record.influencer.id, record.audience);
    ai.set(record.influencer.id, record.ai);
  }

  return { influencers, accounts, snapshots, content, signals, audience, ai };
}

// Built once per process. Generation is pure, so this is a cache, not state.
let cache: ReturnType<typeof build> | null = null;

export function devDataset() {
  cache ??= build();
  return cache;
}
