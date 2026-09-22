import { NextResponse, type NextRequest } from "next/server";
import { CrmPatch } from "@/lib/contracts/crm";
import { ApiFailure, handler, requirePermission } from "@/server/auth/rbac";
import { getOrCreateCrm, updateCrm } from "@/server/repositories/crm-repository";

type Params = { params: Promise<{ influencerId: string }> };

/** Opening a creator is how a relationship starts, so GET creates the record. */
export async function GET(_request: NextRequest, { params }: Params) {
  return handler(async () => {
    const user = await requirePermission("crm:read");
    const { influencerId } = await params;
    return NextResponse.json(getOrCreateCrm(user, influencerId));
  });
}

export async function PATCH(request: NextRequest, { params }: Params) {
  return handler(async () => {
    const user = await requirePermission("crm:write");
    const { influencerId } = await params;
    const parsed = CrmPatch.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new ApiFailure("validation_failed", parsed.error.issues[0].message);
    return NextResponse.json(updateCrm(user, influencerId, parsed.data));
  });
}
