import { z } from "zod";
import type { SessionUser } from "@/lib/contracts/auth";
import {
  SENTIMENT_SCHEMA_VERSION,
  SentimentLabel,
  type SentimentRecord,
} from "@/lib/contracts/sentiment";
import { AiUnavailable, extract, openAiKey, openAiModel } from "@/server/ai/openai";
import { ApiFailure, assertTenantAccess } from "@/server/auth/rbac";
import {
  ConnectorUnavailable,
  fetchTopComments,
  youtubeApiKey,
} from "@/server/connectors/youtube/youtube-connector";
import { appRows, persist } from "@/server/data/app-store";
import { readRecords } from "@/server/data/records";
import { getCampaign } from "@/server/repositories/workspace-repository";
import { registerJob, enqueue } from "./job-queue";

/* ---------------------------------------------------------------------------
 * Audience sentiment, from comments the platform published.
 *
 * The division of labour is the point. The connector supplies real comments
 * (1 quota unit a video, no OAuth). The model labels each one it is shown.
 * This file counts the labels. No percentage is ever asked of the model, and
 * a classification of a comment that does not exist cannot be produced,
 * because the schema answers per item in the order it was given.
 *
 * Absent stays absent: with no AI key, no YouTube key, or a subject whose
 * posts have comments disabled, there is no record rather than a neutral
 * score. "We did not measure this" and "the audience feels nothing" are
 * different statements and the product must not conflate them.
 * ------------------------------------------------------------------------ */

export const SENTIMENT_PROMPT_VERSION = "1.0.0";

/** Posts sampled per subject, and comments read from each. */
const POSTS_PER_SUBJECT = 8;
const COMMENTS_PER_POST = 20;
/** A batch small enough that one bad reply costs little to discard. */
const BATCH = 25;

const records = () => appRows<SentimentRecord>("sentiment", () => []);

const Batch = z.object({
  labels: z.array(
    z.object({
      index: z.number().int(),
      label: SentimentLabel,
      topic: z.string().nullable(),
    }),
  ),
});

const SYSTEM = [
  "You label social media comments for a brand safety and audience quality tool.",
  "For each numbered comment return its index, one label, and the topic it is about",
  "in two or three words (or null if it is about nothing in particular).",
  "positive: approval, praise, enthusiasm. negative: criticism, complaint, hostility.",
  "neutral: a question, an observation, or a remark with no opinion.",
  "spam: promotion, a link drop, follow-for-follow, or an unrelated advertisement.",
  "Label only the comments given. Never invent a comment, a count or a percentage.",
].join(" ");

function key(kind: SentimentRecord["subjectKind"], id: string): string {
  return `${kind}:${id}`;
}

export function sentimentFor(
  kind: SentimentRecord["subjectKind"],
  id: string,
): SentimentRecord | null {
  return records().find((row) => row.id === key(kind, id)) ?? null;
}

/** Why a reading cannot be taken right now, in the words a user needs. */
export function sentimentBlockedReason(): string | null {
  if (!youtubeApiKey()) return "Reading comments needs a YouTube API key, which is not configured.";
  if (!openAiKey()) return "Classifying comments needs an AI provider, which is not configured.";
  return null;
}

/** YouTube ids are stored as `${accountId}_${videoId}`; the video id may contain "_". */
function videoIdOf(contentId: string, accountId: string): string | null {
  return contentId.startsWith(`${accountId}_`) ? contentId.slice(accountId.length + 1) : null;
}

async function collectComments(
  posts: { id: string; accountId: string; comments: number | null }[],
): Promise<{ comments: string[]; posts: number }> {
  const texts: string[] = [];
  let read = 0;
  for (const post of posts.filter((item) => (item.comments ?? 0) > 0).slice(0, POSTS_PER_SUBJECT)) {
    const videoId = videoIdOf(post.id, post.accountId);
    if (!videoId) continue;
    try {
      const comments = await fetchTopComments(videoId, COMMENTS_PER_POST);
      if (comments.length > 0) read += 1;
      texts.push(...comments.map((comment) => comment.text));
    } catch (error) {
      // One unreadable video is not a reason to abandon the subject.
      if (error instanceof ConnectorUnavailable) continue;
      throw error;
    }
  }
  return { comments: texts, posts: read };
}

async function classify(
  comments: string[],
): Promise<{ text: string; label: SentimentLabel; topic: string | null }[]> {
  const labelled: { text: string; label: SentimentLabel; topic: string | null }[] = [];

  for (let start = 0; start < comments.length; start += BATCH) {
    const slice = comments.slice(start, start + BATCH);
    const call = await extract(Batch, {
      schemaName: "senso_comment_sentiment",
      system: SYSTEM,
      user: slice.map((text, index) => `${index}. ${text.replace(/\s+/g, " ").slice(0, 400)}`).join("\n"),
      maxTokens: 2000,
    });
    for (const entry of call.value.labels) {
      // An index outside the batch is a reply about a comment that was never
      // shown, so it is dropped rather than attached to the wrong text.
      const text = slice[entry.index];
      if (text === undefined) continue;
      labelled.push({ text, label: entry.label, topic: entry.topic?.trim() || null });
    }
  }
  return labelled;
}

function summarise(
  id: string,
  kind: SentimentRecord["subjectKind"],
  subjectId: string,
  orgId: string | null,
  labelled: { text: string; label: SentimentLabel; topic: string | null }[],
  postsSampled: number,
  model: string,
): SentimentRecord {
  const counts = { positive: 0, neutral: 0, negative: 0, spam: 0 };
  for (const item of labelled) counts[item.label] += 1;

  // Spam and neutral leave the denominator: a comment with no opinion is not
  // a lukewarm endorsement, and counting it as one would flatter every
  // creator whose comments are mostly emoji.
  const opinionated = counts.positive + counts.negative;

  const topicCounts = new Map<string, number>();
  for (const item of labelled) {
    if (!item.topic || item.label === "spam") continue;
    const topic = item.topic.toLowerCase();
    topicCounts.set(topic, (topicCounts.get(topic) ?? 0) + 1);
  }

  const examples: SentimentRecord["examples"] = [];
  for (const label of ["negative", "positive", "neutral", "spam"] as SentimentLabel[]) {
    // Negatives first: they are the reason anybody opens this panel.
    examples.push(...labelled.filter((item) => item.label === label).slice(0, 3));
  }

  return {
    id,
    subjectKind: kind,
    subjectId,
    orgId,
    sampleSize: labelled.length,
    postsSampled,
    counts,
    positiveShare:
      opinionated === 0 ? null : Number(((counts.positive / opinionated) * 100).toFixed(1)),
    topics: [...topicCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([topic, count]) => ({ topic, count })),
    examples: examples.slice(0, 12),
    provider: "openai",
    model,
    promptVersion: SENTIMENT_PROMPT_VERSION,
    schemaVersion: SENTIMENT_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
  };
}

/** Reads and classifies comments for one creator. Costs quota — never on a render. */
export async function analyseCreator(influencerId: string): Promise<SentimentRecord> {
  const blocked = sentimentBlockedReason();
  if (blocked) throw new ApiFailure("connector_unavailable", blocked);

  const data = readRecords();
  const posts = data.content
    .filter((item) => item.influencerId === influencerId && item.platform === "youtube")
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
  if (posts.length === 0) {
    throw new ApiFailure("not_found", "No indexed posts to read comments from.");
  }

  const { comments, posts: postsSampled } = await collectComments(posts);
  if (comments.length === 0) {
    throw new ApiFailure(
      "connector_unavailable",
      "No comments were readable on this creator's recent posts — they may be disabled.",
    );
  }

  const labelled = await classify(comments);
  const record = summarise(
    key("creator", influencerId),
    "creator",
    influencerId,
    null,
    labelled,
    postsSampled,
    openAiModel(),
  );
  upsert(record);
  return record;
}

/** The same reading over the posts a campaign actually attributed. */
export async function analyseCampaign(
  user: SessionUser,
  campaignId: string,
): Promise<SentimentRecord> {
  const blocked = sentimentBlockedReason();
  if (blocked) throw new ApiFailure("connector_unavailable", blocked);

  const campaign = getCampaign(user, campaignId);
  if (!campaign) throw new ApiFailure("not_found", "Campaign not found.");
  if (campaign.attributedContent.length === 0) {
    throw new ApiFailure(
      "validation_failed",
      "Nothing has been attributed to this campaign yet, so there are no comments to read.",
    );
  }

  const data = readRecords();
  const posts = campaign.attributedContent
    .map((item) => data.content.find((row) => row.id === item.id))
    .filter((row): row is NonNullable<typeof row> => row !== undefined && row.platform === "youtube");

  const { comments, posts: postsSampled } = await collectComments(posts);
  if (comments.length === 0) {
    throw new ApiFailure(
      "connector_unavailable",
      "No comments were readable on the attributed posts.",
    );
  }

  const labelled = await classify(comments);
  const record = summarise(
    key("campaign", campaignId),
    "campaign",
    campaignId,
    campaign.orgId,
    labelled,
    postsSampled,
    openAiModel(),
  );
  upsert(record);
  return record;
}

/** A campaign reading belongs to its organisation and is read through it. */
export function campaignSentiment(user: SessionUser, campaignId: string): SentimentRecord | null {
  const record = sentimentFor("campaign", campaignId);
  if (!record) return null;
  if (record.orgId) assertTenantAccess(user, record.orgId);
  return record;
}

function upsert(record: SentimentRecord): void {
  const existing = records().findIndex((row) => row.id === record.id);
  if (existing >= 0) records()[existing] = record;
  else records().push(record);
  persist("sentiment", [record]);
}

/* Queued rather than run inline: a reading is a dozen API calls plus several
 * model calls, which is not something a request should wait on. */
registerJob("sentiment.creator", async (job) => {
  const record = await analyseCreator(String(job.payload.influencerId ?? ""));
  return { sampleSize: record.sampleSize, positiveShare: record.positiveShare };
});

export function queueCreatorSentiment(influencerId: string): string {
  return enqueue("sentiment.creator", { influencerId }).id;
}

/** Swallows AiUnavailable so a caller can report it as a state, not a crash. */
export async function tryAnalyseCreator(influencerId: string): Promise<SentimentRecord | null> {
  try {
    return await analyseCreator(influencerId);
  } catch (error) {
    if (error instanceof AiUnavailable || error instanceof ConnectorUnavailable) return null;
    throw error;
  }
}
