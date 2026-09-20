import { NextResponse, type NextRequest } from "next/server";
import { ResetPasswordInput } from "@/lib/contracts/auth";
import { errorResponse, handler } from "@/server/auth/rbac";
import { redeemPasswordToken } from "@/server/repositories/user-repository";
import { checkRateLimit } from "@/server/services/rate-limit";

/**
 * Redeems an emailed reset or invite link. The token is spent on success and
 * a wrong, expired or reused one is refused with one message — the link is
 * the only thing being checked, so there is nothing to enumerate.
 */
export async function POST(request: NextRequest) {
  return handler(async () => {
    const key = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
    const limit = checkRateLimit(`reset-redeem:${key}`, { max: 10, windowMs: 15 * 60_000 });
    if (!limit.allowed) return errorResponse("rate_limited", "Too many attempts. Try again shortly.");

    const parsed = ResetPasswordInput.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      const details: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        (details[String(issue.path[0] ?? "form")] ??= []).push(issue.message);
      }
      return errorResponse("validation_failed", "Check the details and try again.", { details });
    }

    const user = await redeemPasswordToken(parsed.data.token, parsed.data.password);
    if (!user) {
      return errorResponse("validation_failed", "This link is invalid or has expired. Request a new one.");
    }
    console.info(`[auth] password set through emailed link for ${user.id}`);
    return NextResponse.json({ ok: true });
  });
}
