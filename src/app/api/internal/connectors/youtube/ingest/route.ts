import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { ApiFailure, handler, requirePermission } from "@/server/auth/rbac";
import { ConnectorUnavailable } from "@/server/connectors/youtube";
import { IngestionRefused, ingestYouTubeChannel } from "@/server/services/ingestion-service";

const Body = z.object({
  /** One channel per line, or comma separated. Ids, @handles or URLs. */
  channels: z.string().min(1, "Enter at least one channel."),
  videos: z.number().int().min(5).max(50).default(50),
});

/** At most this many channels per request — each one spends quota and blocks. */
const MAX_PER_REQUEST = 10;

export interface IngestOutcome {
  input: string;
  ok: boolean;
  detail: string;
  influencerId?: string;
}

/**
 * Ingests real YouTube channels into the influencer database.
 *
 * Sequential on purpose: the quota is a shared daily budget, and firing ten
 * concurrent reads at it turns a partial failure into an unattributable one.
 */
export async function POST(request: NextRequest) {
  return handler(async () => {
    await requirePermission("admin:ingestion");

    const parsed = Body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      throw new ApiFailure("validation_failed", parsed.error.issues[0].message);
    }

    const channels = parsed.data.channels
      .split(/[\n,]/)
      .map((entry) => entry.trim())
      .filter(Boolean);

    if (channels.length === 0) {
      throw new ApiFailure("validation_failed", "Enter at least one channel.");
    }
    if (channels.length > MAX_PER_REQUEST) {
      throw new ApiFailure(
        "validation_failed",
        `Ingest at most ${MAX_PER_REQUEST} channels at a time.`,
      );
    }

    const results: IngestOutcome[] = [];
    let quotaUnitsSpent = 0;

    for (const channel of channels) {
      try {
        const report = await ingestYouTubeChannel(channel, parsed.data.videos);
        quotaUnitsSpent += report.quotaUnitsSpent;
        results.push({
          input: channel,
          ok: true,
          influencerId: report.influencerId,
          detail: `${report.displayName} — ${report.contentIngested} uploads indexed`,
        });
      } catch (error) {
        if (error instanceof IngestionRefused) {
          results.push({ input: channel, ok: false, detail: error.message });
          continue;
        }
        if (error instanceof ConnectorUnavailable) {
          // A spent quota or a rejected key will fail every remaining channel
          // the same way. Stop rather than burn the list against it.
          results.push({ input: channel, ok: false, detail: error.message });
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
