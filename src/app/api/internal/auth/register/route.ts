import { NextResponse, type NextRequest } from "next/server";
import { RegisterInput } from "@/lib/contracts/auth";
import { errorResponse, handler } from "@/server/auth/rbac";
import { findUserByEmail } from "@/server/repositories/user-repository";
import { sendEnquiryMail } from "@/server/services/account-mail";
import { checkRateLimit } from "@/server/services/rate-limit";

/**
 * Registration is accepted and queued for review rather than provisioning a
 * workspace immediately — SENSO grants access to the influencer database,
 * so an account is not self-serve in the way a note-taking app is.
 *
 * The request goes to the sales inbox (EMAIL_REPORT_TO); an admin then
 * creates the account and the invite email carries the set-password link.
 * The password typed here is never stored or sent anywhere.
 */
export async function POST(request: NextRequest) {
  return handler(async () => {
    const key = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
    const limit = checkRateLimit(`register:${key}`, { max: 5, windowMs: 15 * 60_000 });
    if (!limit.allowed) {
      return errorResponse("rate_limited", "Too many attempts. Try again shortly.");
    }

    const parsed = RegisterInput.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      const details: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        (details[String(issue.path[0] ?? "form")] ??= []).push(issue.message);
      }
      return errorResponse("validation_failed", "Check the details and try again.", { details });
    }

    // Same response either way: a distinct "already registered" error would let
    // anyone test which email addresses hold accounts.
    const existing = await findUserByEmail(parsed.data.email);
    if (existing) console.info("[auth] registration for an existing address");
    else {
      const { password: _p, confirmPassword: _c, acceptTerms: _t, ...enquiry } = parsed.data;
      void [_p, _c, _t];
      void sendEnquiryMail(enquiry).then((sent) => {
        if (!sent) console.info("[auth] access request not emailed (EMAIL_REPORT_TO unset)", enquiry.email);
      });
    }

    return NextResponse.json(
      {
        accepted: true,
        redirectTo: "/register/submitted",
      },
      { status: 202 },
    );
  });
}
