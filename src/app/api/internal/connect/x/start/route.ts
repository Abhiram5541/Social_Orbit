import { NextResponse } from "next/server";
import { ApiFailure, handler, requirePermission } from "@/server/auth/rbac";
import { ConnectorUnavailable } from "@/server/connectors/x";
import { startXConnection, xConnectionConfigured } from "@/server/services/x-connection-service";

/**
 * Sends the signed-in creator to X's consent screen.
 *
 * `self:connections_write`, and the influencer id comes from the session
 * rather than the request — same rule as the YouTube route.
 */
export async function GET() {
  return handler(async () => {
    const user = await requirePermission("self:connections_write");
    if (!user.influencerId) {
      throw new ApiFailure("not_found", "This account is not linked to a creator profile.");
    }

    if (!xConnectionConfigured()) {
      throw new ApiFailure(
        "connector_unavailable",
        "Account connection is not configured. X_OAUTH_CLIENT_ID, _CLIENT_SECRET, " +
          "_REDIRECT_URI and TOKEN_ENCRYPTION_KEY must all be set.",
      );
    }

    try {
      return NextResponse.redirect(startXConnection(user.influencerId));
    } catch (error) {
      if (error instanceof ConnectorUnavailable) {
        throw new ApiFailure("connector_unavailable", error.message, { reason: error.reason });
      }
      throw error;
    }
  });
}
