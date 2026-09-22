import { NextResponse, type NextRequest } from "next/server";
import { PaymentActionInput } from "@/lib/contracts/deal";
import { ApiFailure, handler, requirePermission } from "@/server/auth/rbac";
import { actOnPayment } from "@/server/services/deal-service";

type Params = { params: Promise<{ id: string }> };

/** Approve, record as paid, record a failure, or cancel. */
export async function POST(request: NextRequest, { params }: Params) {
  return handler(async () => {
    const user = await requirePermission("billing:write");
    const { id } = await params;
    const parsed = PaymentActionInput.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new ApiFailure("validation_failed", parsed.error.issues[0].message);
    return NextResponse.json(actOnPayment(user, id, parsed.data));
  });
}
