import type { Category } from "@/lib/contracts/common";
import { AiUnavailable, openAiKey } from "@/server/ai/openai";
import { ENRICHMENT_SCHEMA_VERSION, enrichCreator } from "@/server/ai/enrichment";
import { ConnectorUnavailable, fetchTopComments, youtubeApiKey } from "@/server/connectors/youtube";
import { readRecords, type RawAiOutput } from "@/server/data/records";
import { upsertAiOutputs } from "@/server/data/ingested-store";

/* ---------------------------------------------------------------------------
 * AI enrichment.
 *
 * Reads a creator's stored observations, samples real comments from the
 * platform, asks the model to classify what it has been shown, and stores the
 * result beside — never inside — the measurements.
 *
 * The output feeds the scoring engine as *component inputs*: comment quality
 * and brand safety are two of the nine health components (DPR §10.1), and
 * until this runs both are unmeasurable and the engine renormalises without
 * them. It does not compute or adjust a score. AI explains scores; it never
 * changes them (Arch §6).
 * ------------------------------------------------------------------------ */

/** Videos sampled for comments. Each costs 1 quota unit. */
const COMMENT_SAMPLE_VIDEOS = 3;
const COMMENTS_PER_VIDEO = 12;

export interface EnrichmentOutcome {
  influencerId: string;
  displayName: string;
  ok: boolean;
  detail: string;
  categories?: Category[];
  commentsRead?: number;
  tokens?: number | null;
}

export interface EnrichmentReport {
  enriched: number;
  results: EnrichmentOutcome[];
  totalTokens: number;
  stoppedEarly: string | null;
}

export function aiConfigured(): boolean {
  return openAiKey() !== null;
}

/**
 * Enriches creators that have no classification yet, in id order.
 *
 * Skips anyone already enriched: a second pass costs tokens to learn the same
 * thing, and the observations a classification was made from have not changed.
 * Pass `refresh` to re-run deliberately.
 */
export async function enrichCreators(
  options: { limit?: number; offset?: number; refresh?: boolean; ids?: string[] } = {},
): Promise<EnrichmentReport> {
  const report: EnrichmentReport = {
    enriched: 0,
    results: [],
    totalTokens: 0,
    stoppedEarly: null,
  };

  if (!aiConfigured()) {
    throw new AiUnavailable(
      "credentials_missing",
      "OPENAI_API_KEY is not set. AI enrichment cannot run.",
    );
  }

  const data = readRecords();
  const alreadyEnriched = new Set(data.ai.keys());

  const candidates = (
    options.ids
      ? data.influencers.filter((influencer) => options.ids?.includes(influencer.id))
      : [...data.influencers].sort((a, b) => a.id.localeCompare(b.id))
  )
    .filter((influencer) => options.refresh || !alreadyEnriched.has(influencer.id))
    .slice(options.offset ?? 0, (options.offset ?? 0) + (options.limit ?? 25));

  const outputs: RawAiOutput[] = [];

  for (const influencer of candidates) {
    const content = data.content.filter((item) => item.influencerId === influencer.id);
    const recent = [...content]
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
      .slice(0, 25);

    try {
      const comments = await sampleComments(recent);

      const call = await enrichCreator({
        displayName: influencer.displayName,
        handle: influencer.primaryHandle,
        description: influencer.bio,
        country: influencer.countryName || null,
        observedCategories: influencer.categories,
        recentTitles: recent.map((item) => ({
          title: item.title,
          url: item.url,
          publishedAt: item.publishedAt,
        })),
        comments,
      });

      outputs.push({
        influencerId: influencer.id,
        creatorType: call.value.creatorType,
        contentThemes: call.value.contentThemes,
        audienceIntent: call.value.audienceIntent ?? "",
        commercialIntent: call.value.commercialIntent,
        brandSafetyScore: call.value.brandSafetyScore,
        commentQuality: call.value.commentQuality,
        sponsorshipSignals: call.value.sponsorshipSignals,
        recommendedIndustries: call.value.recommendedIndustries,
        primaryLanguage: call.value.primaryLanguage,
        creatorInterests: call.value.creatorInterests,
        creatorKeywords: call.value.creatorKeywords,
        mentionedBrands: call.value.mentionedBrands,
        mentionedProducts: call.value.mentionedProducts,
        brandAffinity: call.value.brandAffinity,
        competitorAffinity: call.value.competitorAffinity,
        previousCollaborations: call.value.previousCollaborations,
        safetyChecks: call.value.safetyChecks,
        strengths: call.value.strengths,
        risks: call.value.risks,
        categories: call.value.categories,
        evidence: call.value.evidence,
        provider: "openai",
        model: call.model,
        promptVersion: call.promptVersion,
        schemaVersion: ENRICHMENT_SCHEMA_VERSION,
        generatedAt: new Date().toISOString(),
      });

      report.totalTokens += call.totalTokens ?? 0;
      report.results.push({
        influencerId: influencer.id,
        displayName: influencer.displayName,
        ok: true,
        detail: `${call.value.creatorType} — ${call.value.categories.join(", ") || "no category"}`,
        categories: call.value.categories,
        commentsRead: comments.length,
        tokens: call.totalTokens,
      });
    } catch (error) {
      if (error instanceof AiUnavailable) {
        if (error.reason === "credentials_missing" || error.reason === "rate_limited") {
          // Both fail every remaining creator identically. Bank what is done.
          report.stoppedEarly = error.message;
          break;
        }
        report.results.push({
          influencerId: influencer.id,
          displayName: influencer.displayName,
          ok: false,
          detail: error.message,
        });
        continue;
      }
      // Keep what was already classified before rethrowing.
      upsertAiOutputs(outputs);
      report.enriched += outputs.length;
      throw error;
    }
  }

  upsertAiOutputs(outputs);
  report.enriched += outputs.length;
  return report;
}

/**
 * Comments from the most recent uploads that have any.
 *
 * Sampled rather than exhaustive: comment quality is a judgement about tone
 * and substance, and a few dozen comments support that as well as a few
 * thousand while costing a fraction of the quota.
 */
async function sampleComments(
  recent: { id: string; accountId: string; comments: number | null }[],
): Promise<{ text: string; likes: number | null; replies: number }[]> {
  if (!youtubeApiKey()) return [];

  const withComments = recent
    .filter((item) => (item.comments ?? 0) > 0)
    .slice(0, COMMENT_SAMPLE_VIDEOS);
  const collected: { text: string; likes: number | null; replies: number }[] = [];

  for (const item of withComments) {
    // Stored content ids are `<accountId>_<videoId>`, and a YouTube video id
    // may itself contain an underscore — `v-_d2e7x4KA` is a real one. Splitting
    // on the last separator truncates those, so the known prefix is removed
    // instead of a delimiter being guessed at.
    const videoId = item.id.startsWith(`${item.accountId}_`)
      ? item.id.slice(item.accountId.length + 1)
      : null;
    if (!videoId) continue;

    try {
      collected.push(...(await fetchTopComments(videoId, COMMENTS_PER_VIDEO)));
    } catch (error) {
      // A single unreadable video — deleted, private, region-blocked — is not
      // a reason to abandon the creator. Enrich them on fewer comments.
      if (error instanceof ConnectorUnavailable) continue;
      throw error;
    }
  }
  return collected;
}
