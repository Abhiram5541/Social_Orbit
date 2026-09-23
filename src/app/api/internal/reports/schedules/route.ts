import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { ApiFailure, handler, requirePermission } from "@/server/auth/rbac";
import { createSchedule, listSchedules, setScheduleEnabled } from "@/server/services/report-service";

const Body = z.object({
  name: z.string().trim().min(2).max(120),
  kind: z.enum(["campaign", "shortlist", "portfolio"]),
  subjectId: z.string().trim().min(1).nullable().default(null),
  cadence: z.enum(["once", "daily", "weekly", "monthly"]),
  recipients: z.array(z.string().trim().email()).max(20).default([]),
  publicLink: z.boolean().default(false),
  brandId: z.string().trim().min(1).nullable().default(null),
});

export async function GET() {
  return handler(async () => {
    const user = await requirePermission("report:read");
    return NextResponse.json({ items: listSchedules(user) });
  });
}

export async function POST(request: NextRequest) {
  return handler(async () => {
    const user = await requirePermission("report:create");
    const parsed = Body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new ApiFailure("validation_failed", parsed.error.issues[0].message);
    return NextResponse.json(createSchedule(user, parsed.data), { status: 201 });
  });
}

export async function PATCH(request: NextRequest) {
  return handler(async () => {
    const user = await requirePermission("report:create");
    const parsed = z
      .object({ id: z.string().min(1), enabled: z.boolean() })
      .safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new ApiFailure("validation_failed", "Pause or resume which schedule?");
    return NextResponse.json(setScheduleEnabled(user, parsed.data.id, parsed.data.enabled));
  });
}
