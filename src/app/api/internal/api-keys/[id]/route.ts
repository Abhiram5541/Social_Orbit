import { NextResponse } from "next/server";
import { handler, requirePermission } from "@/server/auth/rbac";
import { revokeApiKey, rotateApiKey } from "@/server/repositories/api-key-repository";

type Params = { params: Promise<{ id: string }> };

/** Rotation issues a new secret and revokes the old one in the same step. */
export async function POST(_request: Request, { params }: Params) {
  return handler(async () => {
    const user = await requirePermission("api_key:write");
    const { id } = await params;
    const { key, raw } = rotateApiKey(user, id);
    return NextResponse.json({ key, secret: raw });
  });
}

export async function DELETE(_request: Request, { params }: Params) {
  return handler(async () => {
    const user = await requirePermission("api_key:write");
    const { id } = await params;
    return NextResponse.json(revokeApiKey(user, id));
  });
}
