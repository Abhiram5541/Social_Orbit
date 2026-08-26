import { NextResponse } from "next/server";
import { CreateApiKeyInput } from "@/lib/contracts/api-key";
import { errorResponse, handler, requirePermission } from "@/server/auth/rbac";
import { createApiKey, listApiKeys } from "@/server/repositories/api-key-repository";

export async function GET() {
  return handler(async () => {
    const user = await requirePermission("api_key:read");
    return NextResponse.json({ items: listApiKeys(user) });
  });
}

export async function POST(request: Request) {
  return handler(async () => {
    const user = await requirePermission("api_key:write");
    const parsed = CreateApiKeyInput.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return errorResponse("validation_failed", parsed.error.issues[0].message);
    }

    // `raw` appears in this response and nowhere else, ever.
    const { key, raw } = createApiKey(user, parsed.data);
    return NextResponse.json({ key, secret: raw }, { status: 201 });
  });
}
