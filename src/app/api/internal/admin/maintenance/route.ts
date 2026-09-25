import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { ApiFailure, handler, requirePermission } from "@/server/auth/rbac";
import { backfillPlaceMentions } from "@/server/services/maintenance-service";

/** One-shot backfills over the durable copy. Super admin only. */
export async function POST(request: NextRequest) {
  return handler(async () => {
    await requirePermission("admin:ingestion");
    const parsed = z
      .object({ task: z.enum(["place_mentions"]) })
      .safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new ApiFailure("validation_failed", "Name the task.");
    return NextResponse.json(await backfillPlaceMentions());
  });
}
