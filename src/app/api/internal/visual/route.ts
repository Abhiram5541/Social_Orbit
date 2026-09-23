import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { ApiFailure, handler, requirePermission } from "@/server/auth/rbac";
import { analyseThumbnails, visualBlockedReason, visualFor } from "@/server/services/visual-service";

export async function GET(request: NextRequest) {
  return handler<unknown>(async () => {
    await requirePermission("influencer:read");
    const influencerId = new URL(request.url).searchParams.get("influencerId");
    return NextResponse.json({
      record: influencerId ? visualFor(influencerId) : null,
      blocked: visualBlockedReason(),
    });
  });
}

/** Spends model tokens on a dozen images, so it is an explicit action. */
export async function POST(request: NextRequest) {
  return handler(async () => {
    await requirePermission("analytics:read");
    const parsed = z
      .object({ influencerId: z.string().min(1) })
      .safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new ApiFailure("validation_failed", "Name a creator.");
    return NextResponse.json(await analyseThumbnails(parsed.data.influencerId));
  });
}
