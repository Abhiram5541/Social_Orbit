import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { ApiFailure, handler, requirePermission } from "@/server/auth/rbac";
import { incrementUsage } from "@/server/repositories/usage-repository";
import { generateReport, listReports } from "@/server/services/report-service";

const Body = z.object({
  name: z.string().trim().min(2).max(120),
  kind: z.enum(["campaign", "shortlist", "portfolio"]),
  subjectId: z.string().trim().min(1).nullable().default(null),
  publicLink: z.boolean().default(false),
  brandId: z.string().trim().min(1).nullable().default(null),
});

/** The archive: every report this organisation has generated. */
export async function GET() {
  return handler(async () => {
    const user = await requirePermission("report:read");
    return NextResponse.json({ items: listReports(user) });
  });
}

export async function POST(request: NextRequest) {
  return handler(async () => {
    const user = await requirePermission("report:create");
    // Metered like an export: a report leaves the platform the same way.
    incrementUsage(user.orgId, "report");
    const parsed = Body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new ApiFailure("validation_failed", parsed.error.issues[0].message);
    return NextResponse.json(await generateReport(user, parsed.data), { status: 201 });
  });
}
