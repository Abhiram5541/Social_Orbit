import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { DeliverableInput } from "@/lib/contracts/campaign";
import { ApiFailure, handler, requirePermission } from "@/server/auth/rbac";
import { setCampaignDeliverables } from "@/server/repositories/workspace-repository";

/** Replaces the campaign's deliverable requirements in one call. */
const Body = z.object({ deliverables: z.array(DeliverableInput).max(20) });

type Params = { params: Promise<{ id: string }> };

export async function PUT(request: NextRequest, { params }: Params) {
  return handler(async () => {
    const user = await requirePermission("campaign:write");
    const { id } = await params;
    const parsed = Body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new ApiFailure("validation_failed", parsed.error.issues[0].message);
    return NextResponse.json(setCampaignDeliverables(user, id, parsed.data.deliverables));
  });
}
