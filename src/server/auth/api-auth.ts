import { NextResponse, type NextRequest } from "next/server";
import type { Plan } from "@/lib/contracts/auth";
import { errorResponse } from "@/server/auth/rbac";
import {
  authenticateApiKey,
  planLimits,
  type ApiKeyPrincipal,
  type ApiScope,
} from "@/server/repositories/api-key-repository";
import { findOrg } from "@/server/repositories/user-repository";
import { checkRateLimit } from "@/server/services/rate-limit";
import { getUsage, incrementUsage } from "@/server/repositories/usage-repository";

/* ---------------------------------------------------------------------------
 * External API authentication — DPR §17.
 *
 * Session cookies are deliberately NOT accepted here. A browser session and an
 * API key have different revocation, rate-limit and audit stories, and letting
 * a cookie authenticate /v1 would make the public API CSRF-reachable.
 * ------------------------------------------------------------------------ */

const ORG_PLANS = new Map<string, Plan>();

async function planOf(orgId: string): Promise<Plan> {
  const cached = ORG_PLANS.get(orgId);
  if (cached) return cached;
  const org = await findOrg(orgId);
  const plan = org?.plan ?? "free";
  ORG_PLANS.set(orgId, plan);
  return plan;
}

export interface ApiContext {
  principal: ApiKeyPrincipal;
}

/**
 * Authenticates, authorises the scope, enforces the per-plan rate limit and
 * meters the request. Returns either a context or the response to send back.
 */
export async function authenticateRequest(
  request: NextRequest,
  scope: ApiScope,
): Promise<{ ok: true; context: ApiContext } | { ok: false; response: NextResponse }> {
  const header = request.headers.get("authorization");
  const raw = header?.toLowerCase().startsWith("bearer ")
    ? header.slice(7).trim()
    : request.headers.get("x-api-key");

  if (!raw) {
    return {
      ok: false,
      response: errorResponse(
        "unauthenticated",
        "Provide an API key as `Authorization: Bearer so_live_…`.",
      ),
    };
  }

  // The plan lookup is async, so resolve orgs eagerly and pass a sync accessor.
  const principal = authenticateApiKey(raw, (orgId) => ORG_PLANS.get(orgId) ?? "free");
  if (!principal) {
    return { ok: false, response: errorResponse("unauthenticated", "Invalid or revoked API key.") };
  }

  principal.plan = await planOf(principal.orgId);
  const limits = planLimits(principal.plan);

  if (!limits.apiEnabled) {
    return {
      ok: false,
      response: errorResponse(
        "forbidden",
        "The API is not included in this organisation's plan.",
      ),
    };
  }

  if (!principal.scopes.includes(scope)) {
    return {
      ok: false,
      response: errorResponse(
        "forbidden",
        `This key does not hold the \`${scope}\` scope.`,
      ),
    };
  }

  // Burst limit per key, then the monthly plan quota.
  const burst = checkRateLimit(`api:${principal.keyId}`, { max: 120, windowMs: 60_000 });
  if (!burst.allowed) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: {
            code: "rate_limited",
            message: "Rate limit exceeded: 120 requests per minute per key.",
          },
        },
        {
          status: 429,
          headers: { "retry-after": String(Math.ceil(burst.retryAfterMs / 1000)) },
        },
      ),
    };
  }

  if (limits.requestsPerMonth !== null) {
    const used = getUsage(principal.orgId, "api_request");
    if (used >= limits.requestsPerMonth) {
      return {
        ok: false,
        response: errorResponse(
          "quota_exceeded",
          `Monthly API quota of ${limits.requestsPerMonth} requests reached.`,
        ),
      };
    }
  }

  incrementUsage(principal.orgId, "api_request");
  return { ok: true, context: { principal } };
}

/** Adds the headers every /v1 response carries. */
export function withApiHeaders(response: NextResponse, version = "1"): NextResponse {
  response.headers.set("x-socialorbit-api-version", version);
  response.headers.set("cache-control", "private, max-age=60");
  return response;
}
