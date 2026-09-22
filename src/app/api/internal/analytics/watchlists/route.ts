import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { ApiFailure, handler, requirePermission } from "@/server/auth/rbac";
import { createWatchlist, listWatchlists } from "@/server/services/comparative-service";

const Body = z.object({
  name: z.string().trim().min(2).max(80),
  kind: z.enum(["own", "competitor", "category"]),
  influencerIds: z.array(z.string().min(1)).max(500).default([]),
  terms: z.array(z.string().trim().min(2).max(40)).max(50).default([]),
});

export async function GET() {
  return handler(async () => {
    const user = await requirePermission("influencer:read");
    return NextResponse.json({ items: listWatchlists(user) });
  });
}

export async function POST(request: NextRequest) {
  return handler(async () => {
    const user = await requirePermission("crm:write");
    const parsed = Body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new ApiFailure("validation_failed", parsed.error.issues[0].message);
    return NextResponse.json(createWatchlist(user, parsed.data), { status: 201 });
  });
}
