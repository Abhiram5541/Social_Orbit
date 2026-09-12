import { NextResponse, type NextRequest } from "next/server";
import { ConnectorUnavailable } from "@/server/connectors/x";
import { XConnectionRefused, completeXConnection } from "@/server/services/x-connection-service";

/**
 * Where X sends the creator back.
 *
 * Always a redirect to the connections page carrying a readable outcome,
 * never a JSON body — same rule as the YouTube callback. The one-time code
 * (and the PKCE verifier riding in `state`) is exchanged server-side and
 * never reaches the browser.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const back = (status: string, detail?: string) => {
    const url = new URL("/creator/connections", request.nextUrl.origin);
    url.searchParams.set("connection", status);
    if (detail) url.searchParams.set("detail", detail);
    return NextResponse.redirect(url);
  };

  const denied = params.get("error");
  if (denied) {
    return back(denied === "access_denied" ? "cancelled" : "failed", denied);
  }

  const code = params.get("code");
  const state = params.get("state");
  if (!code || !state) return back("failed", "X did not return an authorisation code.");

  try {
    const result = await completeXConnection(code, state);
    return back("connected", result.accountName);
  } catch (error) {
    if (error instanceof XConnectionRefused || error instanceof ConnectorUnavailable) {
      return back("failed", error.message);
    }
    console.error("[connect] unhandled error", error);
    return back("failed", "Something went wrong completing the connection.");
  }
}
