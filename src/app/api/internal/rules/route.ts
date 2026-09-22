import { NextResponse, type NextRequest } from "next/server";
import { RuleInput, RuleKind } from "@/lib/contracts/rules";
import { ApiFailure, handler, requirePermission } from "@/server/auth/rbac";
import { createRule, listRules } from "@/server/services/rules-service";

export async function GET(request: NextRequest) {
  return handler(async () => {
    const user = await requirePermission("crm:read");
    const kind = RuleKind.safeParse(request.nextUrl.searchParams.get("kind") ?? undefined);
    return NextResponse.json({ items: listRules(user, kind.success ? kind.data : undefined) });
  });
}

export async function POST(request: NextRequest) {
  return handler(async () => {
    const user = await requirePermission("crm:write");
    const parsed = RuleInput.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new ApiFailure("validation_failed", parsed.error.issues[0].message);
    return NextResponse.json(createRule(user, parsed.data), { status: 201 });
  });
}
