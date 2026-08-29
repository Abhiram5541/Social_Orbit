import { NextResponse } from "next/server";
import { ApiFailure, handler, requirePermission } from "@/server/auth/rbac";
import { ConnectorUnavailable } from "@/server/connectors/youtube";
import {
  IngestionRefused,
  RefreshTooSoon,
  refreshInfluencer,
} from "@/server/services/ingestion-service";

/**
 * Re-reads one creator from the platform on request.
 *
 * `influencer:read`, not `influencer:write`: a client asking for current
 * figures is exercising the read they already hold, not editing the record.
 * What stops that being abused is the per-creator cooldown in the service —
 * the database is global, so refreshes are pooled across every client rather
 * than granted per seat.
 *
 * Not metered against the free-plan search allowance either. Refusing to show
 * a client whether their own shortlisted creator has moved would be a strange
 * thing to charge for.
 */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  return handler(async () => {
    await requirePermission("influencer:read");
    const { id } = await context.params;

    try {
      return NextResponse.json(await refreshInfluencer(id));
    } catch (error) {
      if (error instanceof RefreshTooSoon) {
        throw new ApiFailure("rate_limited", error.message, {
          retryAfterMs: error.retryAfterMs,
          lastRefreshedAt: error.lastRefreshedAt,
        });
      }
      if (error instanceof IngestionRefused) {
        throw new ApiFailure(error.code === "not_found" ? "not_found" : "conflict", error.message);
      }
      if (error instanceof ConnectorUnavailable) {
        throw new ApiFailure("connector_unavailable", error.message, { reason: error.reason });
      }
      throw error;
    }
  });
}
