import { NextResponse, type NextRequest } from "next/server";
import { handler, requirePermission } from "@/server/auth/rbac";
import { campaignBenchmark } from "@/server/services/comparative-service";

type Params = { params: Promise<{ id: string }> };

/** This campaign against the organisation's own completed campaigns. */
export async function GET(_request: NextRequest, { params }: Params) {
  return handler(async () => {
    const user = await requirePermission("campaign:read");
    const { id } = await params;
    return NextResponse.json(campaignBenchmark(user, id));
  });
}
