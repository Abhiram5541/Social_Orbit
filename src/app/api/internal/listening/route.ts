import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { Platform } from "@/lib/contracts/common";
import { ApiFailure, handler, requirePermission } from "@/server/auth/rbac";
import { listen, shareOfConversation } from "@/server/services/listening-service";

const Body = z.object({
  terms: z.array(z.string().trim().min(2).max(60)).min(1).max(6),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  platforms: z.array(Platform).optional(),
});

export async function POST(request: NextRequest) {
  return handler<unknown>(async () => {
    const user = await requirePermission("influencer:read");
    const parsed = Body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new ApiFailure("validation_failed", parsed.error.issues[0].message);
    const { terms, ...window } = parsed.data;

    if (terms.length === 1) {
      return NextResponse.json(listen(user, { ...window, term: terms[0] }));
    }
    return NextResponse.json(shareOfConversation(user, terms, window));
  });
}
