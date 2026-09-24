import type { InfluencerSummary } from "@/lib/contracts/influencer";
import { CATEGORY_LABEL, PLATFORM_LABEL } from "@/lib/contracts/common";
import type { SearchQuery } from "@/lib/contracts/search";
import { convertEstimate } from "@/server/analytics/pricing";
import { formatCompact } from "@/lib/format";

/* ---------------------------------------------------------------------------
 * Why this creator is in this result.
 *
 * Deterministic, and derived from the same query the filter ran: each reason
 * names a criterion the person asked for and the value that satisfied it. It
 * is not a model's opinion of relevance — the AI assistant writes prose about
 * a result set, this says which of *your* conditions each row met, which is
 * the thing you have to defend when somebody asks why they are on the list.
 * ------------------------------------------------------------------------ */

export interface MatchReason {
  field: string;
  /** "Beauty", "1.2M followers", "Under ₹1,00,000 estimated". */
  detail: string;
}

export function matchReasons(item: InfluencerSummary, query: SearchQuery): MatchReason[] {
  const reasons: MatchReason[] = [];

  if (query.category?.length) {
    const hit = item.categories.filter((category) => query.category!.includes(category));
    if (hit.length > 0) {
      reasons.push({
        field: "category",
        detail: hit.map((category) => CATEGORY_LABEL[category] ?? category).join(", "),
      });
    }
  }

  if (query.platform?.length) {
    const hit = item.platforms.filter((platform) => query.platform!.includes(platform));
    if (hit.length > 0) {
      reasons.push({ field: "platform", detail: hit.map((p) => PLATFORM_LABEL[p]).join(", ") });
    }
  }

  if ((query.followersMin !== undefined || query.followersMax !== undefined) && item.followers !== null) {
    reasons.push({ field: "followers", detail: `${formatCompact(item.followers)} followers` });
  }

  if (query.engagementMin !== undefined && item.engagementRate !== null) {
    reasons.push({ field: "engagement", detail: `${item.engagementRate.toFixed(1)}% engagement` });
  }

  if (query.healthMin !== undefined && item.healthScore !== null) {
    reasons.push({ field: "health", detail: `Health ${Math.round(item.healthScore)}` });
  }

  if (query.country?.length && item.countryCode && query.country.includes(item.countryCode)) {
    reasons.push({ field: "country", detail: item.countryName ?? item.countryCode });
  }

  if (query.language?.length) {
    const hit = item.languages.filter((language) => query.language!.includes(language));
    if (hit.length > 0) reasons.push({ field: "language", detail: hit.join(", ") });
  }

  if (query.verification?.length && query.verification.includes(item.verification)) {
    reasons.push({ field: "verification", detail: item.verification });
  }

  if (query.rateMin !== undefined || query.rateMax !== undefined) {
    const band = convertEstimate(item.estimatedPlacementRate, query.rateCurrency ?? "USD");
    if (band) {
      reasons.push({
        field: "rate",
        // Labelled as modelled wherever it is shown — it is not a rate card.
        detail: `${band.currency} ${formatCompact(band.low)}–${formatCompact(band.high)} estimated per placement`,
      });
    }
  }

  // Free text is the one criterion the filter matches loosely, so it names
  // where the words were found rather than claiming the whole phrase matched.
  if (query.q?.trim()) {
    const needle = query.q.trim().toLowerCase();
    const where: string[] = [];
    if (item.displayName.toLowerCase().includes(needle)) where.push("name");
    if (item.primaryHandle.toLowerCase().includes(needle)) where.push("handle");
    if (item.placeMentions.some((place) => place.toLowerCase().includes(needle))) where.push("places they mention");
    if (item.categories.some((c) => (CATEGORY_LABEL[c] ?? c).toLowerCase().includes(needle))) where.push("category");
    if (where.length > 0) reasons.push({ field: "q", detail: `“${query.q.trim()}” in ${where.join(", ")}` });
  }

  return reasons;
}
