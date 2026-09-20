import { NextResponse } from "next/server";
import { errorResponse, handler, requirePermission } from "@/server/auth/rbac";
import { getCampaign } from "@/server/repositories/workspace-repository";

/*
 * Campaign performance CSV — one row per participant, exactly what the
 * campaign screen shows. The campaign score travels with its formula version
 * so a number that leaves the platform can still be traced to how it was made.
 */

type Params = { params: Promise<{ id: string }> };

/** RFC 4180: quote everything, double any quote inside. */
const cell = (value: string | number | null): string =>
  `"${String(value ?? "").replace(/"/g, '""')}"`;

export async function GET(_request: Request, { params }: Params) {
  return handler(async () => {
    const user = await requirePermission("campaign:read");
    const { id } = await params;

    const campaign = getCampaign(user, id);
    if (!campaign) return errorResponse("not_found", "Campaign not found.");

    const header = [
      "campaign",
      "hashtag",
      "displayName",
      "handle",
      "platform",
      "status",
      "followers",
      "healthScore",
      "campaignFit",
      "agreedRate",
      "currency",
      "attributedPosts",
      "reach",
      "views",
      "likes",
      "comments",
      "engagementRatePct",
      "costPerEngagement",
      "campaignScore",
      "formulaVersion",
      "computedAt",
    ];
    const rows = campaign.participants.map((p) =>
      [
        campaign.name,
        campaign.hashtag,
        p.displayName,
        p.primaryHandle,
        p.primaryPlatform,
        p.status,
        p.followers,
        p.healthScore,
        p.campaignFit,
        p.agreedRate,
        p.currency,
        p.performance.attributedPosts,
        p.performance.reach,
        p.performance.views,
        p.performance.likes,
        p.performance.comments,
        p.performance.engagementRate,
        p.performance.costPerEngagement,
        p.performance.campaignScore,
        p.performance.formulaVersion,
        p.performance.computedAt,
      ]
        .map(cell)
        .join(","),
    );

    const csv = [header.map(cell).join(","), ...rows].join("\r\n") + "\r\n";
    const stem = campaign.name.replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "") || "campaign";

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${stem}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  });
}
