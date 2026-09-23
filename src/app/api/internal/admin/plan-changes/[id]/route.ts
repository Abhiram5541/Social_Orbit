import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, handler, requirePermission } from "@/server/auth/rbac";
import { decidePlanChange } from "@/server/services/billing-service";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  return handler(async () => {
    const staff = await requirePermission("admin:orgs");
    const parsed = z
      .object({ decision: z.enum(["approve", "decline"]) })
      .safeParse(await request.json().catch(() => null));
    if (!parsed.success) return errorResponse("validation_failed", "Approve or decline.");
    return NextResponse.json(await decidePlanChange(staff, (await params).id, parsed.data.decision));
  });
}
