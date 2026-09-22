import { NextResponse, type NextRequest } from "next/server";
import { PaymentInput } from "@/lib/contracts/deal";
import { ApiFailure, handler, requirePermission } from "@/server/auth/rbac";
import { campaignSpend, createPayment, listPayments } from "@/server/services/deal-service";

export async function GET(request: NextRequest) {
  return handler(async () => {
    const user = await requirePermission("billing:read");
    const params = request.nextUrl.searchParams;
    const campaignId = params.get("campaignId") ?? undefined;
    return NextResponse.json({
      items: listPayments(user, {
        campaignId,
        influencerId: params.get("influencerId") ?? undefined,
      }),
      spend: campaignId ? campaignSpend(user, campaignId) : null,
    });
  });
}

export async function POST(request: NextRequest) {
  return handler(async () => {
    const user = await requirePermission("billing:write");
    const parsed = PaymentInput.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new ApiFailure("validation_failed", parsed.error.issues[0].message);
    return NextResponse.json(createPayment(user, parsed.data), { status: 201 });
  });
}
