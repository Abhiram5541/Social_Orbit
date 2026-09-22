import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { ApiFailure, handler, requirePermission } from "@/server/auth/rbac";
import { setAttributionOverride } from "@/server/repositories/workspace-repository";

/*
 * Manual attribution. Automatic hashtag detection misses posts — a creator
 * forgets the tag, or puts it in a pinned comment — and matches ones that
 * belong to a different campaign. Both corrections are recorded as overrides
 * so the detection rule and the human judgement stay separable.
 */
const Body = z.object({
  contentId: z.string().trim().min(1),
  action: z.enum(["include", "exclude", "clear"]),
});

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  return handler(async () => {
    const user = await requirePermission("campaign:write");
    const { id } = await params;
    const parsed = Body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new ApiFailure("validation_failed", parsed.error.issues[0].message);
    return NextResponse.json(
      setAttributionOverride(user, id, parsed.data.contentId, parsed.data.action),
    );
  });
}
