import { NextResponse, type NextRequest } from "next/server";
import { RequestResetInput } from "@/lib/contracts/auth";
import { handler } from "@/server/auth/rbac";
import { findUserByEmail, issuePasswordToken } from "@/server/repositories/user-repository";
import { sendPasswordResetMail } from "@/server/services/account-mail";
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
      // Not awaited: issuing the token and calling the mail API takes time an
      // unknown address does not, and that difference would be the oracle.
      void deliver(parsed.data.email, request.nextUrl.origin);
    }

    return NextResponse.json({ accepted: true }, { status: 202 });
  });
}

async function deliver(email: string, origin: string): Promise<void> {
  try {
    const user = await findUserByEmail(email);
    if (!user || user.status !== "active") return;
    const token = await issuePasswordToken(user.id, "reset");
    const sent = await sendPasswordResetMail(user.email, token, origin);
    console.info(`[auth] password reset ${sent ? "emailed" : "not sent (mail unconfigured)"}`);
  } catch (error) {
    console.error("[auth] password reset delivery failed", error);
  }
}
