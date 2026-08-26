import { notFound } from "next/navigation";
import type { InfluencerProfile } from "@/lib/contracts/influencer";
import { requirePageSession } from "@/server/auth/rbac";
import { toProfile } from "@/server/repositories/influencer-repository";

/**
 * Resolves the creator record the signed-in user owns.
 *
 * The influencer id comes from the session, never from a route parameter, so
 * there is no id a creator could substitute to read someone else's authorized
 * analytics.
 */
export async function requireOwnProfile(
  returnTo: string,
): Promise<{ user: Awaited<ReturnType<typeof requirePageSession>>; profile: InfluencerProfile }> {
  const user = await requirePageSession(returnTo);
  if (!user.influencerId) notFound();

  const profile = toProfile(user.influencerId);
  if (!profile) notFound();

  return { user, profile };
}
