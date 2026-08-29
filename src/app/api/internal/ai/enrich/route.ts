import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { ApiFailure, handler, requirePermission } from "@/server/auth/rbac";
import { AiUnavailable } from "@/server/ai/openai";
import { enrichCreators } from "@/server/services/ai-enrichment-service";

const Body = z.object({
  /** Enrich specific creators, or omit to work through those with no classification. */
  ids: z.array(z.string()).max(100).optional(),
  limit: z.number().int().min(1).max(100).default(25),
  offset: z.number().int().min(0).default(0),
  /** Re-run creators that already carry a classification. */
  refresh: z.boolean().default(false),
});

/**
 * Runs AI classification over stored creators.
 *
 * In the request rather than a worker because there is no queue yet
 * (CLAUDE.md D4), so it is called in batches: each creator is a model call
 * plus a few comment reads, and outputs are committed at the end of the batch
 * so an interrupted run keeps the tokens it already spent.
 */
export async function POST(request: NextRequest) {
  return handler(async () => {
    await requirePermission("admin:ai_config");

    const parsed = Body.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      throw new ApiFailure("validation_failed", parsed.error.issues[0].message);
    }

    try {
      return NextResponse.json(await enrichCreators(parsed.data));
    } catch (error) {
      if (error instanceof AiUnavailable) {
        throw new ApiFailure("connector_unavailable", error.message, { reason: error.reason });
      }
      throw error;
    }
  });
}
