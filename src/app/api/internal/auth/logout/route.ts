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
    return NextResponse.redirect(
      new URL("/login", process.env.APP_URL ?? "http://localhost:3000"),
      { status: 303 },
    );
  });
}
