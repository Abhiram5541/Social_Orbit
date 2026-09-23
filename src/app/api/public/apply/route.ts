import { NextResponse, type NextRequest } from "next/server";
import { ApplicationStartInput } from "@/lib/contracts/onboarding";
import { errorResponse, handler } from "@/server/auth/rbac";
import { startApplication } from "@/server/services/onboarding-service";
import { checkRateLimit } from "@/server/services/rate-limit";

/** Starts an application. Public: an applicant has no account yet. */
export async function POST(request: NextRequest) {
  return handler(async () => {
    const key = request.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
    if (!checkRateLimit(`apply:${key}`, { max: 5, windowMs: 15 * 60_000 }).allowed) {
      return errorResponse("rate_limited", "Too many attempts. Try again shortly.");
    }
    const parsed = ApplicationStartInput.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return errorResponse("validation_failed", parsed.error.issues[0].message);

    const orgId = request.nextUrl.searchParams.get("org");
    const application = startApplication(parsed.data, orgId);
    // The token is the applicant's way back in, so it is returned here and
    // only here.
    return NextResponse.json({ token: application.token, id: application.id }, { status: 201 });
  });
}
