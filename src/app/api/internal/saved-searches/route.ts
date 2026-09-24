import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { SearchQuery } from "@/lib/contracts/search";
import { ApiFailure, handler, requirePermission } from "@/server/auth/rbac";
import {
  deleteSavedSearch,
  listSavedSearches,
  saveSearch,
  touchSavedSearch,
} from "@/server/services/saved-search-service";

export async function GET() {
  return handler(async () => {
    const user = await requirePermission("influencer:search");
    return NextResponse.json({ items: listSavedSearches(user) });
  });
}

const Body = z.object({
  name: z.string().trim().min(2).max(80),
  query: SearchQuery,
  askedAs: z.string().trim().max(500).nullable().default(null),
  results: z.number().int().nullable().default(null),
});

export async function POST(request: NextRequest) {
  return handler(async () => {
    const user = await requirePermission("influencer:search");
    const parsed = Body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new ApiFailure("validation_failed", "Name the search.");
    return NextResponse.json(saveSearch(user, parsed.data), { status: 201 });
  });
}

export async function PATCH(request: NextRequest) {
  return handler(async () => {
    const user = await requirePermission("influencer:search");
    const parsed = z.object({ id: z.string().min(1) }).safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new ApiFailure("validation_failed", "Which search?");
    return NextResponse.json(touchSavedSearch(user, parsed.data.id));
  });
}

export async function DELETE(request: NextRequest) {
  return handler(async () => {
    const user = await requirePermission("influencer:search");
    const id = new URL(request.url).searchParams.get("id");
    if (!id) throw new ApiFailure("validation_failed", "Which search?");
    deleteSavedSearch(user, id);
    return NextResponse.json({ ok: true });
  });
}
