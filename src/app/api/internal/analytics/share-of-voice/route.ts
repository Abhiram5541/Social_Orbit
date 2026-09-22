import { NextResponse, type NextRequest } from "next/server";
import { handler, requirePermission } from "@/server/auth/rbac";
import { shareOfVoice } from "@/server/services/comparative-service";

/** Share of voice across the organisation's watchlists over a window. */
export async function GET(request: NextRequest) {
  return handler(async () => {
    const user = await requirePermission("influencer:read");
    const params = request.nextUrl.searchParams;
    const to = params.get("to") ?? new Date().toISOString().slice(0, 10);
    const from =
      params.get("from") ??
      new Date(Date.now() - 90 * 86_400_000).toISOString().slice(0, 10);
    return NextResponse.json(shareOfVoice(user, from, to));
  });
}
