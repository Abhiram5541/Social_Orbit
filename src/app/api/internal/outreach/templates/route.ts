import { NextResponse, type NextRequest } from "next/server";
import { TemplateInput } from "@/lib/contracts/outreach";
import { ApiFailure, handler, requirePermission } from "@/server/auth/rbac";
import { createTemplate, listTemplates } from "@/server/services/outreach-service";

export async function GET() {
  return handler(async () => {
    const user = await requirePermission("crm:read");
    return NextResponse.json({ items: listTemplates(user) });
  });
}

export async function POST(request: NextRequest) {
  return handler(async () => {
    const user = await requirePermission("outreach:send");
    const parsed = TemplateInput.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new ApiFailure("validation_failed", parsed.error.issues[0].message);
    return NextResponse.json(createTemplate(user, parsed.data), { status: 201 });
  });
}
