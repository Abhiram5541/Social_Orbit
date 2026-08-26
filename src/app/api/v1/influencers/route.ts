import { NextResponse, type NextRequest } from "next/server";
import { SearchQuery } from "@/lib/contracts/search";
import { errorResponse, handler } from "@/server/auth/rbac";
import { authenticateRequest, withApiHeaders } from "@/server/auth/api-auth";
import { allSummaries } from "@/server/repositories/influencer-repository";

/**
 * GET /v1/influencers — DPR §17.1
 *
 * The same filter contract the application uses, so the public API and the
 * product can never disagree about what a filter means.
 */
export async function GET(request: NextRequest) {
  return handler(async () => {
    const auth = await authenticateRequest(request, "influencers:read");
    if (!auth.ok) return auth.response;

    const params = Object.fromEntries(request.nextUrl.searchParams);
    // Accept the documented snake_case spelling alongside the internal names.
    const normalised: Record<string, string> = { ...params };
    const aliases: Record<string, string> = {
      followers_min: "followersMin",
      followers_max: "followersMax",
      engagement_min: "engagementMin",
      median_views_min: "medianViewsMin",
      health_min: "healthMin",
      campaign_fit_min: "campaignFitMin",
      roi_category: "roiCategory",
      page_size: "pageSize",
    };
    for (const [from, to] of Object.entries(aliases)) {
      if (from in normalised) {
        normalised[to] = normalised[from];
        delete normalised[from];
      }
    }
    if (normalised.verified === "true") normalised.verification = "verified";
    delete normalised.verified;

    const parsed = SearchQuery.safeParse(normalised);
    if (!parsed.success) {
      return errorResponse("validation_failed", "One or more query parameters are invalid.", {
        details: Object.fromEntries(
          parsed.error.issues.map((issue) => [String(issue.path[0] ?? "query"), [issue.message]]),
        ),
      });
    }

    const query = parsed.data;
    const all = allSummaries();

    const filtered = all.filter((item) => {
      if (query.q && !`${item.displayName} ${item.primaryHandle}`.toLowerCase().includes(query.q.toLowerCase())) return false;
      if (query.platform?.length && !query.platform.some((p) => item.platforms.includes(p))) return false;
      if (query.category?.length && !query.category.some((c) => item.categories.includes(c))) return false;
      if (query.country?.length && !query.country.includes(item.countryCode ?? "")) return false;
      if (query.language?.length && !query.language.some((l) => item.languages.includes(l))) return false;
      if (query.verification?.length && !query.verification.includes(item.verification)) return false;
      if (query.followersMin !== undefined && (item.followers ?? 0) < query.followersMin) return false;
      if (query.followersMax !== undefined && (item.followers ?? 0) > query.followersMax) return false;
      if (query.engagementMin !== undefined && (item.engagementRate ?? -1) < query.engagementMin) return false;
      if (query.healthMin !== undefined && (item.healthScore ?? -1) < query.healthMin) return false;
      if (query.campaignFitMin !== undefined && (item.campaignFit ?? -1) < query.campaignFitMin) return false;
      return true;
    });

    if (query.sort === "health_score_desc") {
      filtered.sort((a, b) => (b.healthScore ?? -1) - (a.healthScore ?? -1));
    } else if (query.sort === "followers_desc") {
      filtered.sort((a, b) => (b.followers ?? -1) - (a.followers ?? -1));
    } else if (query.sort === "engagement_desc") {
      filtered.sort((a, b) => (b.engagementRate ?? -1) - (a.engagementRate ?? -1));
    }

    const start = (query.page - 1) * query.pageSize;
    const items = filtered.slice(start, start + query.pageSize);

    return withApiHeaders(
      NextResponse.json({
        data: items,
        meta: {
          page: query.page,
          page_size: query.pageSize,
          total: filtered.length,
          total_pages: Math.max(1, Math.ceil(filtered.length / query.pageSize)),
        },
      }),
    );
  });
}
