import { NextResponse, type NextRequest } from "next/server";
import { handler, requirePermission } from "@/server/auth/rbac";
import { sendContract } from "@/server/services/deal-service";

type Params = { params: Promise<{ id: string }> };

/** Issues the signature link and freezes the document. */
export async function POST(_request: NextRequest, { params }: Params) {
  return handler(async () => {
    const user = await requirePermission("campaign:write");
    const { id } = await params;
    return NextResponse.json(sendContract(user, id));
  });
}
