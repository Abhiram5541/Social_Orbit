import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { SearchQuery } from "@/lib/contracts/search";
import { ApiFailure, handler, requirePermission } from "@/server/auth/rbac";
import { parseAsk, refineAsk } from "@/server/services/ask-service";

/**
 * Parses a request into filters and returns them for review. It deliberately
 * does not run the search: the person sees what their sentence became before
 * anything is spent against their allowance.
 */
const Body = z.object({
  text: z.string().trim().min(2, "Say what you are looking for").max(500),
  /** Present when this is a follow-up to a previous answer. */
  previous: SearchQuery.partial().optional(),
});

export async function POST(request: NextRequest) {
  return handler(async () => {
    await requirePermission("influencer:search");
    const parsed = Body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new ApiFailure("validation_failed", parsed.error.issues[0].message);

    const result = parsed.data.previous
      ? refineAsk(parsed.data.previous as SearchQuery, parsed.data.text)
      : parseAsk(parsed.data.text);
    return NextResponse.json(result);
  });
}
