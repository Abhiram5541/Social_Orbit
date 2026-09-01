import { NextResponse } from "next/server";
import { handler, requirePermission } from "@/server/auth/rbac";
import { removeDemoCreators, seedDemoCreators } from "@/server/services/demo-service";

/**
 * Seeds or removes the demonstration creators.
 *
 * Behind the ingestion permission because it writes to the influencer
 * database, and gated the same way a harvest is.
 */
export async function POST() {
  return handler(async () => {
    await requirePermission("admin:ingestion");
    return NextResponse.json(seedDemoCreators());
  });
}

export async function DELETE() {
  return handler(async () => {
    await requirePermission("admin:ingestion");
    return NextResponse.json({ removed: removeDemoCreators() });
  });
}
