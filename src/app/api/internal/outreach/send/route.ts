import { NextResponse, type NextRequest } from "next/server";
import { SendInput } from "@/lib/contracts/outreach";
import { ApiFailure, handler, requirePermission } from "@/server/auth/rbac";
import { sendOutreach } from "@/server/services/outreach-service";
import { checkRateLimit } from "@/server/services/rate-limit";

/**
 * Individual and bulk outreach. Rate limited per organisation: a bug in a
 * caller should cost one batch, not a domain reputation.
 */
export async function POST(request: NextRequest) {
  return handler(async () => {
    const user = await requirePermission("outreach:send");
    const limit = checkRateLimit(`outreach:${user.orgId}`, { max: 10, windowMs: 60_000 });
    if (!limit.allowed) {
      throw new ApiFailure("rate_limited", "Too many sends in a minute. Wait and try again.");
    }
    const parsed = SendInput.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new ApiFailure("validation_failed", parsed.error.issues[0].message);
    return NextResponse.json(await sendOutreach(user, parsed.data));
  });
}
