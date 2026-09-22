import { NextResponse, type NextRequest } from "next/server";
import { InteractionInput } from "@/lib/contracts/crm";
import { ApiFailure, handler, requirePermission } from "@/server/auth/rbac";
import { addInteraction } from "@/server/repositories/crm-repository";

type Params = { params: Promise<{ influencerId: string }> };

/** Appends an event to the relationship timeline. Nothing is ever rewritten. */
export async function POST(request: NextRequest, { params }: Params) {
  return handler(async () => {
    const user = await requirePermission("crm:write");
    const { influencerId } = await params;
    const parsed = InteractionInput.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new ApiFailure("validation_failed", parsed.error.issues[0].message);
    return NextResponse.json(addInteraction(user, influencerId, parsed.data), { status: 201 });
  });
}
