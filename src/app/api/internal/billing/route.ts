import { NextResponse } from "next/server";
import { z } from "zod";
import { Plan } from "@/lib/contracts/auth";
import { errorResponse, handler, requirePermission } from "@/server/auth/rbac";
import {
  cancelPlanChange,
  entitlements,
  pendingChange,
  requestPlanChange,
  statements,
} from "@/server/services/billing-service";

export async function GET() {
  return handler(async () => {
    const user = await requirePermission("billing:read");
    return NextResponse.json({
      plan: user.plan,
      entitlements: await entitlements(user.orgId, user.plan),
      pending: pendingChange(user.orgId),
      statements: await statements(user.orgId, user.plan),
    });
  });
}

const Body = z.union([
  z.object({ plan: Plan, note: z.string().trim().max(1000).optional() }),
  z.object({ cancel: z.string().min(1) }),
]);

export async function POST(request: Request) {
  return handler(async () => {
    const user = await requirePermission("billing:write");
    const parsed = Body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return errorResponse("validation_failed", "Pick a plan.");
    if ("cancel" in parsed.data) {
      return NextResponse.json(cancelPlanChange(user, parsed.data.cancel));
    }
    return NextResponse.json(
      await requestPlanChange(user, parsed.data.plan, parsed.data.note),
      { status: 201 },
    );
  });
}
