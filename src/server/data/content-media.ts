import { shared } from "./process-store";

/* ---------------------------------------------------------------------------
 * A post's link and thumbnail, without keeping 200,000 of each in memory.
 *
 * For YouTube both are a function of the video id, which is already inside
 * the row id (`${accountId}_${videoId}`). 99.9% of stored URLs and 99.6% of
 * thumbnails are exactly that function of it — so they are computed, and the
 * handful that differ are held in an exceptions map loaded at boot.
 *
 * "The handful that differ" is the important half. Deriving all of them would
 * be simpler and would quietly rewrite a few hundred real links; a creator
 * whose thumbnail URL the platform reported differently is not a rounding
 * error, they are a row we were told something specific about. The rule is
 * derived, the exception is stored, and the two together are lossless.
 * ------------------------------------------------------------------------ */

export interface MediaOverride {
  url?: string;
  thumbnailUrl?: string;
}

interface Overrides {
  byId: Map<string, MediaOverride>;
  loaded: boolean;
}

const state = () =>
  shared<Overrides>("content-media", () => ({ byId: new Map(), loaded: false }));

export function primeMediaOverrides(rows: { id: string; url?: string; thumbnailUrl?: string }[]): void {
  const current = state();
  current.byId = new Map(
    rows.map((row) => [
      row.id,
      { url: row.url ?? undefined, thumbnailUrl: row.thumbnailUrl ?? undefined },
    ]),
  );
  current.loaded = true;
}

/** `${accountId}_${videoId}` — and a video id may itself contain "_". */
function videoIdOf(id: string, accountId: string): string | null {
  return id.startsWith(`${accountId}_`) ? id.slice(accountId.length + 1) : null;
}

export function contentUrl(row: {
  id: string;
  accountId: string;
  platform: string;
  url?: string;
}): string {
  if (row.url) return row.url;
  const override = state().byId.get(row.id)?.url;
  if (override) return override;
  const videoId = row.platform === "youtube" ? videoIdOf(row.id, row.accountId) : null;
  return videoId ? `https://www.youtube.com/watch?v=${videoId}` : "";
}

export function contentThumbnail(row: {
  id: string;
  accountId: string;
  platform: string;
  thumbnailUrl?: string | null;
}): string | null {
  if (row.thumbnailUrl) return row.thumbnailUrl;
  const override = state().byId.get(row.id);
  // An id present in the map with no thumbnail is a post that genuinely has
  // none — distinct from an id that is not in the map at all.
  if (override) return override.thumbnailUrl ?? null;
  const videoId = row.platform === "youtube" ? videoIdOf(row.id, row.accountId) : null;
  return videoId ? `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg` : null;
}
