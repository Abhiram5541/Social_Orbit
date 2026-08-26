import { NextResponse, type NextRequest } from "next/server";
import { handler, requirePermission } from "@/server/auth/rbac";
import { quickSearch } from "@/server/services/search-service";

/** Type-ahead for the command palette. Navigation, so never metered. */
export async function GET(request: NextRequest) {
  return handler(async () => {
    await requirePermission("influencer:read");
    const term = request.nextUrl.searchParams.get("q") ?? "";
    return NextResponse.json({ items: quickSearch(term) });
  });
}
