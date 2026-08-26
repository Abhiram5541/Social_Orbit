import { NextResponse } from "next/server";
import { ShortlistInput } from "@/lib/contracts/campaign";
import { errorResponse, handler, requirePermission } from "@/server/auth/rbac";
import { createShortlist, listShortlists } from "@/server/repositories/workspace-repository";

export async function GET() {
  return handler(async () => {
    const user = await requirePermission("shortlist:read");
    return NextResponse.json({ items: listShortlists(user) });
  });
}

export async function POST(request: Request) {
  return handler(async () => {
    const user = await requirePermission("shortlist:write");
    const parsed = ShortlistInput.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return errorResponse("validation_failed", parsed.error.issues[0].message);
    }
    return NextResponse.json(createShortlist(user, parsed.data), { status: 201 });
  });
}
