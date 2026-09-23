import { NextResponse } from "next/server";
import { z } from "zod";
import { BrandInput } from "@/lib/contracts/agency";
import { errorResponse, handler, requirePermission } from "@/server/auth/rbac";
import { assignBrands, brandRollups, createBrand, listBrands, listTeam } from "@/server/services/agency-service";

export async function GET(request: Request) {
  return handler<unknown>(async () => {
    const user = await requirePermission("campaign:read");
    const view = new URL(request.url).searchParams.get("view");
    if (view === "rollup") return NextResponse.json({ items: brandRollups(user) });
    if (view === "team") return NextResponse.json({ items: await listTeam(user) });
    return NextResponse.json({ items: listBrands(user, true) });
  });
}

/** Replaces one teammate's whole client set. An empty list restores full access. */
export async function PATCH(request: Request) {
  return handler(async () => {
    const user = await requirePermission("campaign:write");
    const parsed = z
      .object({ userId: z.string().min(1), brandIds: z.array(z.string()).max(200) })
      .safeParse(await request.json().catch(() => null));
    if (!parsed.success) return errorResponse("validation_failed", "Name the colleague.");
    return NextResponse.json({
      brandIds: await assignBrands(user, parsed.data.userId, parsed.data.brandIds),
    });
  });
}

export async function POST(request: Request) {
  return handler(async () => {
    const user = await requirePermission("campaign:write");
    const parsed = BrandInput.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return errorResponse("validation_failed", "Check the client details.");
    return NextResponse.json(createBrand(user, parsed.data), { status: 201 });
  });
}
