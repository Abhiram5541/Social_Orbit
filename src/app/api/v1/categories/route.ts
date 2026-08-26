import { NextResponse, type NextRequest } from "next/server";
import { CATEGORY_LABEL, Category, PLATFORM_LABEL, Platform } from "@/lib/contracts/common";
import { handler } from "@/server/auth/rbac";
import { authenticateRequest, withApiHeaders } from "@/server/auth/api-auth";

/** GET /v1/categories — the SocialOrbit taxonomy, plus supported platforms. */
export async function GET(request: NextRequest) {
  return handler(async () => {
    const auth = await authenticateRequest(request, "influencers:read");
    if (!auth.ok) return auth.response;

    return withApiHeaders(
      NextResponse.json({
        data: {
          categories: Category.options.map((id) => ({ id, label: CATEGORY_LABEL[id] })),
          platforms: Platform.options.map((id) => ({
            id,
            label: PLATFORM_LABEL[id],
            connector: id === "tiktok" ? "roadmap" : "available",
          })),
        },
      }),
    );
  });
}
