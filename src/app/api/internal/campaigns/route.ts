import { NextResponse } from "next/server";
import { CampaignInput } from "@/lib/contracts/campaign";
import { errorResponse, handler, requirePermission } from "@/server/auth/rbac";
import { createCampaign, listCampaigns } from "@/server/repositories/workspace-repository";
import { z } from "zod";

const CreateCampaign = CampaignInput.extend({
  influencerIds: z.array(z.string()).max(200).optional(),
}).refine((value) => value.endsOn >= value.startsOn, {
  message: "The end date must be on or after the start date",
  path: ["endsOn"],
});

export async function GET() {
  return handler(async () => {
    const user = await requirePermission("campaign:read");
    return NextResponse.json({ items: listCampaigns(user) });
  });
}

export async function POST(request: Request) {
  return handler(async () => {
    const user = await requirePermission("campaign:write");
    const parsed = CreateCampaign.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      const details: Record<string, string[]> = {};
      for (const issue of parsed.error.issues) {
        (details[String(issue.path[0] ?? "form")] ??= []).push(issue.message);
      }
      return errorResponse("validation_failed", "Check the campaign details.", { details });
    }

    const campaign = createCampaign(user, {
      ...parsed.data,
      brief: parsed.data.brief,
      budgetAmount: parsed.data.budgetAmount,
    });
    return NextResponse.json(campaign, { status: 201 });
  });
}
