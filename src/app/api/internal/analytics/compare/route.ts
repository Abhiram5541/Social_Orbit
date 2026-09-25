import { NextResponse, type NextRequest } from "next/server";
import { ApiFailure, handler, requirePermission } from "@/server/auth/rbac";
import { topicOverlap, watchlistMovement } from "@/server/services/comparative-service";

/**
 * Two comparisons over watchlists: what they talk about in common, and
 * whether one of them is moving.
 */
export async function GET(request: NextRequest) {
  return handler<unknown>(async () => {
    const user = await requirePermission("influencer:read");
    const params = new URL(request.url).searchParams;
    const a = params.get("a");
    const b = params.get("b");
    const movement = params.get("movement");

    if (movement) {
      const days = Math.min(180, Math.max(7, Number(params.get("days") ?? 30)));
      return NextResponse.json(watchlistMovement(user, movement, days));
    }
    if (!a || !b) throw new ApiFailure("validation_failed", "Name two watchlists, or one to track.");
    return NextResponse.json(
      topicOverlap(user, a, b, {
        from: params.get("from") ?? undefined,
        to: params.get("to") ?? undefined,
      }),
    );
  });
}
