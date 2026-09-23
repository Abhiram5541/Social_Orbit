import { NextResponse, type NextRequest } from "next/server";
import { handler, requirePermission } from "@/server/auth/rbac";
import { semanticSearch, similarCreators, SEMANTIC_VERSION } from "@/server/analytics/semantic-index";
import { toSummary } from "@/server/repositories/influencer-repository";

/**
 * Meaning-based ranking over the creators' own text. Not metered: it reads
 * the corpus already in memory and spends nothing, and charging for it would
 * make "find me something like this" a decision rather than a reflex.
 */
export async function GET(request: NextRequest) {
  return handler(async () => {
    await requirePermission("influencer:search");
    const params = new URL(request.url).searchParams;
    const limit = Math.min(50, Math.max(1, Number(params.get("limit") ?? 12)));
    const like = params.get("like");
    const q = params.get("q");

    const hits = like ? similarCreators(like, limit) : semanticSearch(q ?? "", limit);
    const items = hits
      .map((hit) => {
        const summary = toSummary(hit.id);
        return summary ? { ...summary, score: Number(hit.score.toFixed(4)), terms: hit.terms } : null;
      })
      .filter((item) => item !== null);

    return NextResponse.json({ items, version: SEMANTIC_VERSION });
  });
}
