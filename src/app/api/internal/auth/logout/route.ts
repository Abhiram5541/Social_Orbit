import { NextResponse } from "next/server";
import { handler } from "@/server/auth/rbac";
import { clearSessionCookie } from "@/server/auth/session";

/**
 * POST only. A logout reachable by GET can be triggered by any image tag on
 * any page, which is a real (if mild) CSRF nuisance.
 */
export async function POST() {
  return handler(async () => {
    await clearSessionCookie();
    // Relative, so the redirect stays on whatever host the request arrived on.
    // Building it from APP_URL sent every remote user to localhost: correct on
    // the developer's machine, broken over a tunnel, and wrong on any
    // deployment whose public host differs from the configured one.
    return new NextResponse(null, { status: 303, headers: { Location: "/login" } });
  });
}
