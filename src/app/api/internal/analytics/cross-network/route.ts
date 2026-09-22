import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { ApiFailure, handler, requirePermission } from "@/server/auth/rbac";
import { crossNetwork } from "@/server/services/comparative-service";

const Body = z.object({
  influencerIds: z.array(z.string().min(1)).min(1).max(1000),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
});

/** One roster read per network, with nothing averaged across them. */
export async function POST(request: NextRequest) {
  return handler(async () => {
    await requirePermission("influencer:read");
    const parsed = Body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new ApiFailure("validation_failed", parsed.error.issues[0].message);
    const to = parsed.data.to ?? new Date().toISOString().slice(0, 10);
    const from =
      parsed.data.from ?? new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);
    return NextResponse.json(crossNetwork(parsed.data.influencerIds, from, to));
  });
}
