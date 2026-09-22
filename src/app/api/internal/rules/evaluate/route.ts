import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { ApiFailure, handler, requirePermission } from "@/server/auth/rbac";
import { evaluateCreator, evaluateMany } from "@/server/services/rules-service";

/** Evaluates one creator or a roster against this organisation's rules. */
const Body = z.object({ influencerIds: z.array(z.string().min(1)).min(1).max(200) });

export async function POST(request: NextRequest) {
  return handler(async () => {
    const user = await requirePermission("influencer:read");
    const parsed = Body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new ApiFailure("validation_failed", parsed.error.issues[0].message);
    const ids = parsed.data.influencerIds;
    return NextResponse.json(
      ids.length === 1
        ? { reports: { [ids[0]]: evaluateCreator(user, ids[0]) } }
        : { reports: evaluateMany(user, ids) },
    );
  });
}
