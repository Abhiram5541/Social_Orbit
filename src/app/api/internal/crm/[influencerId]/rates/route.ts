import { NextResponse, type NextRequest } from "next/server";
import { handler, requirePermission } from "@/server/auth/rbac";
import { toProfile } from "@/server/repositories/influencer-repository";
import { rateIntelligence } from "@/server/services/rate-service";

type Params = { params: Promise<{ influencerId: string }> };

/**
 * What this organisation has agreed with a creator, and what comparable
 * creators in its own book cost. Rates never cross a tenant boundary.
 */
export async function GET(_request: NextRequest, { params }: Params) {
  return handler(async () => {
    const user = await requirePermission("crm:read");
    const { influencerId } = await params;
    const profile = toProfile(influencerId);
    return NextResponse.json(
      rateIntelligence(user, influencerId, profile?.glance.estimatedMonthlyEarnings ?? null),
    );
  });
}
