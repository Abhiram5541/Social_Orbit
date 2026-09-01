import { NextResponse, type NextRequest } from "next/server";
import { ConnectorUnavailable } from "@/server/connectors/youtube";
import { ConnectionRefused, completeConnection } from "@/server/services/connection-service";

/**
 * Where Google sends the creator back.
 *
 * Always a redirect to the connections page carrying a readable outcome, never
 * a JSON body: a person is looking at this, having just left a consent screen.
 * The one-time code is exchanged server-side and never reaches the browser.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const back = (status: string, detail?: string) => {
    const url = new URL("/creator/connections", request.nextUrl.origin);
    url.searchParams.set("connection", status);
    if (detail) url.searchParams.set("detail", detail);
    return NextResponse.redirect(url);
  };

  // The creator pressed Cancel, or Google refused outright.
  const denied = params.get("error");
  if (denied) {
    return back(denied === "access_denied" ? "cancelled" : "failed", denied);
  }

  const code = params.get("code");
  const state = params.get("state");
  if (!code || !state) return back("failed", "Google did not return an authorisation code.");

  try {
    const result = await completeConnection(code, state);
    return back("connected", result.channelTitle);
  } catch (error) {
    if (error instanceof ConnectionRefused || error instanceof ConnectorUnavailable) {
      return back("failed", error.message);
    }
    // Nothing internal escapes to a URL a creator can read or share.
    console.error("[connect] unhandled error", error);
    return back("failed", "Something went wrong completing the connection.");
  }
}
