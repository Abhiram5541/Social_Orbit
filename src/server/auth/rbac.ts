import { NextResponse } from "next/server";
import { redirect } from "next/navigation";
import {
  ROLE_PERMISSIONS,
  ROLE_WORKSPACE,
  type Permission,
  type SessionUser,
} from "@/lib/contracts/auth";
import type { ApiErrorCode } from "@/lib/contracts/common";
import { WORKSPACE_HOME } from "@/lib/navigation";
import { getSession } from "./session";

/* ---------------------------------------------------------------------------
 * Authorization.
 *
 * Every protected route calls into this module. Hiding a button is a courtesy;
 * this is the control. A client that forges a request to an endpoint it has no
 * permission for gets 403 regardless of what the UI showed them.
 * ------------------------------------------------------------------------ */

export function can(user: SessionUser | null, permission: Permission): boolean {
  if (!user) return false;
  return ROLE_PERMISSIONS[user.role].includes(permission);
}

export class AuthorizationError extends Error {
  constructor(
    readonly code: Extract<ApiErrorCode, "unauthenticated" | "forbidden">,
    message: string,
  ) {
    super(message);
    this.name = "AuthorizationError";
  }
}

/** For route handlers. Throws, so the handler wrapper can map it to a response. */
export async function requireSession(): Promise<SessionUser> {
  const user = await getSession();
  if (!user) throw new AuthorizationError("unauthenticated", "Sign in to continue.");
  return user;
}

export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const user = await requireSession();
  if (!can(user, permission)) {
    throw new AuthorizationError(
      "forbidden",
      "Your role does not have access to this resource.",
    );
  }
  return user;
}

/**
 * Tenant isolation. Client-owned resources carry an orgId; platform staff may
 * read across tenants, everyone else is confined to their own org.
 *
 * Called by the repository layer rather than remembered at each call site,
 * because "I forgot the WHERE clause" is how tenant leaks actually happen.
 */
export function assertTenantAccess(user: SessionUser, resourceOrgId: string): void {
  if (user.orgKind === "platform") return;
  if (user.orgId !== resourceOrgId) {
    // Deliberately "not found" rather than "forbidden": confirming a resource
    // exists in another tenant is itself a small information leak.
    throw new AuthorizationError("forbidden", "Resource not found.");
  }
}

/* --- Server component guards -------------------------------------------- */

/** For pages. Redirects rather than throwing, so the user lands somewhere useful. */
export async function requirePageSession(returnTo?: string): Promise<SessionUser> {
  const user = await getSession();
  if (!user) {
    redirect(returnTo ? `/login?next=${encodeURIComponent(returnTo)}` : "/login");
  }
  return user;
}

export async function requirePagePermission(
  permission: Permission,
  returnTo?: string,
): Promise<SessionUser> {
  const user = await requirePageSession(returnTo);
  if (!can(user, permission)) {
    // Send them to their own workspace home rather than a dead end.
    redirect(WORKSPACE_HOME[ROLE_WORKSPACE[user.role]]);
  }
  return user;
}

/* --- Route handler helpers ---------------------------------------------- */

const STATUS: Record<ApiErrorCode, number> = {
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  validation_failed: 422,
  rate_limited: 429,
  quota_exceeded: 402,
  conflict: 409,
  connector_unavailable: 503,
  internal_error: 500,
};

export class ApiFailure extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly extra?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiFailure";
  }
}

export function errorResponse(
  code: ApiErrorCode,
  message: string,
  extra?: Record<string, unknown>,
): NextResponse {
  return NextResponse.json({ error: { code, message, ...extra } }, { status: STATUS[code] });
}

/**
 * Wraps a handler so every failure leaves as the same JSON shape and nothing
 * internal escapes to the client. Unexpected errors are logged with their
 * stack and answered with a generic message.
 */
export function handler<T>(
  fn: () => Promise<NextResponse<T>>,
): Promise<NextResponse<T> | NextResponse> {
  return fn().catch((error: unknown) => {
    if (error instanceof AuthorizationError) {
      return errorResponse(error.code, error.message);
    }
    if (error instanceof ApiFailure) {
      return errorResponse(error.code, error.message, error.extra);
    }
    // A redirect thrown by next/navigation must be allowed through.
    if (error && typeof error === "object" && "digest" in error) throw error;

    console.error("[api] unhandled error", error);
    return errorResponse("internal_error", "Something went wrong. The error has been logged.");
  });
}
