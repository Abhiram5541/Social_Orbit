import { NextResponse, type NextRequest } from "next/server";
import { ProposalInput } from "@/lib/contracts/campaign-workflow";
import { ApiFailure, handler, requirePermission } from "@/server/auth/rbac";
import { createProposal, listProposals } from "@/server/services/campaign-workflow-service";

export async function GET(request: NextRequest) {
  return handler(async () => {
    const user = await requirePermission("campaign:read");
    const campaignId = request.nextUrl.searchParams.get("campaignId") ?? undefined;
    return NextResponse.json({ items: listProposals(user, campaignId) });
  });
}

export async function POST(request: NextRequest) {
  return handler(async () => {
    const user = await requirePermission("campaign:write");
    const parsed = ProposalInput.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new ApiFailure("validation_failed", parsed.error.issues[0].message);
    return NextResponse.json(createProposal(user, parsed.data), { status: 201 });
  });
}
