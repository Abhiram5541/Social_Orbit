import { NextResponse, type NextRequest } from "next/server";
import { SubmissionInput } from "@/lib/contracts/campaign-workflow";
import { ApiFailure, handler, requirePermission } from "@/server/auth/rbac";
import { createSubmission, listSubmissions } from "@/server/services/campaign-workflow-service";

export async function GET(request: NextRequest) {
  return handler(async () => {
    const user = await requirePermission("campaign:read");
    const params = request.nextUrl.searchParams;
    return NextResponse.json({
      items: listSubmissions(user, {
        campaignId: params.get("campaignId") ?? undefined,
        influencerId: params.get("influencerId") ?? undefined,
      }),
    });
  });
}

export async function POST(request: NextRequest) {
  return handler(async () => {
    const user = await requirePermission("campaign:write");
    const parsed = SubmissionInput.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new ApiFailure("validation_failed", parsed.error.issues[0].message);
    return NextResponse.json(createSubmission(user, parsed.data), { status: 201 });
  });
}
