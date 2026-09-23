import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { ApiFailure, handler, requirePermission } from "@/server/auth/rbac";
import {
  analyseCampaign,
  analyseCreator,
  campaignSentiment,
  sentimentBlockedReason,
  sentimentFor,
} from "@/server/services/sentiment-service";

export async function GET(request: NextRequest) {
  return handler<unknown>(async () => {
    const user = await requirePermission("influencer:read");
    const params = new URL(request.url).searchParams;
    const campaignId = params.get("campaignId");
    const influencerId = params.get("influencerId");

    const record = campaignId
      ? campaignSentiment(user, campaignId)
      : influencerId
        ? sentimentFor("creator", influencerId)
        : null;
    return NextResponse.json({ record, blocked: sentimentBlockedReason() });
  });
}

const Body = z.union([
  z.object({ influencerId: z.string().min(1) }),
  z.object({ campaignId: z.string().min(1) }),
]);

/** Spends YouTube quota and AI tokens, so it is an explicit action. */
export async function POST(request: NextRequest) {
  return handler(async () => {
    const parsed = Body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw new ApiFailure("validation_failed", "Name a creator or a campaign.");

    // A campaign reading belongs to whoever runs the campaign; reading a
    // creator's comments spends SENSO's own platform quota, so that one stays
    // with the people who answer for it.
    if ("campaignId" in parsed.data) {
      const user = await requirePermission("campaign:write");
      return NextResponse.json(await analyseCampaign(user, parsed.data.campaignId));
    }
    await requirePermission("analytics:read");
    return NextResponse.json(await analyseCreator(parsed.data.influencerId));
  });
}
