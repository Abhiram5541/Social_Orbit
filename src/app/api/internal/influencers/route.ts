import { NextResponse, type NextRequest } from "next/server";
import { SearchQuery } from "@/lib/contracts/search";
import { errorResponse, handler, requirePermission } from "@/server/auth/rbac";
import { searchInfluencers } from "@/server/services/search-service";

export async function GET(request: NextRequest) {
  return handler(async () => {
    const user = await requirePermission("influencer:search");

    const parsed = SearchQuery.safeParse(
      Object.fromEntries(request.nextUrl.searchParams),
    );
    if (!parsed.success) {
      return errorResponse("validation_failed", "Those search filters are not valid.");
    }

    // The client tells us which search it was already showing so paging and
    // re-sorting are not charged again. It cannot use this to avoid the first
    // charge: an unrecognised signature simply meters normally.
    const previousSignature =
      request.nextUrl.searchParams.get("_sig") ?? undefined;

    const result = await searchInfluencers(user, parsed.data, { previousSignature });
    return NextResponse.json(result);
  });
}
