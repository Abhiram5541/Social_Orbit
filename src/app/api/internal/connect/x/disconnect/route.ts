import { NextResponse } from "next/server";
import { ApiFailure, handler, requirePermission } from "@/server/auth/rbac";
import { readRecords } from "@/server/data/records";
import { disconnectX } from "@/server/services/x-connection-service";

/**
 * Revokes a creator's X grant on this side. Same shape as the YouTube route:
 * the creator id comes from the session, so this can only ever disconnect
 * the caller's own account.
 */
export async function POST() {
  return handler(async () => {
    const user = await requirePermission("self:connections_write");
    if (!user.influencerId) {
      throw new ApiFailure("not_found", "This account is not linked to a creator profile.");
    }

    const account = readRecords().accounts.find(
      (item) => item.influencerId === user.influencerId && item.isPrimary && item.platform === "x",
    );
    if (!account) throw new ApiFailure("not_found", "No tracked X account for this creator.");

    await disconnectX(user.influencerId, account.id);
    return NextResponse.json({ disconnected: true });
  });
}
