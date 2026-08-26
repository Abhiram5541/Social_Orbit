"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal, SearchX, Sparkles, TriangleAlert } from "lucide-react";
import {
  CATEGORY_LABEL,
  PLATFORM_LABEL,
  type Category,
  type Platform,
} from "@/lib/contracts/common";
import {
  FOLLOWER_BANDS,
  SORT_LABEL,
  SortKey,
  countActiveFilters,
  toSearchParams,
  type FollowerBand,
  type SearchFacet,
  type SearchQuery,
  type SearchQuota,
} from "@/lib/contracts/search";
import type { InfluencerSummary } from "@/lib/contracts/influencer";
import type { Paged } from "@/lib/contracts/common";
import { formatCompact, formatRelativeTime, pluralise } from "@/lib/format";
import { Button, LinkButton } from "@/components/ui/button";
import { FilterChip } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SearchInput, Select } from "@/components/ui/field";
import { Sheet } from "@/components/ui/dialog";
import { EmptyState, ErrorState, Notice, TableSkeleton } from "@/components/ui/states";
import { Pagination } from "@/components/ui/table";
import { FilterPanel, type Draft } from "./filter-panel";
import { ResultTable, SelectionBar } from "./result-table";

/* ---------------------------------------------------------------------------
 * Discovery.
 *
 * The URL is the state. Every filter change rewrites the query string, so a
 * result set is shareable, back/forward work, and a reload lands on exactly
 * what the user was looking at.
 * ------------------------------------------------------------------------ */

interface SearchResponse {
  page: Paged<InfluencerSummary>;
  facets: SearchFacet[];
  quota: SearchQuota;
  charged: boolean;
}

interface QuotaError {
  code: string;
  message: string;
  quota?: { limit: number; used: number; resetsAt: string };
}

export function DiscoveryView({ initialQuota }: { initialQuota: SearchQuota }) {
  const router = useRouter();
  const params = useSearchParams();

  const query = React.useMemo(() => parseQuery(params), [params]);
  const [draft, setDraft] = React.useState<Draft>(query);
  const [data, setData] = React.useState<SearchResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [blocked, setBlocked] = React.useState<QuotaError | null>(null);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [text, setText] = React.useState(query.q ?? "");

  // The signature of the last result set we paid for. Sending it back lets the
  // server tell paging and re-sorting apart from a genuinely new search.
  const chargedSignature = React.useRef<string | null>(null);

  React.useEffect(() => {
    setDraft(query);
    setText(query.q ?? "");
  }, [query]);

  React.useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    const search = toSearchParams(query);
    if (chargedSignature.current) search.set("_sig", chargedSignature.current);

    fetch(`/api/internal/influencers?${search}`, { signal: controller.signal })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) {
          if (body?.error?.code === "quota_exceeded") {
            setBlocked(body.error as QuotaError);
            setData(null);
            return;
          }
          throw new Error(body?.error?.message ?? `Request failed (${response.status})`);
        }
        setBlocked(null);
        setData(body as SearchResponse);
        if ((body as SearchResponse).charged) {
          chargedSignature.current = signatureOf(query);
        }
      })
      .catch((cause: Error) => {
        if (cause.name !== "AbortError") setError(cause.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [query]);

  const apply = React.useCallback(
    (next: Draft, { resetPage = true }: { resetPage?: boolean } = {}) => {
      const merged = { ...next, page: resetPage ? 1 : next.page };
      router.push(`/discovery?${toSearchParams(merged)}`, { scroll: false });
    },
    [router],
  );

  const quota = data?.quota ?? initialQuota;
  const activeFilters = countActiveFilters(query);
  const chips = describeFilters(query);

  return (
    <div className="flex min-h-0 flex-1">
      {/* Desktop filter rail */}
      <aside className="hidden w-64 shrink-0 border-r border-line bg-surface xl:flex xl:flex-col">
        <FilterPanel
          draft={draft}
          facets={data?.facets ?? []}
          onChange={(next) => {
            setDraft(next);
            apply(next);
          }}
          onReset={() => apply({ sort: query.sort })}
          className="sticky top-topbar max-h-[calc(100dvh-var(--spacing-topbar))]"
        />
      </aside>

      <Sheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        title="Filters"
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                apply({ sort: query.sort });
                setFiltersOpen(false);
              }}
            >
              Reset
            </Button>
            <Button
              variant="primary"
              className="ml-auto"
              onClick={() => {
                apply(draft);
                setFiltersOpen(false);
              }}
            >
              Show results
            </Button>
          </>
        }
      >
        {/* Mounted only while open. Keeping a second copy in the DOM would
            duplicate every checkbox and every label on the page. */}
        {filtersOpen && (
          <FilterPanel
            draft={draft}
            facets={data?.facets ?? []}
            onChange={setDraft}
            onReset={() => setDraft({ sort: query.sort })}
          />
        )}
      </Sheet>

      <div className="min-w-0 flex-1">
        <div className="space-y-3 border-b border-line bg-surface px-4 py-3 sm:px-6">
          <form
            role="search"
            onSubmit={(event) => {
              event.preventDefault();
              apply({ ...draft, q: text.trim() || undefined });
            }}
            className="flex flex-wrap items-center gap-2"
          >
            <SearchInput
              value={text}
              onChange={(event) => setText(event.currentTarget.value)}
              onClear={() => {
                setText("");
                apply({ ...draft, q: undefined });
              }}
              placeholder="Name, handle, category, country or content topic"
              aria-label="Search influencers"
              className="min-w-56 flex-1"
            />
            <Button type="submit" variant="primary">
              Search
            </Button>
            <Button
              type="button"
              onClick={() => setFiltersOpen(true)}
              className="gap-1.5 xl:hidden"
            >
              <SlidersHorizontal className="size-4" aria-hidden />
              Filters
              {activeFilters > 0 && (
                <span className="rounded bg-brand px-1 font-mono text-[11px] text-white">
                  {activeFilters}
                </span>
              )}
            </Button>
            <label className="flex items-center gap-2 text-[13px] text-ink-muted">
              <span className="hidden sm:inline">Sort</span>
              <Select
                value={query.sort}
                onChange={(event) =>
                  apply({ ...query, sort: event.currentTarget.value as SortKey }, { resetPage: false })
                }
                aria-label="Sort results"
                className="w-44"
              >
                {SortKey.options.map((key) => (
                  <option key={key} value={key}>
                    {SORT_LABEL[key]}
                  </option>
                ))}
              </Select>
            </label>
          </form>

          {chips.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              {chips.map((chip) => (
                <FilterChip
                  key={`${chip.key}:${chip.value}`}
                  label={chip.label}
                  value={chip.value}
                  onRemove={() => apply(removeFilter(query, chip.key, chip.rawValue))}
                />
              ))}
              <button
                type="button"
                onClick={() => apply({ sort: query.sort })}
                className="rounded px-1.5 py-0.5 text-[12px] text-brand-ink hover:underline"
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        <div className="p-4 sm:p-6">
          {quota.limit !== null && quota.remaining !== null && quota.remaining <= 2 && !blocked && (
            <Notice
              tone={quota.remaining === 0 ? "critical" : "caution"}
              icon={Sparkles}
              title={
                quota.remaining === 0
                  ? "No searches left this month"
                  : `${quota.remaining} of ${quota.limit} searches remaining`
              }
              action={
                <LinkButton href="/usage" variant="primary" size="sm">
                  Upgrade
                </LinkButton>
              }
              className="mb-4"
            >
              Allowance resets {formatRelativeTime(quota.resetsAt)}. Paging and re-sorting the
              results you already have does not use another search.
            </Notice>
          )}

          <Card>
            {blocked ? (
              <EmptyState
                icon={TriangleAlert}
                title="Search allowance used"
                description={blocked.message}
                action={
                  <div className="flex gap-2">
                    <LinkButton href="/usage" variant="primary" size="sm">
                      See plans
                    </LinkButton>
                    <LinkButton href="/shortlists" size="sm">
                      Open shortlists
                    </LinkButton>
                  </div>
                }
              />
            ) : error ? (
              <ErrorState
                description={error}
                onRetry={() => router.refresh()}
              />
            ) : loading ? (
              <TableSkeleton rows={10} columns={7} />
            ) : !data || data.page.total === 0 ? (
              <EmptyState
                icon={SearchX}
                title="No creators match these filters"
                description={
                  activeFilters > 0
                    ? "Try widening the audience size or removing a quality threshold. Filters combine with AND."
                    : "The database has no published creators yet."
                }
                action={
                  activeFilters > 0 ? (
                    <Button size="sm" onClick={() => apply({ sort: query.sort })}>
                      Clear filters
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
                  <p className="text-[13px] text-ink-muted">
                    <span className="font-mono tabular-nums text-ink">
                      {formatCompact(data.page.total)}
                    </span>{" "}
                    {data.page.total === 1 ? "creator" : "creators"}
                    {activeFilters > 0 && ` matching ${pluralise(activeFilters, "filter")}`}
                  </p>
                  {selected.size > 0 && (
                    <p className="text-[12px] text-ink-muted">
                      {pluralise(selected.size, "creator")} selected for comparison
                    </p>
                  )}
                </div>

                <ResultTable
                  items={data.page.items}
                  sort={query.sort}
                  onSortChange={(sort) => apply({ ...query, sort }, { resetPage: false })}
                  selected={selected}
                  onToggleSelect={(id) =>
                    setSelected((previous) => {
                      const next = new Set(previous);
                      if (next.has(id)) next.delete(id);
                      else next.add(id);
                      return next;
                    })
                  }
                  onShortlist={(item) => router.push(`/shortlists?add=${item.id}`)}
                />

                <Pagination
                  page={data.page.page}
                  pageSize={data.page.pageSize}
                  total={data.page.total}
                  onPageChange={(page) => apply({ ...query, page }, { resetPage: false })}
                />
              </>
            )}
          </Card>

          <SelectionBar
            count={selected.size}
            onCompare={() =>
              router.push(`/compare?ids=${[...selected].join(",")}`)
            }
            onClear={() => setSelected(new Set())}
          />
        </div>
      </div>
    </div>
  );
}

/* --- URL <-> query ------------------------------------------------------ */

function parseQuery(params: URLSearchParams): SearchQuery {
  const raw = Object.fromEntries(params.entries());
  // The server validates the same schema; this parse only shapes local state.
  return {
    q: raw.q,
    platform: split(raw.platform) as Platform[] | undefined,
    category: split(raw.category) as Category[] | undefined,
    country: split(raw.country),
    language: split(raw.language),
    verification: split(raw.verification) as SearchQuery["verification"],
    activity: split(raw.activity) as SearchQuery["activity"],
    risk: split(raw.risk) as SearchQuery["risk"],
    followerBand: split(raw.followerBand) as FollowerBand[] | undefined,
    followersMin: num(raw.followersMin),
    followersMax: num(raw.followersMax),
    engagementMin: num(raw.engagementMin),
    medianViewsMin: num(raw.medianViewsMin),
    growthMin: num(raw.growthMin),
    healthMin: num(raw.healthMin),
    authenticityMin: num(raw.authenticityMin),
    campaignFitMin: num(raw.campaignFitMin),
    roiCategory: raw.roiCategory as SearchQuery["roiCategory"],
    sort: (raw.sort as SortKey) ?? "relevance",
    page: num(raw.page) ?? 1,
    pageSize: num(raw.pageSize) ?? 25,
  };
}

const split = (value: string | undefined) =>
  value ? value.split(",").filter(Boolean) : undefined;

const num = (value: string | undefined) =>
  value === undefined || value === "" ? undefined : Number(value);

function signatureOf(query: SearchQuery): string {
  const relevant: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(query)) {
    if (key === "page" || key === "pageSize" || key === "sort") continue;
    if (value === undefined || value === null) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    relevant[key] = Array.isArray(value) ? [...value].sort() : value;
  }
  return JSON.stringify(relevant, Object.keys(relevant).sort());
}

interface Chip {
  key: keyof SearchQuery;
  rawValue: string | number;
  label: string;
  value: string;
}

function describeFilters(query: SearchQuery): Chip[] {
  const chips: Chip[] = [];
  const many = <T extends string>(
    key: keyof SearchQuery,
    label: string,
    values: T[] | undefined,
    display: (value: T) => string,
  ) => {
    for (const value of values ?? []) {
      chips.push({ key, rawValue: value, label, value: display(value) });
    }
  };

  many("platform", "Platform", query.platform, (v) => PLATFORM_LABEL[v]);
  many("category", "Category", query.category, (v) => CATEGORY_LABEL[v]);
  many("country", "Country", query.country, (v) => v);
  many("verification", "Status", query.verification, (v) => v.replace("_", " "));
  many("activity", "Activity", query.activity, (v) => v.replace("_", " "));
  many("risk", "Risk", query.risk, (v) => v);
  many("followerBand", "Size", query.followerBand, (v) => FOLLOWER_BANDS[v].label);

  const single: [keyof SearchQuery, string, (v: number) => string][] = [
    ["followersMin", "Followers ≥", (v) => formatCompact(v)],
    ["followersMax", "Followers ≤", (v) => formatCompact(v)],
    ["engagementMin", "Engagement ≥", (v) => `${v}%`],
    ["medianViewsMin", "Median views ≥", (v) => formatCompact(v)],
    ["healthMin", "Health ≥", (v) => String(v)],
    ["campaignFitMin", "Fit ≥", (v) => String(v)],
  ];
  for (const [key, label, display] of single) {
    const value = query[key];
    if (typeof value === "number") {
      chips.push({ key, rawValue: value, label, value: display(value) });
    }
  }

  return chips;
}

function removeFilter(
  query: SearchQuery,
  key: keyof SearchQuery,
  rawValue: string | number,
): SearchQuery {
  const current = query[key];
  if (Array.isArray(current)) {
    const next = current.filter((item) => item !== rawValue);
    return { ...query, [key]: next.length ? next : undefined };
  }
  return { ...query, [key]: undefined };
}
