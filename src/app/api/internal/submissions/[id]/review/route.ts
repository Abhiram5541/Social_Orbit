import { NextResponse, type NextRequest } from "next/server";
import { ReviewInput } from "@/lib/contracts/campaign-workflow";
import { ApiFailure, handler, requirePermission } from "@/server/auth/rbac";
import { reviewSubmission } from "@/server/services/campaign-workflow-service";

type Params = { params: Promise<{ id: string }> };

/** Approve, request changes, or mark a draft published. */
export async function POST(request: NextRequest, { params }: Params) {
  return handler(async () => {
    const user = await requirePermission("campaign:write");
    const { id } = await params;
    const parsed = ReviewInput.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new ApiFailure("validation_failed", parsed.error.issues[0].message);
    return NextResponse.json(reviewSubmission(user, id, parsed.data));
  });
}
