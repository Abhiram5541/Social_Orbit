/**
 * Places a creator's own text mentions.
 *
 * No public platform API exposes a city — YouTube publishes a country and
 * nothing finer. What *is* observable is the text the creator wrote: a
 * channel description that says "Hyderabad food vlogger", or upload titles
 * that keep naming Bengaluru. This derives that, and only that. It is a
 * mention, not a residence: a Mumbai creator who filmed one weekend in
 * Hyderabad is not tagged, and a Hyderabad creator who never writes the word
 * is not found. The UI must never render it as a verified location.
 *
 * Derived at read time from stored text, like every other read-side figure,
 * so the 600 creators ingested before this existed are covered without a
 * backfill and a change to the vocabulary needs no re-harvest.
 */

interface Place {
  name: string;
  /** Country the place is in — a Pakistani channel mentioning Hyderabad means Sindh, not Telangana. */
  country: string;
  pattern: RegExp;
}

const PLACES: Place[] = [
  {
    name: "Hyderabad",
    country: "IN",
    pattern: /\bhyderabad\b|\bhyd\b|హైదరాబాద్|హైదరాబాదు|حیدرآباد/i,
  },
  {
    name: "Bengaluru",
    country: "IN",
    pattern: /\bbengaluru\b|\bbangalore\b|\bblr\b|ಬೆಂಗಳೂರು|బెంగళూరు/i,
  },
  {
    name: "Rajahmundry",
    country: "IN",
    pattern: /\brajahmundry\b|\brajamundry\b|\brajamahendravaram\b|\brajahmahendravaram\b|రాజమండ్రి|రాజమహేంద్రవరం/i,
  },
];

export const PLACE_NAMES = PLACES.map((place) => place.name);

/**
 * Two mentions tag a place: the channel's own title or description counts as
 * two on its own, each upload title/caption counts as one. One offhand video
 * is a trip; a bio line or a pattern of uploads is a place the creator works
 * from.
 */
export function placeMentions(input: {
  channelText: string;
  contentText: string[];
  countryCode: string | null;
}): string[] {
  const found: string[] = [];
  for (const place of PLACES) {
    if (input.countryCode && input.countryCode !== place.country) continue;
    let weight = place.pattern.test(input.channelText) ? 2 : 0;
    for (const text of input.contentText) {
      if (weight >= 2) break;
      if (place.pattern.test(text)) weight += 1;
    }
    if (weight >= 2) found.push(place.name);
  }
  return found;
}
