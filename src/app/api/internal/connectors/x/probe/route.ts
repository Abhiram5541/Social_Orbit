import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { ApiFailure, handler, requirePermission } from "@/server/auth/rbac";
import { ConnectorUnavailable } from "@/server/connectors/x";
import { probeXAccount } from "@/server/services/x-probe-service";

const Query = z.object({
  account: z.string().min(1, "A username or x.com/twitter.com URL is required."),
  posts: z.coerce.number().int().min(1).max(100).default(25),
});

/**
 * Live self-test for the X connector — platform operations only.
 *
 * Spends a real call against X's per-endpoint rate-limit ceiling (not a
 * shared daily budget — see the module comment in `x-connector.ts`), so it is
 * never called on a page render; an operator runs it from the connectors
 * screen when they need to know whether the credential and the upstream
 * contract still hold.
 */
export async function GET(request: NextRequest) {
  return handler(async () => {
    await requirePermission("admin:connectors");

    const parsed = Query.safeParse(Object.fromEntries(request.nextUrl.searchParams));
    if (!parsed.success) {
      throw new ApiFailure("validation_failed", parsed.error.issues[0].message);
    }

    try {
      const result = await probeXAccount(parsed.data.account, parsed.data.posts);
      if (!result) {
        throw new ApiFailure("not_found", `No X account matched "${parsed.data.account}".`);
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
