import { NextResponse, type NextRequest } from "next/server";
import { ApplicationStatus } from "@/lib/contracts/onboarding";
import { handler, requirePermission } from "@/server/auth/rbac";
import { listApplications } from "@/server/services/onboarding-service";

/** The review queue. */
export async function GET(request: NextRequest) {
  return handler(async () => {
    const user = await requirePermission("crm:read");
    const status = ApplicationStatus.safeParse(request.nextUrl.searchParams.get("status") ?? undefined);
    return NextResponse.json({
      items: listApplications(user, status.success ? status.data : undefined),
    });
  });
}
