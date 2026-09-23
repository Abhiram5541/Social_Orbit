import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { ApiFailure, handler, requirePermission } from "@/server/auth/rbac";
import { forecastCalibration, forecastRoi } from "@/server/services/forecast-service";

const Body = z.object({
  influencerIds: z.array(z.string().min(1)).min(1).max(200),
  plannedPosts: z.number().int().min(1).max(50).default(1),
  rates: z.record(z.string(), z.number().nonnegative()).optional(),
  currency: z.string().length(3).optional(),
});

/** What a roster is likely to deliver, as a band with its evidence. */
export async function POST(request: NextRequest) {
  return handler(async () => {
    await requirePermission("campaign:read");
    const parsed = Body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new ApiFailure("validation_failed", parsed.error.issues[0].message);
    const { influencerIds, ...options } = parsed.data;
    return NextResponse.json(forecastRoi(influencerIds, options));
  });
}

/** How accurate past forecasts turned out to be. */
export async function GET() {
  return handler(async () => {
    const user = await requirePermission("campaign:read");
    return NextResponse.json(forecastCalibration(user));
  });
}
