import { NextResponse, type NextRequest } from "next/server";
import { RuleInput } from "@/lib/contracts/rules";
import { ApiFailure, handler, requirePermission } from "@/server/auth/rbac";
import { deleteRule, updateRule } from "@/server/services/rules-service";

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  return handler(async () => {
    const user = await requirePermission("crm:write");
    const { id } = await params;
    const parsed = RuleInput.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new ApiFailure("validation_failed", parsed.error.issues[0].message);
    return NextResponse.json(updateRule(user, id, parsed.data));
  });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  return handler(async () => {
    const user = await requirePermission("crm:write");
    const { id } = await params;
    deleteRule(user, id);
    return NextResponse.json({ ok: true });
  });
}
