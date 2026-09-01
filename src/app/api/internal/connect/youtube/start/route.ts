import { NextResponse } from "next/server";
import { ApiFailure, handler, requirePermission } from "@/server/auth/rbac";
import { ConnectorUnavailable } from "@/server/connectors/youtube";
import { connectionConfigured, startConnection } from "@/server/services/connection-service";

/**
 * Sends the signed-in creator to Google's consent screen.
 *
 * `self:connections_write`, and the influencer id comes from the session rather
 * than the request: a creator may connect their own account and no one else's,
 * and taking the id from input would make that a matter of what someone typed.
 */
export async function GET() {
  return handler(async () => {
    const user = await requirePermission("self:connections_write");
    if (!user.influencerId) {
      throw new ApiFailure("not_found", "This account is not linked to a creator profile.");
    }

    if (!connectionConfigured()) {
      throw new ApiFailure(
        "connector_unavailable",
        "Account connection is not configured. YOUTUBE_OAUTH_CLIENT_ID, _SECRET, " +
          "_REDIRECT_URI and TOKEN_ENCRYPTION_KEY must all be set.",
      );
    }

    try {
      return NextResponse.redirect(startConnection(user.influencerId));
    } catch (error) {
      if (error instanceof ConnectorUnavailable) {
        throw new ApiFailure("connector_unavailable", error.message, { reason: error.reason });
      }
      throw error;
    }
  });
}
