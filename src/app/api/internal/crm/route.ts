import { NextResponse, type NextRequest } from "next/server";
import { RelationshipStage } from "@/lib/contracts/crm";
import { handler, requirePermission } from "@/server/auth/rbac";
import { crmTags, listCrm } from "@/server/repositories/crm-repository";

/** The organisation's creator relationships, filtered and segmented. */
export async function GET(request: NextRequest) {
  return handler(async () => {
    const user = await requirePermission("crm:read");
    const params = request.nextUrl.searchParams;
    const stage = RelationshipStage.safeParse(params.get("stage") ?? undefined);
    return NextResponse.json({
      items: listCrm(user, {
        stage: stage.success ? stage.data : undefined,
        tag: params.get("tag") ?? undefined,
        q: params.get("q") ?? undefined,
        ownerUserId: params.get("owner") ?? undefined,
      }),
      tags: crmTags(user),
    });
  });
}
