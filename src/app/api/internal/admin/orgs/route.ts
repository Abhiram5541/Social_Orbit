import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { Plan } from "@/lib/contracts/auth";
import { ApiFailure, handler, requirePermission } from "@/server/auth/rbac";
import { listOrgs, updateOrg } from "@/server/repositories/user-repository";

/*
 * Organisations, for platform administration (`admin:orgs`). PATCH renames,
 * re-plans or re-brands one; a logo set here replaces the SENSO wordmark
 * inside that organisation's workspace — and nowhere else.
 */

const Patch = z.object({
  orgId: z.string().trim().min(1),
  name: z.string().trim().min(1).max(120).optional(),
  plan: Plan.optional(),
  /** A path under /brand/clients, or an https URL. Empty string clears it. */
  logoUrl: z
    .string()
    .trim()
    .max(500)
    .regex(/^(\/brand\/[\w./-]+|https:\/\/[^\s]+)?$/, "A /brand/… path or an https URL.")
    .optional(),
});

export async function GET() {
  return handler(async () => {
    await requirePermission("admin:orgs");
    return NextResponse.json(await listOrgs());
  });
}

export async function PATCH(request: NextRequest) {
  return handler(async () => {
    await requirePermission("admin:orgs");
    const parsed = Patch.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new ApiFailure("validation_failed", parsed.error.issues[0].message);
    const { orgId, ...patch } = parsed.data;
    const org = await updateOrg(orgId, patch).catch((error: Error) => {
      throw new ApiFailure("not_found", error.message);
    });
    return NextResponse.json(org);
  });
}
