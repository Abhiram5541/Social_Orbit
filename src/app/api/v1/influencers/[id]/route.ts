import { NextResponse, type NextRequest } from "next/server";
import { errorResponse, handler } from "@/server/auth/rbac";
import { authenticateRequest, withApiHeaders } from "@/server/auth/api-auth";
import { toProfile } from "@/server/repositories/influencer-repository";

/**
 * GET /v1/influencers/{id}
 *
 * Field-level access control (DPR §17.2): authorized audience analytics are
 * first-party creator data and are never exposed through a client API key,
 * regardless of the key's scopes.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return handler(async () => {
    const auth = await authenticateRequest(request, "influencers:read");
    if (!auth.ok) return auth.response;

    const { id } = await params;
    const profile = toProfile(id);
    if (!profile) return errorResponse("not_found", "No influencer with that id.");

    const includeAnalytics = auth.context.principal.scopes.includes("analytics:read");

    return withApiHeaders(
      NextResponse.json({
        data: {
          ...profile,
          audience: {
            available: false,
            reason:
              "Authorized audience analytics are first-party creator data and are not exposed through the API.",
            countries: [],
            languages: [],
            ageBands: [],
            gender: [],
            provenance: null,
          },
          ...(includeAnalytics
            ? {}
            : {
                health: { ...profile.health, components: [] },
                confidenceDetail: undefined,
                benchmarks: null,
              }),
        },
      }),
    );
  });
}
