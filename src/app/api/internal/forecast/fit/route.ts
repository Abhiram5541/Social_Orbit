import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { ApiFailure, handler, requirePermission } from "@/server/auth/rbac";
import { campaignFit2 } from "@/server/services/forecast-service";

const Body = z.object({
  influencerIds: z.array(z.string().min(1)).min(1).max(100),
  categories: z.array(z.string()).max(16).optional(),
  countries: z.array(z.string().length(2)).max(16).optional(),
  maxRate: z.number().positive().optional(),
});

/** Campaign Fit 2.0 for a roster, each component with its evidence. */
export async function POST(request: NextRequest) {
  return handler(async () => {
    const user = await requirePermission("campaign:read");
    const parsed = Body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new ApiFailure("validation_failed", parsed.error.issues[0].message);
    const { influencerIds, ...brief } = parsed.data;
    return NextResponse.json({
      items: influencerIds.map((id) => campaignFit2(user, id, brief)),
    });
  });
}
