import { NextResponse, type NextRequest } from "next/server";
import { errorResponse, handler } from "@/server/auth/rbac";
import { reportByToken } from "@/server/services/report-service";

type Params = { params: Promise<{ token: string }> };

/**
 * A shared report. Readable without a session only when the report was
 * explicitly made public — knowing the URL is not the same as being given
 * permission.
 */
export async function GET(_request: NextRequest, { params }: Params) {
  return handler(async () => {
    const { token } = await params;
    const report = reportByToken(token);
    if (!report) return errorResponse("not_found", "This report link is not valid.");
    const { token: _t, ...rest } = report;
    void _t;
    return NextResponse.json(rest);
  });
}
