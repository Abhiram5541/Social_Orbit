import { z } from "zod";
import { AiUnavailable, extract, openAiKey, openAiModel } from "@/server/ai/openai";
import { ApiFailure } from "@/server/auth/rbac";
import { appRows, persist } from "@/server/data/app-store";
import { readRecords } from "@/server/data/records";
import { contentThumbnail, contentUrl } from "@/server/data/content-media";
import { registerJob, enqueue } from "./job-queue";

/* ---------------------------------------------------------------------------
 * Visual intelligence: what a creator's thumbnails actually show.
 *
 * Everything SENSO knows about a creator's content is currently words —
 * titles, captions, tags. The thumbnail is the part of a post an audience
 * sees first and the part a brand is judged beside, and it has been invisible
 * to the platform until now.
 *
 * The same division of labour as everywhere else applies. A vision model
 * describes one image at a time under a schema; this file counts the
 * descriptions. The model is never asked how *many* thumbnails show a face —
 * only whether this one does — because a count is arithmetic and arithmetic
 * is not a thing to ask a model for.
 *
 * Two deliberate limits:
 *   - Images are passed to the provider by URL, as the platform serves them.
 *     SENSO does not download, store or re-host a creator's artwork.
 *   - A visual brand-safety flag is *evidence*, never a verdict: it names the
 *     thumbnail it came from so a human can look at the same picture. An
 *     unreviewable safety claim about someone's livelihood is worse than no
 *     claim.
 * ------------------------------------------------------------------------ */

export const VISUAL_SCHEMA_VERSION = "1.0.0";
export const VISUAL_PROMPT_VERSION = "1.0.0";

/** Thumbnails read per creator. Each is one image in one model call. */
const THUMBNAILS_PER_CREATOR = 12;
/** Images per call — a batch the model can hold in view at once. */
const BATCH = 4;

export const VisualStyle = z.enum([
  "person_to_camera",
  "product_close_up",
  "text_overlay",
  "scenery",
  "gameplay_or_screen",
  "graphic_or_illustration",
  "other",
]);
export type VisualStyle = z.infer<typeof VisualStyle>;

export const VISUAL_STYLE_LABEL: Record<VisualStyle, string> = {
  person_to_camera: "Person to camera",
  product_close_up: "Product close-up",
  text_overlay: "Heavy text overlay",
  scenery: "Scenery or location",
  gameplay_or_screen: "Gameplay or screen capture",
  graphic_or_illustration: "Graphic or illustration",
  other: "Other",
};

/** What the model may say about one image. Per image, never in aggregate. */
const FrameSchema = z.object({
  index: z.number().int(),
  style: VisualStyle,
  showsFace: z.boolean(),
  showsText: z.boolean(),
  /** Two or three words: "street food", "smartphone", "gym floor". */
  subject: z.string().nullable(),
  /** Plain colour names, as a person would describe the image. */
  dominantColours: z.array(z.string()).max(3),
  /** Named only when actually visible; the caller shows the thumbnail beside it. */
  safetyConcern: z
    .enum(["none", "alcohol", "tobacco", "gambling", "weapons", "revealing", "shock", "other"])
    .default("none"),
});

const BatchSchema = z.object({ frames: z.array(FrameSchema) });

export interface VisualRecord {
  id: string;
  influencerId: string;
  thumbnailsRead: number;
  styles: { style: VisualStyle; count: number }[];
  facesShare: number | null;
  textShare: number | null;
  subjects: { subject: string; count: number }[];
  palette: { colour: string; count: number }[];
  /** Each flag names the post it came from, so it can be looked at. */
  safetyFlags: { concern: string; contentId: string; url: string; thumbnailUrl: string }[];
  /**
   * How consistent the look is: the share of thumbnails in the single most
   * common style. A brand asking "will this fit our grid?" is asking this.
   */
  consistency: number | null;
  provider: string;
  model: string;
  promptVersion: string;
  schemaVersion: string;
  generatedAt: string;
}

const records = () => appRows<VisualRecord>("visual", () => []);

const SYSTEM = [
  "You describe video thumbnails for an influencer marketing platform.",
  "For each numbered image return its index and what is visible in it.",
  "Describe only what you can see. Do not guess who the person is, do not read",
  "intent into the image, and never report a count, a percentage or anything about",
  "images you were not shown.",
  "Name a safety concern only when it is plainly visible in the picture.",
].join(" ");

export function visualFor(influencerId: string): VisualRecord | null {
  return records().find((row) => row.influencerId === influencerId) ?? null;
}

export function visualBlockedReason(): string | null {
  return openAiKey() ? null : "Reading thumbnails needs an AI provider, which is not configured.";
}

export async function analyseThumbnails(influencerId: string): Promise<VisualRecord> {
  const blocked = visualBlockedReason();
  if (blocked) throw new ApiFailure("connector_unavailable", blocked);

  const posts = readRecords()
    .content.filter((item) => item.influencerId === influencerId)
    .filter((item) => contentThumbnail(item) !== null)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .slice(0, THUMBNAILS_PER_CREATOR);

  if (posts.length === 0) {
    throw new ApiFailure("not_found", "This creator has no indexed posts with a thumbnail.");
  }

  const frames: (z.infer<typeof FrameSchema> & { contentId: string })[] = [];
  for (let start = 0; start < posts.length; start += BATCH) {
    const slice = posts.slice(start, start + BATCH);
    const call = await extract(BatchSchema, {
      schemaName: "senso_thumbnail_frames",
      system: SYSTEM,
      user: `Describe each of these ${slice.length} thumbnails. They are numbered from 0 in the order given.`,
      images: slice.map((post) => contentThumbnail(post)!).filter(Boolean),
      maxTokens: 2000,
    });
    for (const frame of call.value.frames) {
      // An index outside the batch describes an image that was not sent, so
      // it is discarded rather than attached to the wrong post.
      const post = slice[frame.index];
      if (!post) continue;
      frames.push({ ...frame, contentId: post.id });
    }
  }

  if (frames.length === 0) {
    throw new ApiFailure("connector_unavailable", "No thumbnail could be read.");
  }

  const tally = <T>(values: T[]): Map<T, number> => {
    const counts = new Map<T, number>();
    for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
    return counts;
  };

  const styles = [...tally(frames.map((frame) => frame.style)).entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([style, count]) => ({ style, count }));

  const subjects = [...tally(frames.map((frame) => frame.subject?.toLowerCase() ?? null)).entries()]
    .filter((entry): entry is [string, number] => entry[0] !== null)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([subject, count]) => ({ subject, count }));

  const palette = [...tally(frames.flatMap((frame) => frame.dominantColours.map((c) => c.toLowerCase()))).entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([colour, count]) => ({ colour, count }));

  const share = (count: number) => Number(((count / frames.length) * 100).toFixed(1));

  const record: VisualRecord = {
    id: influencerId,
    influencerId,
    thumbnailsRead: frames.length,
    styles,
    facesShare: share(frames.filter((frame) => frame.showsFace).length),
    textShare: share(frames.filter((frame) => frame.showsText).length),
    subjects,
    palette,
    safetyFlags: frames
      .filter((frame) => frame.safetyConcern !== "none")
      .map((frame) => {
        const post = posts.find((item) => item.id === frame.contentId)!;
        return {
          concern: frame.safetyConcern,
          contentId: frame.contentId,
          url: contentUrl(post),
          thumbnailUrl: contentThumbnail(post) ?? "",
        };
      }),
    consistency: styles.length === 0 ? null : share(styles[0].count),
    provider: "openai",
    model: openAiModel(),
    promptVersion: VISUAL_PROMPT_VERSION,
    schemaVersion: VISUAL_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
  };

  const existing = records().findIndex((row) => row.id === record.id);
  if (existing >= 0) records()[existing] = record;
  else records().push(record);
  persist("visual", [record]);
  return record;
}

registerJob("visual.creator", async (job) => {
  const record = await analyseThumbnails(String(job.payload.influencerId ?? ""));
  return { thumbnailsRead: record.thumbnailsRead, flags: record.safetyFlags.length };
});

export function queueVisualAnalysis(influencerId: string): string {
  return enqueue("visual.creator", { influencerId }).id;
}

/** Swallows an unavailable provider so a caller can report it as a state. */
export async function tryAnalyseThumbnails(influencerId: string): Promise<VisualRecord | null> {
  try {
    return await analyseThumbnails(influencerId);
  } catch (error) {
    if (error instanceof AiUnavailable) return null;
    throw error;
  }
}
