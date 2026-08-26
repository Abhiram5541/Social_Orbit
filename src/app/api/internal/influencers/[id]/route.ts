import { NextResponse } from "next/server";
import { errorResponse, handler, requirePermission } from "@/server/auth/rbac";
import { toProfile } from "@/server/repositories/influencer-repository";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handler(async () => {
    const user = await requirePermission("influencer:read");
    const { id } = await params;

    const profile = toProfile(id);
    if (!profile) return errorResponse("not_found", "No influencer with that id.");

    // Authorized audience data is first-party creator analytics. It is visible
    // to platform staff and to the creator themselves — not to every client
    // that can view the public profile (DPR §22).
    const maySeeAudience =
      user.orgKind === "platform" || user.influencerId === id;

    if (!maySeeAudience && profile.audience.available) {
      profile.audience = {
        available: false,
        reason:
          "Authorized audience analytics are visible to the creator and to SocialOrbit reviewers only.",
        countries: [],
        languages: [],
        ageBands: [],
        gender: [],
        provenance: null,
      };
    }

    return NextResponse.json(profile);
  });
}
