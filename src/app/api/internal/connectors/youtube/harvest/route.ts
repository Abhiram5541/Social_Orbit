import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { Category } from "@/lib/contracts/common";
import { ApiFailure, handler, requirePermission } from "@/server/auth/rbac";
import { PLANS } from "@/server/services/discovery-plan";
import {
  HARVEST_CATEGORIES,
  backfillViewHistory,
  harvest,
  refreshStored,
} from "@/server/services/harvest-service";

const DiscoveryQuery = z.object({
  q: z.string().trim().min(2).max(120),
  videoCategoryId: z.string().optional(),
  regionCode: z.string().length(2).optional(),
  relevanceLanguage: z.string().min(2).max(8).optional(),
  order: z.enum(["viewCount", "relevance"]).optional(),
  publishedAfter: z.string().datetime().optional(),
});

const Body = z.object({
  /** Omit to sweep every category. */
  categories: z.array(Category).optional(),
  /** The caller's own searches instead of the category plan — 100 units each. */
  queries: z.array(DiscoveryQuery).min(1).max(100).optional(),
  /** A named plan from discovery-plan.ts; `offset`/`limit` pick a slice of it. */
  plan: z.enum(["places", "top"]).optional(),
  target: z.number().int().min(1).max(1000).default(400),
  videos: z.number().int().min(5).max(50).default(50),
  /** Re-read channels already held instead of discovering new ones. */
  refresh: z.boolean().default(false),
  /** Read further back through a channel's uploads, storing a lean series. */
  history: z.boolean().default(false),
  /** Uploads to read per channel when backfilling history. */
  uploads: z.number().int().min(50).max(500).default(200),
  offset: z.number().int().min(0).default(0),
  limit: z.number().int().min(1).max(200).default(100),
});

/**
 * Builds the influencer database from real channels.
 *
 * Runs in the request rather than a worker because there is no queue yet
 * (CLAUDE.md D4). It is called a category at a time for that reason: each call
 * is minutes rather than an hour, and the store is written per category, so an
 * interrupted sweep keeps the quota it already spent.
 */
export async function POST(request: NextRequest) {
  // The three modes return different report shapes, so the handler is widened
  // rather than each branch pretending to be the other.
  return handler<unknown>(async () => {
    await requirePermission("admin:ingestion");

    const parsed = Body.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      throw new ApiFailure("validation_failed", parsed.error.issues[0].message);
    }

    if (parsed.data.history) {
      return NextResponse.json(
        await backfillViewHistory({
          offset: parsed.data.offset,
          limit: parsed.data.limit,
          uploads: parsed.data.uploads,
        }),
      );
    }

    if (parsed.data.refresh) {
      return NextResponse.json(
        await refreshStored({
          offset: parsed.data.offset,
          limit: parsed.data.limit,
          videosPerChannel: parsed.data.videos,
        }),
      );
    }

    const plan = parsed.data.plan ? PLANS[parsed.data.plan] : null;
    const queries = plan
      ? plan.slice(parsed.data.offset, parsed.data.offset + parsed.data.limit)
      : parsed.data.queries;

    const report = await harvest({
      target: parsed.data.target,
      videosPerChannel: parsed.data.videos,
      categories: parsed.data.categories ?? HARVEST_CATEGORIES,
      queries,
    });

    return NextResponse.json({
      ...report,
      ...(plan ? { planRemaining: Math.max(0, plan.length - parsed.data.offset - parsed.data.limit) } : {}),
    });
  });
}
