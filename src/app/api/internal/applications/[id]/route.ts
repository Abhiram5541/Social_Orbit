import { NextResponse, type NextRequest } from "next/server";
import { ApplicationDecisionInput } from "@/lib/contracts/onboarding";
import { ApiFailure, handler, requirePermission } from "@/server/auth/rbac";
import { decideApplication } from "@/server/services/onboarding-service";

type Params = { params: Promise<{ id: string }> };

/** Approve, reject or move an application into review. */
export async function POST(request: NextRequest, { params }: Params) {
  return handler(async () => {
    const user = await requirePermission("crm:write");
    const { id } = await params;
    const parsed = ApplicationDecisionInput.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new ApiFailure("validation_failed", parsed.error.issues[0].message);
    return NextResponse.json(decideApplication(user, id, parsed.data));
  });
}
