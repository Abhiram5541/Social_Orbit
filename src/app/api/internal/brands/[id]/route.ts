import { NextResponse } from "next/server";
import { z } from "zod";
import { BrandPatch } from "@/lib/contracts/agency";
import { errorResponse, handler, requirePermission } from "@/server/auth/rbac";
import { assignBrands, getBrand, updateBrand } from "@/server/services/agency-service";
import { setBrand } from "@/server/repositories/workspace-repository";

type Params = { params: Promise<{ id: string }> };

/**
 * Either patches the brand, files work under it, or assigns who may see it.
 * Branched on the key rather than by a union, because a patch schema whose
 * every field is optional matches any of the three.
 */
const Attach = z.object({
  attach: z.object({ kind: z.enum(["shortlist", "campaign"]), id: z.string().min(1) }),
});
const Assign = z.object({ assign: z.object({ userId: z.string().min(1) }) });

export async function GET(_request: Request, { params }: Params) {
  return handler(async () => {
    const user = await requirePermission("campaign:read");
    const brand = getBrand(user, (await params).id);
    if (!brand) return errorResponse("not_found", "Client not found.");
    return NextResponse.json(brand);
  });
}

export async function PATCH(request: Request, { params }: Params) {
  return handler(async () => {
    const user = await requirePermission("campaign:write");
    const { id } = await params;
    const raw: unknown = await request.json().catch(() => null);

    if (raw && typeof raw === "object" && "attach" in raw) {
      const parsed = Attach.safeParse(raw);
      if (!parsed.success) return errorResponse("validation_failed", "Check the request.");
      setBrand(user, parsed.data.attach.kind, parsed.data.attach.id, id);
      return NextResponse.json({ ok: true });
    }
    if (raw && typeof raw === "object" && "assign" in raw) {
      const parsed = Assign.safeParse(raw);
      if (!parsed.success) return errorResponse("validation_failed", "Check the request.");
      return NextResponse.json({ ok: true, brandIds: await assignBrands(user, parsed.data.assign.userId, [id]) });
    }
    const parsed = BrandPatch.safeParse(raw);
    if (!parsed.success) return errorResponse("validation_failed", "Check the request.");
    return NextResponse.json(updateBrand(user, id, parsed.data));
  });
}
