import { z } from "zod";
import { Category } from "@/lib/contracts/common";
import { extract, type AiCall } from "./openai";

/* ---------------------------------------------------------------------------
 * Creator enrichment — the classification layer, and nothing more.
 *
 * CLAUDE.md §7 draws a hard line and this file is where it is enforced. The
 * model may classify what a creator *is* and judge the quality of material it
 * has been shown. It may not produce a follower count, an engagement rate, a
 * view count, a demographic split, a bot percentage, or any other figure the
 * platform did not observe — so no such field exists in the schema below. A
 * field that cannot be requested cannot be hallucinated into the database.
 *
 * Everything here is scored 0–100 on evidence the caller supplies. Those
 * scores feed the deterministic engine as *component inputs*; they are never a
 * score themselves. The formulas still own the arithmetic (DPR §10).
 * ------------------------------------------------------------------------ */

/** Bumped whenever the schema below changes shape. Stored with every output. */
export const ENRICHMENT_SCHEMA_VERSION = "2.0.0";

/**
 * The thirteen brand-safety dimensions an advertiser asks about.
 *
 * Each is a judgement about content the model was shown, graded by how much of
 * it is present — not a probability, and not a claim about the creator as a
 * person. The accompanying note says what was actually seen, so a rating can be
 * argued with rather than merely trusted.
 */
export const SAFETY_CHECKS = [
  "profanity",
  "hateSpeech",
  "violence",
  "drugs",
  "sexualContent",
  "dangerousContent",
  "extremistContent",
  "gambling",
  "controversialTopics",
  "politicalContent",
  "misinformationSignals",
  "adultContent",
  "reputationRisk",
] as const;

export type SafetyCheckKey = (typeof SAFETY_CHECKS)[number];

export const SafetyLevel = z.enum(["none", "low", "moderate", "high"]);
export type SafetyLevel = z.infer<typeof SafetyLevel>;

const SafetyCheck = z.object({
  level: SafetyLevel,
  note: z
    .string()
    .describe("What was observed, briefly. Empty string when nothing was observed."),
});

const SafetyChecks = z.object(
  Object.fromEntries(SAFETY_CHECKS.map((key) => [key, SafetyCheck])) as Record<
    SafetyCheckKey,
    typeof SafetyCheck
  >,
);
export type SafetyChecks = z.infer<typeof SafetyChecks>;

const Evidence = z.object({
  claim: z.string().describe("A specific statement this enrichment makes."),
  sourceUrl: z
    .string()
    .nullable()
    .describe("A URL from the supplied material that supports the claim, or null."),
  confidence: z.number().min(0).max(1),
});

export const CreatorEnrichment = z.object({
  categories: z
    .array(Category)
    .max(3)
    .describe(
      "Content categories, most representative first, from the supplied list only. " +
        "Empty if the material does not support a confident choice.",
    ),
  creatorType: z
    .string()
    .describe("A short noun phrase for what this creator is, e.g. 'consumer tech reviewer'."),
  contentThemes: z.array(z.string()).max(6).describe("Recurring subjects across the titles."),
  audienceIntent: z
    .string()
    .nullable()
    .describe("Why viewers come to this channel, in one sentence. Null if unclear."),
  commercialIntent: z
    .number()
    .min(0)
    .max(100)
    .describe(
      "How readily this content accommodates a brand partnership, 0-100. " +
        "A judgement about the content, not a prediction of performance.",
    ),
  brandSafetyScore: z
    .number()
    .min(0)
    .max(100)
    .describe("100 is unreservedly safe for a mainstream advertiser; 0 is unusable."),
  commentQuality: z
    .number()
    .min(0)
    .max(100)
    .describe(
      "Quality of the supplied comments as discussion: substance, relevance, " +
        "signs of genuine engagement rather than generic or automated text. " +
        "Judge ONLY the comments provided.",
    ),
  sponsorshipSignals: z
    .array(z.string())
    .max(6)
    .describe("Observable signs of existing brand work in the supplied titles or descriptions."),
  recommendedIndustries: z.array(z.string()).max(6),
  strengths: z.array(z.string()).max(4),
  risks: z.array(z.string()).max(4).describe("Editorial or brand-fit concerns. Not audience fraud."),
  primaryLanguage: z
    .string()
    .nullable()
    .describe("The language the creator publishes in, as an English name. Null if unclear."),
  creatorInterests: z.array(z.string()).max(8).describe("What this creator is evidently into."),
  creatorKeywords: z
    .array(z.string())
    .max(12)
    .describe("Search terms a buyer would plausibly use to find this creator."),
  mentionedBrands: z
    .array(z.string())
    .max(12)
    .describe("Brands named in the supplied titles, descriptions or comments. Named only."),
  mentionedProducts: z.array(z.string()).max(12).describe("Products named in the same material."),
  brandAffinity: z
    .array(z.string())
    .max(8)
    .describe("Brand categories this creator's content sits naturally alongside."),
  competitorAffinity: z
    .array(z.string())
    .max(8)
    .describe("Adjacent categories a competitor of those brands would also consider."),
  previousCollaborations: z
    .array(
      z.object({
        brand: z.string(),
        evidence: z.string().describe("The wording that indicates the commercial relationship."),
        sourceUrl: z.string().nullable(),
      }),
    )
    .max(8)
    .describe(
      "Brand work visible in the supplied material — a disclosure, a sponsor callout, a " +
        "discount code. Never inferred from a product merely appearing.",
    ),
  safetyChecks: SafetyChecks,
  evidence: z.array(Evidence).max(6),
});
export type CreatorEnrichment = z.infer<typeof CreatorEnrichment>;

const SYSTEM = [
  "You classify YouTube creators for a brand-safety and campaign-fit platform.",
  "",
  "You are given observations the platform measured itself. Your job is to interpret",
  "them, never to add to them.",
  "",
  "Absolute rules:",
  "- Never state or estimate a follower count, view count, engagement rate, audience",
  "  demographic, or proportion of inauthentic followers. The platform measures those.",
  "  If asked to judge something you cannot see, score conservatively and say why in",
  "  the evidence rather than inventing a figure.",
  "- Judge comment quality ONLY from the comments supplied. If none are supplied,",
  "  return 50 and record that in the evidence.",
  "- Every score is a judgement about content you were shown, not a prediction.",
  "- Choose categories only from the supplied list. Prefer an empty list over a guess:",
  "  a wrong category places the creator in a cohort they do not belong to and",
  "  corrupts the benchmark medians of everyone who does.",
  "- Cite a supplied URL in evidence wherever one supports the claim.",
  "",
  "Brand safety — grade all thirteen checks:",
  "- `none` means nothing of the kind appeared in the material supplied. That is not a",
  "  guarantee about the channel, and the note should say so where the sample was thin.",
  "- Grade what the content contains, not who the creator is. A documentary about drug",
  "  policy is not a drugs channel; a comedian swearing is profanity, not hate speech.",
  "- reputationRisk covers what an advertiser would be embarrassed to sit beside that the",
  "  other twelve do not already name.",
  "",
  "Brands:",
  "- previousCollaborations requires the material to state a commercial relationship — a",
  "  disclosure, a sponsor callout, a discount code. A product appearing on camera is a",
  "  mention, not a collaboration.",
].join("\n");

export interface EnrichmentInput {
  displayName: string;
  handle: string;
  description: string;
  country: string | null;
  observedCategories: string[];
  /** Titles carry most of the signal about what a channel actually makes. */
  recentTitles: { title: string; url: string; publishedAt: string }[];
  /** Real comments read from the platform. Empty when comments are disabled. */
  comments: { text: string; likes: number | null; replies: number }[];
}

function prompt(input: EnrichmentInput): string {
  const titles = input.recentTitles
    .slice(0, 25)
    .map((item) => `- ${item.title} (${item.url})`)
    .join("\n");

  const comments = input.comments
    .slice(0, 25)
    .map((item) => `- [${item.likes ?? 0} likes, ${item.replies} replies] ${item.text.slice(0, 300)}`)
    .join("\n");

  return [
    `Channel: ${input.displayName} (@${input.handle})`,
    input.country ? `Country: ${input.country}` : "Country: not reported",
    input.observedCategories.length
      ? `Categories YouTube itself assigns: ${input.observedCategories.join(", ")}`
      : "YouTube assigns this channel no topic categories.",
    "",
    "Channel description:",
    input.description.trim() || "(empty)",
    "",
    `Recent upload titles (${input.recentTitles.length}):`,
    titles || "(none)",
    "",
    comments
      ? `Top comments sampled from recent uploads (${input.comments.length}):\n${comments}`
      : "No comments were available — comments may be disabled. Return commentQuality 50 " +
        "and say so in the evidence.",
    "",
    `Allowed categories: ${Category.options.join(", ")}`,
  ].join("\n");
}

export async function enrichCreator(
  input: EnrichmentInput,
): Promise<AiCall<CreatorEnrichment>> {
  return extract(CreatorEnrichment, {
    schemaName: "creator_enrichment",
    system: SYSTEM,
    user: prompt(input),
    // Reasoning models spend budget before emitting; this schema is large.
    maxTokens: 12000,
  });
}
