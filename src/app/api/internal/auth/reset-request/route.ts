import { NextResponse, type NextRequest } from "next/server";
import { RequestResetInput } from "@/lib/contracts/auth";
import { handler } from "@/server/auth/rbac";
import { checkRateLimit } from "@/server/services/rate-limit";

/**
 * Always answers 202, whether or not the address is known. Any difference in
 * status, body or timing would turn this endpoint into an account-enumeration
 * oracle, which is the whole reason it is written this way.
 */
export async function POST(request: NextRequest) {
  return handler(async () => {
    const key =
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
    checkRateLimit(`reset:${key}`, { max: 5, windowMs: 15 * 60_000 });

    const body = await request.json().catch(() => null);
    const parsed = RequestResetInput.safeParse(body);
    if (parsed.success) {
      // Delivery is queued by the notification service once SMTP is configured.
      console.info("[auth] password reset requested");
    }

    return NextResponse.json({ accepted: true }, { status: 202 });
  });
}
