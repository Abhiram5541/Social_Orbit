import { placeMentions } from "@/server/analytics/place-mentions";
import { appStateQuery, postgresDriver } from "@/server/data/postgres";

/* ---------------------------------------------------------------------------
 * One-shot maintenance over the durable copy.
 *
 * These run against the database rather than the in-memory store, because
 * what they exist to do is fill in a field the process can no longer derive
 * for itself — the full captions live in Postgres and the slim process does
 * not hold them. The change lands on the next boot, which is when the store
 * is read.
 *
 * Nothing here deletes or overwrites an observation. Each one adds a derived
 * field, using the same function the product uses, so a backfill cannot
 * disagree with a live read.
 * ------------------------------------------------------------------------ */

export interface BackfillReport {
  scanned: number;
  written: number;
  withPlaces: number;
}

/**
 * Derives `placeMentions` for creators that do not carry it yet.
 *
 * Run before turning `SENSO_SLIM_CONTENT` on: without it the field narrows to
 * what upload *titles* alone say, because the captions it also reads are no
 * longer resident. A user-visible, searchable field quietly returning less
 * than it did is exactly the kind of regression this product exists to avoid.
 */
export async function backfillPlaceMentions(batch = 200): Promise<BackfillReport> {
  const report: BackfillReport = { scanned: 0, written: 0, withPlaces: 0 };
  if (!postgresDriver()) return report;

  for (;;) {
    const { rows } = await appStateQuery<{
      id: string;
      bio: string;
      display_name: string;
      country: string | null;
      texts: string[] | null;
    }>(
      `SELECT i.id,
              coalesce(i.data->>'bio','')          AS bio,
              coalesce(i.data->>'displayName','')  AS display_name,
              nullif(i.data->>'countryCode','')    AS country,
              (SELECT array_agg(coalesce(c.data->>'title','') || ' ' || coalesce(c.data->>'caption',''))
                 FROM content c WHERE c.influencer_id = i.id) AS texts
         FROM influencers i
        WHERE i.data ? 'placeMentions' = false
        LIMIT $1`,
      [batch],
    );
    if (rows.length === 0) break;

    for (const row of rows) {
      const places = placeMentions({
        channelText: `${row.display_name} ${row.bio}`,
        contentText: row.texts ?? [],
        countryCode: row.country,
      });
      await appStateQuery(
        `UPDATE influencers SET data = jsonb_set(data, '{placeMentions}', $2::jsonb) WHERE id = $1`,
        [row.id, JSON.stringify(places)],
      );
      report.written += 1;
      if (places.length > 0) report.withPlaces += 1;
    }
    report.scanned += rows.length;
  }

  return report;
}
