import { NextResponse } from "next/server";
import { ApiFailure, handler, requirePermission } from "@/server/auth/rbac";
import { readRecords } from "@/server/data/records";
import { disconnect } from "@/server/services/connection-service";

/**
 * Revokes a creator's grant on this side.
 *
 * The creator id comes from the session, so this can only ever disconnect the
 * caller's own account. Their public profile is untouched — only the authorized
 * analytics stop, which is what the connections page promises.
 */
export async function POST() {
  return handler(async () => {
    const user = await requirePermission("self:connections_write");
    if (!user.influencerId) {
      throw new ApiFailure("not_found", "This account is not linked to a creator profile.");
    }

    const account = readRecords().accounts.find(
      (item) => item.influencerId === user.influencerId && item.isPrimary,
    );
    if (!account) throw new ApiFailure("not_found", "No tracked account for this creator.");

    disconnect(user.influencerId, account.id);
    return NextResponse.json({ disconnected: true });
  });
}
