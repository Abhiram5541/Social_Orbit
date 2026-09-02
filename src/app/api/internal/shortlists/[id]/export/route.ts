import { NextResponse } from "next/server";
import { errorResponse, handler, requirePermission } from "@/server/auth/rbac";
import { getShortlist } from "@/server/repositories/workspace-repository";

/*
 * Shortlist CSV export — the vendor-neutral CRM path (see the integrations
 * catalog). Every CRM imports CSV, no vendor grants us anything, and the file
 * carries exactly what the shortlist screen shows: no more fields, no less
 * provenance.
 */

type Params = { params: Promise<{ id: string }> };

/** RFC 4180: quote everything, double any quote inside. */
const cell = (value: string | number | null): string =>
  `"${String(value ?? "").replace(/"/g, '""')}"`;

export async function GET(_request: Request, { params }: Params) {
  return handler(async () => {
    const user = await requirePermission("shortlist:read");
    const { id } = await params;

    const shortlist = getShortlist(user, id);
    if (!shortlist) return errorResponse("not_found", "Shortlist not found.");

    const header = [
      "displayName",
      "handle",
      "platform",
      "followers",
      "healthScore",
      "engagementRatePct",
      "campaignFit",
      "note",
      "addedAt",
      "addedBy",
    ];
    const rows = shortlist.items.map((item) =>
      [
        item.displayName,
        item.primaryHandle,
        item.primaryPlatform,
        item.followers,
        item.healthScore,
        item.engagementRate,
        item.campaignFit,
        item.note,
        item.addedAt,
        item.addedByName,
      ]
        .map(cell)
        .join(","),
    );

    const csv = [header.map(cell).join(","), ...rows].join("\r\n") + "\r\n";
    const stem = shortlist.name.replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "") || "shortlist";

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${stem}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  });
}
