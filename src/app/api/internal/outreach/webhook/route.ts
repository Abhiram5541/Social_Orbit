import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { MessageStatus } from "@/lib/contracts/outreach";
import { errorResponse, handler } from "@/server/auth/rbac";
import { recordProviderEvent } from "@/server/services/outreach-service";

/*
 * Delivery events from the mail provider. Unauthenticated by session — the
 * provider has none — so it is authenticated by a shared secret over the
 * exact bytes received. Without the secret configured the endpoint refuses
 * everything rather than trusting the caller: an open webhook lets anyone
 * mark any message as read.
 */

const Body = z.object({
  messageId: z.string().min(1),
  status: MessageStatus,
});

export async function POST(request: NextRequest) {
  return handler(async () => {
    const secret = process.env.WEBHOOK_SIGNING_SECRET?.trim();
    if (!secret) return errorResponse("connector_unavailable", "Webhooks are not configured.");

    const raw = await request.text();
    const signature = request.headers.get("x-senso-signature") ?? "";
    const expected = `sha256=${createHmac("sha256", secret).update(raw, "utf8").digest("hex")}`;
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return errorResponse("unauthenticated", "Bad signature.");
    }

    const parsed = Body.safeParse(JSON.parse(raw || "null"));
    if (!parsed.success) return errorResponse("validation_failed", "Unexpected payload.");

    const known = recordProviderEvent(parsed.data.messageId, parsed.data.status);
    return NextResponse.json({ ok: known }, { status: known ? 200 : 202 });
  });
}
