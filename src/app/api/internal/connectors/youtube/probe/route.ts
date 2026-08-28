import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { ApiFailure, handler, requirePermission } from "@/server/auth/rbac";
import { ConnectorUnavailable } from "@/server/connectors/youtube";
import { probeYouTubeChannel } from "@/server/services/connector-probe-service";

const Query = z.object({
  channel: z.string().min(1, "A channel id, @handle or youtube.com URL is required."),
  videos: z.coerce.number().int().min(1).max(50).default(25),
});

/**
 * Live self-test for the YouTube connector — platform operations only.
 *
 * Spends real API quota, so it is never called on a page render; an operator
 * runs it from the connectors screen when they need to know whether the
 * credential and the upstream contract still hold.
 */
export async function GET(request: NextRequest) {
  return handler(async () => {
    await requirePermission("admin:connectors");

    const parsed = Query.safeParse(Object.fromEntries(request.nextUrl.searchParams));
    if (!parsed.success) {
      throw new ApiFailure("validation_failed", parsed.error.issues[0].message);
    }

    try {
      const result = await probeYouTubeChannel(parsed.data.channel, parsed.data.videos);
      if (!result) {
        throw new ApiFailure("not_found", `No YouTube channel matched "${parsed.data.channel}".`);
      }
      return NextResponse.json(result);
    } catch (error) {
      if (error instanceof ConnectorUnavailable) {
        throw new ApiFailure("connector_unavailable", error.message, { reason: error.reason });
      }
      throw error;
    }
  });
}
