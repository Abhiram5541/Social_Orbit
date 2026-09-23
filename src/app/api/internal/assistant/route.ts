import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { SearchQuery } from "@/lib/contracts/search";
import { ApiFailure, handler, requirePermission } from "@/server/auth/rbac";
import { askAssistant } from "@/server/services/assistant-service";

/**
 * Runs the search, unlike /ask which only parses. It therefore spends one of
 * the organisation's metered searches, and the response says so.
 */
const Body = z.object({
  text: z.string().trim().min(2, "Ask a question").max(500),
  previous: SearchQuery.partial().optional(),
  limit: z.number().int().min(1).max(25).optional(),
});

export async function POST(request: NextRequest) {
  return handler(async () => {
    const user = await requirePermission("influencer:search");
    const parsed = Body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new ApiFailure("validation_failed", parsed.error.issues[0].message);
    return NextResponse.json(
      await askAssistant(user, parsed.data.text, {
        previous: parsed.data.previous as SearchQuery | undefined,
        limit: parsed.data.limit,
      }),
    );
  });
}
