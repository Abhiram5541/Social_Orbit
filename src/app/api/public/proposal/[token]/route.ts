import { NextResponse, type NextRequest } from "next/server";
import { ProposalDecisionInput } from "@/lib/contracts/campaign-workflow";
import { errorResponse, handler } from "@/server/auth/rbac";
import { decideProposalLine, proposalByToken } from "@/server/services/campaign-workflow-service";
import { checkRateLimit } from "@/server/services/rate-limit";

/*
 * The client-facing proposal. Reached by an unguessable token and no session:
 * the recipient is a brand contact who has no SENSO account. The token grants
 * this one proposal — it cannot list campaigns, read creators or reach
 * anything else — and stops working on the expiry date its author set.
 *
 * Rate limited by token so a leaked link cannot be brute-forced into a
 * decision on every creator at once.
 */

type Params = { params: Promise<{ token: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  return handler(async () => {
    const { token } = await params;
    const proposal = proposalByToken(token);
    if (!proposal) return errorResponse("not_found", "This link has expired or is not valid.");
    // The token itself never travels back out in the body.
    const { token: _t, ...rest } = proposal;
    void _t;
    return NextResponse.json(rest);
  });
}

export async function POST(request: NextRequest, { params }: Params) {
  return handler(async () => {
    const { token } = await params;
    const limit = checkRateLimit(`proposal:${token}`, { max: 60, windowMs: 60_000 });
    if (!limit.allowed) return errorResponse("rate_limited", "Too many changes. Wait a moment.");

    const parsed = ProposalDecisionInput.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return errorResponse("validation_failed", parsed.error.issues[0].message);

    const proposal = decideProposalLine(token, parsed.data);
    if (!proposal) return errorResponse("not_found", "This link has expired or is not valid.");
    const { token: _t, ...rest } = proposal;
    void _t;
    return NextResponse.json(rest);
  });
}
