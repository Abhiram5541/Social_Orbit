import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { optOutByToken } from "@/server/repositories/crm-repository";
import { readUnsubscribeToken } from "@/server/services/outreach-service";

/**
 * Public on purpose: the person unsubscribing has no account. The signed
 * token is the authorisation, and it only ever opts *out* — there is no
 * inverse, because re-subscribing somebody from a link is how consent gets
 * laundered.
 */
export async function POST(request: NextRequest) {
  const parsed = z
    .object({ token: z.string().min(8) })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: { code: "validation_failed" } }, { status: 422 });
  }

  const claim = readUnsubscribeToken(parsed.data.token);
  if (!claim) {
    return NextResponse.json({ error: { code: "not_found" } }, { status: 404 });
  }

  optOutByToken(claim.orgId, claim.influencerId);
  // Always the same answer: whether that pair had a record is not something
  // an unauthenticated caller gets to learn.
  return NextResponse.json({ ok: true });
}
