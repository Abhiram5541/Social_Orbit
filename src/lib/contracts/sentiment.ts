import { z } from "zod";

/* ---------------------------------------------------------------------------
 * Audience sentiment.
 *
 * Read from comments the platform actually published, classified one at a
 * time, and counted here. The model never reports a percentage: it labels a
 * comment it was shown, and every figure on the record is arithmetic over
 * those labels. That is the difference between a measurement and a vibe, and
 * it is the same rule the health score is built on.
 *
 * What this is not: it is not the sentiment of "the audience". It is the
 * sentiment of the comments left on a sample of recent posts, which skews
 * positive on every platform, and the record carries its own sample size so
 * nobody has to guess how much to trust it.
 * ------------------------------------------------------------------------ */

export const SENTIMENT_SCHEMA_VERSION = "1.0.0";

export const SentimentLabel = z.enum(["positive", "neutral", "negative", "spam"]);
export type SentimentLabel = z.infer<typeof SentimentLabel>;

export const SENTIMENT_LABEL: Record<SentimentLabel, string> = {
  positive: "Positive",
  neutral: "Neutral",
  negative: "Negative",
  spam: "Spam or promotion",
};

/** One classified comment. The text is kept so a reading can be checked. */
export const ClassifiedComment = z.object({
  text: z.string(),
  label: SentimentLabel,
  /** What the comment is about — "delivery time", "price", "the recipe". */
  topic: z.string().nullable(),
});
export type ClassifiedComment = z.infer<typeof ClassifiedComment>;

export const SentimentRecord = z.object({
  /** `${subjectKind}:${subjectId}` — the row key. */
  id: z.string(),
  subjectKind: z.enum(["creator", "campaign"]),
  subjectId: z.string(),
  /** Set for a campaign reading, so it cannot be read across tenants. */
  orgId: z.string().nullable(),
  sampleSize: z.number().int(),
  postsSampled: z.number().int(),
  counts: z.object({
    positive: z.number().int(),
    neutral: z.number().int(),
    negative: z.number().int(),
    spam: z.number().int(),
  }),
  /**
   * Positive share of the comments that carried an opinion — spam and
   * neutral are excluded from the denominator rather than counted as
   * lukewarm approval. Null when nothing opinionated was found.
   */
  positiveShare: z.number().min(0).max(100).nullable(),
  /** The themes the comments kept returning to, most frequent first. */
  topics: z.array(z.object({ topic: z.string(), count: z.number().int() })).max(10),
  /** A few real comments per label, so the reading can be audited. */
  examples: z.array(ClassifiedComment).max(12),
  provider: z.string(),
  model: z.string(),
  promptVersion: z.string(),
  schemaVersion: z.string(),
  generatedAt: z.string().datetime(),
});
export type SentimentRecord = z.infer<typeof SentimentRecord>;
