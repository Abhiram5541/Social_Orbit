import { NextResponse, type NextRequest } from "next/server";
import { handler, requirePermission } from "@/server/auth/rbac";
import { forecastAccuracy } from "@/server/services/forecast-service";

type Params = { params: Promise<{ id: string }> };

/** The same forecast maths, scored against what actually happened. */
export async function GET(_request: NextRequest, { params }: Params) {
  return handler(async () => {
    const user = await requirePermission("campaign:read");
    const { id } = await params;
    return NextResponse.json(forecastAccuracy(user, id));
  });
}
