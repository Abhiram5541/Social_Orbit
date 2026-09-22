import { NextResponse, type NextRequest } from "next/server";
import { ContractInput } from "@/lib/contracts/deal";
import { ApiFailure, handler, requirePermission } from "@/server/auth/rbac";
import { createContract, listContracts } from "@/server/services/deal-service";

export async function GET(request: NextRequest) {
  return handler(async () => {
    const user = await requirePermission("campaign:read");
    const params = request.nextUrl.searchParams;
    return NextResponse.json({
      items: listContracts(user, {
        campaignId: params.get("campaignId") ?? undefined,
        influencerId: params.get("influencerId") ?? undefined,
      }),
    });
  });
}

export async function POST(request: NextRequest) {
  return handler(async () => {
    const user = await requirePermission("campaign:write");
    const parsed = ContractInput.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new ApiFailure("validation_failed", parsed.error.issues[0].message);
    return NextResponse.json(createContract(user, parsed.data), { status: 201 });
  });
}
