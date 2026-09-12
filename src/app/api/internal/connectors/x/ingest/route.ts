import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { ApiFailure, handler, requirePermission } from "@/server/auth/rbac";
import { ConnectorUnavailable } from "@/server/connectors/x";
import { IngestionRefused, ingestXAccount } from "@/server/services/ingestion-service";

const Body = z.object({
  /** One account per line, or comma separated. @handles, bare handles or URLs. */
  accounts: z.string().min(1, "Enter at least one account."),
  posts: z.number().int().min(5).max(100).default(50),
});

/** At most this many accounts per request — each one spends a call against
 *  X's rate-limit ceiling and blocks. */
const MAX_PER_REQUEST = 10;

export interface XIngestOutcome {
  input: string;
  ok: boolean;
  detail: string;
  influencerId?: string;
}

/**
 * Ingests real X accounts into the influencer database.
 *
 * Sequential on purpose, same reasoning as the YouTube route: X's rate limit
 * is enforced per endpoint, and firing concurrent reads at it turns a partial
 * failure into an unattributable one.
 */
export async function POST(request: NextRequest) {
  return handler(async () => {
    await requirePermission("admin:ingestion");

    const parsed = Body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new ApiFailure("validation_failed", parsed.error.issues[0].message);
    }

    const accounts = parsed.data.accounts
      .split(/[\n,]/)
      .map((entry) => entry.trim())
      .filter(Boolean);

    if (accounts.length === 0) {
      throw new ApiFailure("validation_failed", "Enter at least one account.");
    }
    if (accounts.length > MAX_PER_REQUEST) {
      throw new ApiFailure(
        "validation_failed",
        `Ingest at most ${MAX_PER_REQUEST} accounts at a time.`,
      );
    }

    const results: XIngestOutcome[] = [];
    let quotaUnitsSpent = 0;

    for (const account of accounts) {
      try {
        const report = await ingestXAccount(account, parsed.data.posts);
        quotaUnitsSpent += report.quotaUnitsSpent;
        results.push({
          input: account,
          ok: true,
          influencerId: report.influencerId,
          detail: `${report.displayName} — ${report.contentIngested} posts indexed`,
        });
      } catch (error) {
        if (error instanceof IngestionRefused) {
          results.push({ input: account, ok: false, detail: error.message });
          continue;
        }
        if (error instanceof ConnectorUnavailable) {
          // Billing-blocked or rate-limited will fail every remaining account
          // the same way. Stop rather than burn the list against it.
          results.push({ input: account, ok: false, detail: error.message });
          break;
        }
        throw error;
      }
    }

    return NextResponse.json({
      results,
      quotaUnitsSpent,
      ingested: results.filter((result) => result.ok).length,
    });
  });
}
