import { NextResponse, type NextRequest } from "next/server";
import { handler, requirePermission } from "@/server/auth/rbac";
import { remindContract } from "@/server/services/deal-service";

type Params = { params: Promise<{ id: string }> };

/** Chases an unsigned contract. The signing link is unchanged on purpose. */
export async function POST(_request: NextRequest, { params }: Params) {
  return handler(async () => {
    const user = await requirePermission("campaign:write");
    return NextResponse.json(remindContract(user, (await params).id));
  });
}
