import { NextResponse, type NextRequest } from "next/server";
import { SignInput } from "@/lib/contracts/deal";
import { errorResponse, handler } from "@/server/auth/rbac";
import { contractByToken, signContract } from "@/server/services/deal-service";
import { checkRateLimit } from "@/server/services/rate-limit";

/*
 * The signer's view. No session: a creator signing a contract has no SENSO
 * account. The token opens one contract and nothing else, and an expired
 * one is shown as expired rather than silently treated as agreed.
 */

type Params = { params: Promise<{ token: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  return handler(async () => {
    const { token } = await params;
    const contract = contractByToken(token);
    if (!contract) return errorResponse("not_found", "This link is not valid.");
    const { signToken: _s, ...rest } = contract;
    void _s;
    return NextResponse.json(rest);
  });
}

export async function POST(request: NextRequest, { params }: Params) {
  return handler(async () => {
    const { token } = await params;
    const limit = checkRateLimit(`sign:${token}`, { max: 10, windowMs: 60_000 });
    if (!limit.allowed) return errorResponse("rate_limited", "Too many attempts.");

    const parsed = SignInput.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return errorResponse("validation_failed", parsed.error.issues[0].message);

    const contract = signContract(token, parsed.data);
    if (!contract) {
      return errorResponse("conflict", "This contract cannot be signed — it may have expired or already been signed.");
    }
    const { signToken: _s, ...rest } = contract;
    void _s;
    return NextResponse.json(rest);
  });
}
