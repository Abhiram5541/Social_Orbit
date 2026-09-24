import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiFailure, handler, requirePermission } from "@/server/auth/rbac";
import { addParticipants } from "@/server/repositories/workspace-repository";
import { assertFeature } from "@/server/services/billing-service";

type Params = { params: Promise<{ id: string }> };

/** Adds creators to an existing campaign — from a search result or a shortlist. */
export async function POST(request: Request, { params }: Params) {
  return handler(async () => {
    const user = await requirePermission("campaign:write");
    assertFeature(user, "campaigns");
    const parsed = z
      .object({ influencerIds: z.array(z.string().min(1)).min(1).max(200) })
      .safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new ApiFailure("validation_failed", "Pick at least one creator.");
    return NextResponse.json(await Promise.resolve(addParticipants(user, (await params).id, parsed.data.influencerIds)));
  });
}
