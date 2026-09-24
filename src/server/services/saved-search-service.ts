import type { SessionUser } from "@/lib/contracts/auth";
import type { SearchQuery } from "@/lib/contracts/search";
import { ApiFailure, assertTenantAccess } from "@/server/auth/rbac";
import { appRows, persist, unpersist } from "@/server/data/app-store";
import { signatureOf } from "./search-service";

/* ---------------------------------------------------------------------------
 * A search, kept.
 *
 * The point is reproducibility rather than convenience: a shortlist drawn six
 * weeks ago was drawn under *some* set of conditions, and "creators over 100k
 * with strong engagement" is not that set — the thresholds are. So a saved
 * search stores the resolved query, the sentence that produced it if there
 * was one, and the signature the quota meter uses, and re-running it later
 * runs exactly the same filters rather than a re-parse of the words.
 * ------------------------------------------------------------------------ */

export const SAVED_SEARCH_VERSION = "saved-search-1.0.0";

export interface SavedSearch {
  id: string;
  orgId: string;
  name: string;
  /** The resolved filters. Replayed as-is. */
  query: SearchQuery;
  /** What the person typed, when they used the assistant or the ask panel. */
  askedAs: string | null;
  /** Identifies the filter set independently of paging and sort. */
  signature: string;
  /** Result count at the moment it was saved, for an honest comparison later. */
  resultsWhenSaved: number | null;
  createdAt: string;
  createdByName: string;
  lastRunAt: string | null;
}

const rows = () => appRows<SavedSearch>("saved_searches", () => []);

export function listSavedSearches(user: SessionUser): SavedSearch[] {
  return rows()
    .filter((row) => row.orgId === user.orgId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function saveSearch(
  user: SessionUser,
  input: { name: string; query: SearchQuery; askedAs?: string | null; results?: number | null },
): SavedSearch {
  const row: SavedSearch = {
    id: `sav_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    orgId: user.orgId,
    name: input.name.trim(),
    query: input.query,
    askedAs: input.askedAs?.trim() || null,
    signature: signatureOf(input.query),
    resultsWhenSaved: input.results ?? null,
    createdAt: new Date().toISOString(),
    createdByName: user.name,
    lastRunAt: null,
  };
  rows().push(row);
  persist("saved_searches", [row]);
  return row;
}

export function getSavedSearch(user: SessionUser, id: string): SavedSearch {
  const row = rows().find((entry) => entry.id === id);
  if (!row) throw new ApiFailure("not_found", "No such saved search.");
  assertTenantAccess(user, row.orgId);
  return row;
}

/** Marks it run. The query itself never changes — that is the whole point. */
export function touchSavedSearch(user: SessionUser, id: string): SavedSearch {
  const row = getSavedSearch(user, id);
  row.lastRunAt = new Date().toISOString();
  persist("saved_searches", [row]);
  return row;
}

export function deleteSavedSearch(user: SessionUser, id: string): void {
  const row = getSavedSearch(user, id);
  const remaining = rows().filter((entry) => entry.id !== row.id);
  rows().length = 0;
  rows().push(...remaining);
  unpersist("saved_searches", [row.id]);
}
