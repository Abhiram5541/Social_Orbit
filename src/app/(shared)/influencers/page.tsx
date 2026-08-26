import { redirect } from "next/navigation";
import { ROLE_WORKSPACE } from "@/lib/contracts/auth";
import { requirePageSession } from "@/server/auth/rbac";

/**
 * The influencer index and search are the same surface — one implementation,
 * no second code path to drift. Operators land on their own view of it.
 */
export default async function InfluencersIndexPage() {
  const user = await requirePageSession("/influencers");
  redirect(ROLE_WORKSPACE[user.role] === "admin" ? "/admin/influencers" : "/discovery");
}
