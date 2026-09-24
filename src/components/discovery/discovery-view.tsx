"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/class-names";
import { LayoutGrid, List, SlidersHorizontal, SearchX, TriangleAlert } from "lucide-react";
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
import { formatCompact, pluralise } from "@/lib/format";
import { Button, ButtonGroup, LinkButton, SegmentButton } from "@/components/ui/button";
import { FilterChip } from "@/components/ui/badge";
import { Panel } from "@/components/ui/panel";
import { Popover } from "@/components/ui/overlay";
import { useMediaQuery } from "@/components/ui/use-media-query";
import { SearchInput, Select } from "@/components/ui/field";
import { Sheet } from "@/components/ui/dialog";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/ui/states";
import { Pagination } from "@/components/ui/table";
import { QuotaMeter } from "@/components/intelligence/quota-meter";
import { CreatorPreview } from "./creator-preview";
import { FilterPanel, type Draft } from "./filter-panel";
import { ResultTable, SelectionBar } from "./result-table";
import { ResultCards } from "./result-cards";
import { AddToCampaign } from "./add-to-campaign";

/** The quick sorts, as the references draw them: a row of pills over the grid. */
const QUICK_SORTS: { key: SortKey; label: string }[] = [
  { key: "relevance", label: "Best match" },
  { key: "health_score_desc", label: "Highest health" },
  { key: "followers_desc", label: "Most followers" },
  { key: "engagement_desc", label: "Most engaged" },
  { key: "last_active_desc", label: "Recently active" },
];

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
  /** Which of the asked-for criteria each creator on this page satisfied. */
  reasons?: Record<string, { field: string; detail: string }[]>;
}

/** A failed search carries the API error code so the quota case is separable. */
type QuotaAwareError = Error & {
  code?: string;
  quota?: { limit: number; used: number; resetsAt: string };
};

export function DiscoveryView({
  initialQuota,
  basePath = "/discovery",
  canShortlist = true,
  campaigns = [],
}: {
  initialQuota: SearchQuota;
  /**
   * Where filter changes are written. This view backs both the client's
   * Discovery and the operators' influencer database, and hardcoding
   * `/discovery` sent an operator's every filter click through a layout that
   * rejects them — the filters looked dead because each one bounced to /admin.
   */
  basePath?: string;
  /** Shortlists are client-owned, so the action is hidden for operators. */
  canShortlist?: boolean;
  /** Open campaigns this person may add creators to. Empty hides the action. */
  campaigns?: { id: string; name: string }[];
}) {
  const router = useRouter();
  const params = useSearchParams();

  const query = React.useMemo(() => parseQuery(params), [params]);
  const [draft, setDraft] = React.useState<Draft>(query);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [addingToCampaign, setAddingToCampaign] = React.useState(false);
  const [filtersOpen, setFiltersOpen] = React.useState(false);
  const [text, setText] = React.useState(query.q ?? "");

  // The signature of the last result set we paid for. Sending it back lets the
  // server tell paging and re-sorting apart from a genuinely new search.
  const chargedSignature = React.useRef<string | null>(null);

  /*
   * The URL is the source of truth; the draft and the search box are local
   * echoes of it. When the URL changes — a chip removed, the back button, a
   * shared link — they are reset *during render* rather than in an effect.
   * Syncing this in an effect renders once with stale values and then again
   * with fresh ones, which is both a wasted pass and a visible flicker on the
   * filter controls.
   */
  const [syncedFrom, setSyncedFrom] = React.useState(params.toString());
  const currentParams = params.toString();
  if (syncedFrom !== currentParams) {
    setSyncedFrom(currentParams);
    setDraft(query);
    setText(query.q ?? "");
  }

  /*
   * React Query owns the request. It cancels a superseded search, dedupes
   * identical ones, and keeps the previous page on screen while the next
   * loads. The quota signature is a ref, so recording a charged search does
   * not itself trigger a render.
   */
  const {
    data,
    error: queryError,
    isFetching,
  } = useQuery<SearchResponse, QuotaAwareError>({
    queryKey: ["influencer-search", toSearchParams(query).toString()],
    placeholderData: (previous) => previous,
    queryFn: async ({ signal }) => {
      const search = toSearchParams(query);
      if (chargedSignature.current) search.set("_sig", chargedSignature.current);

      const response = await fetch(`/api/internal/influencers?${search}`, { signal });
      const body = await response.json();

      if (!response.ok) {
        const failure: QuotaAwareError = Object.assign(
          new Error(body?.error?.message ?? `Request failed (${response.status})`),
          { code: body?.error?.code as string | undefined, quota: body?.error?.quota },
        );
        throw failure;
      }

      const result = body as SearchResponse;
      // A ref, not state: recording the charge must not cause a re-render.
      if (result.charged) chargedSignature.current = signatureOf(query);
      return result;
    },
  });

  // The quota block is a specific failure with its own screen, so it is
  // separated from a general error rather than shown as one.
  const blocked = queryError?.code === "quota_exceeded" ? queryError : null;
  const error = queryError && !blocked ? queryError.message : null;
  const loading = isFetching && !data;

  const apply = React.useCallback(
    (next: Draft, { resetPage = true }: { resetPage?: boolean } = {}) => {
      const merged = { ...next, page: resetPage ? 1 : next.page };
      router.push(`${basePath}?${toSearchParams(merged)}`, { scroll: false });
    },
    [router, basePath],
  );

  const quota = data?.quota ?? initialQuota;
  const activeFilters = countActiveFilters(query);
  // `lg`, matching the Tailwind breakpoint the rest of this view uses.
  const wideEnoughForDropdown = useMediaQuery("(min-width: 1024px)");
  // Filters live beside the search field at every width: a popover from `lg`
  // up (nine groups in columns), a sheet below it. The persistent rail is gone
  // — the results deserve the width, and the popover stays open while facets
  // are toggled, so an exploration is still one pass rather than twenty.
  const chips = describeFilters(query);

  /* The intelligence preview. Everything it renders is already on the search
     result, so opening it costs no request. */
  const [previewId, setPreviewId] = React.useState<string | null>(null);
  const [view, setView] = React.useState<"cards" | "table">("cards");
  const preview =
    previewId === null
      ? null
      : (data?.page.items.find((item) => item.id === previewId) ?? null);

  return (
    <div className="flex min-h-0 flex-1 gap-4 px-0 sm:px-1">
      {/* Below `lg` the filters open as a sheet: a dropdown holding nine filter
          groups is unusable on a phone. Only one of the two is ever mounted —
          hiding the other with a class would put a second copy of every
          checkbox and label in the page. */}
      {!wideEnoughForDropdown && (
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
      )}

      <div className="min-w-0 flex-1">
        <div className="space-y-3 rounded-xl bg-surface px-4 py-3 card-shadow">
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
            {/* The allowance rides beside the control that spends it — the
                same film-frame gauge the dashboard and usage page mount. */}
            {quota.limit !== null && (
              <QuotaMeter spent={quota.used} limit={quota.limit} className="px-1" />
            )}
            {wideEnoughForDropdown ? (
              <Popover
                title="Filters"
                className="w-[min(56rem,calc(100vw-1rem))]"
                onOpenChange={setFiltersOpen}
                trigger={(props) => (
                  <Button type="button" {...props} className="gap-1.5">
                    <SlidersHorizontal className="size-4" aria-hidden />
                    Filters
                    {activeFilters > 0 && (
                      <span className="rounded-full bg-brand px-1.5 font-num text-xs text-white">
                        {activeFilters}
                      </span>
                    )}
                  </Button>
                )}
              >
                {/* Mounted only while open, exactly as the sheet is. A panel of
                    nine filter groups sitting in every discovery page's initial
                    tree is hydration work nobody asked for, and it opened a
                    window where an interaction could land before React had
                    attached its handlers. */}
                {filtersOpen && (
                <FilterPanel
                  draft={draft}
                  facets={data?.facets ?? []}
                  onChange={(next) => {
                    setDraft(next);
                    apply(next);
                  }}
                  onReset={() => apply({ sort: query.sort })}
                  columns
                  className="min-h-0"
                />
                )}
              </Popover>
            ) : (
              <Button type="button" onClick={() => setFiltersOpen(true)} className="gap-1.5">
                <SlidersHorizontal className="size-4" aria-hidden />
                Filters
                {activeFilters > 0 && (
                  <span className="rounded-full bg-brand px-1.5 font-num text-xs text-white">
                    {activeFilters}
                  </span>
                )}
              </Button>
            )}
            <label className="flex items-center gap-2 text-base text-ink-muted">
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
                className="rounded px-1.5 py-0.5 text-sm text-brand-ink hover:underline"
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        <div className="pt-4">
          <Panel>
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
                    {canShortlist && (
                      <LinkButton href="/shortlists" size="sm">
                        Open shortlists
                      </LinkButton>
                    )}
                  </div>
                }
              />
            ) : error ? (
              <ErrorState
                description={error}
                onRetry={() => router.refresh()}
              />
            ) : loading ? (
              <TableSkeleton rows={10} columns={8} />
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
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b border-rule px-4 py-3">
                  <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                    {QUICK_SORTS.map((option) => {
                      const active = query.sort === option.key;
                      return (
                        <button
                          key={option.key}
                          type="button"
                          aria-pressed={active}
                          onClick={() =>
                            apply({ ...query, sort: option.key }, { resetPage: false })
                          }
                          className={cn(
                            "press h-8 rounded-full px-3.5 text-sm font-semibold",
                            active
                              ? "bg-brand text-white shadow-brand"
                              : "bg-sunken text-ink-muted hover:bg-sunken-strong hover:text-ink",
                          )}
                        >
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-sm text-ink-muted">
                      <span className="font-num font-semibold text-ink">
                        {formatCompact(data.page.total)}
                      </span>{" "}
                      {data.page.total === 1 ? "creator" : "creators"}
                      {activeFilters > 0 && ` · ${pluralise(activeFilters, "filter")}`}
                      {selected.size > 0 && ` · ${selected.size} selected`}
                    </p>
                    <ButtonGroup aria-label="Result layout" className="hidden lg:inline-flex">
                      <SegmentButton
                        active={view === "cards"}
                        onClick={() => setView("cards")}
                        aria-label="Show as cards"
                        className="h-7 px-2.5"
                      >
                        <LayoutGrid className="size-4" aria-hidden />
                      </SegmentButton>
                      <SegmentButton
                        active={view === "table"}
                        onClick={() => setView("table")}
                        aria-label="Show as table"
                        className="h-7 px-2.5"
                      >
                        <List className="size-4" aria-hidden />
                      </SegmentButton>
                    </ButtonGroup>
                  </div>
                </div>

                {view === "cards" ? (
                  <ResultCards
                    items={data.page.items}
                    reasons={data.reasons}
                    onPreview={setPreviewId}
                    previewId={previewId}
                    selected={selected}
                    onToggleSelect={(id) =>
                      setSelected((previous) => {
                        const next = new Set(previous);
                        if (next.has(id)) next.delete(id);
                        else next.add(id);
                        return next;
                      })
                    }
                    onShortlist={
                      canShortlist
                        ? (item) => router.push(`/shortlists?add=${item.id}`)
                        : undefined
                    }
                  />
                ) : (
                <ResultTable
                  items={data.page.items}
                  sort={query.sort}
                  onSortChange={(sort) => apply({ ...query, sort }, { resetPage: false })}
                  onPreview={setPreviewId}
                  previewId={previewId}
                  selected={selected}
                  onToggleSelect={(id) =>
                    setSelected((previous) => {
                      const next = new Set(previous);
                      if (next.has(id)) next.delete(id);
                      else next.add(id);
                      return next;
                    })
                  }
                  onShortlist={
                    canShortlist
                      ? (item) => router.push(`/shortlists?add=${item.id}`)
                      : undefined
                  }
                />
                )}

                <Pagination
                  page={data.page.page}
                  pageSize={data.page.pageSize}
                  total={data.page.total}
                  onPageChange={(page) => apply({ ...query, page }, { resetPage: false })}
                />
              </>
            )}
          </Panel>

          <Sheet
            open={preview !== null}
            onClose={() => setPreviewId(null)}
            title="Creator intelligence"
          >
            {preview && (
              <CreatorPreview
                item={preview}
                selected={selected.has(preview.id)}
                onShortlist={
                  canShortlist
                    ? (item) => router.push(`/shortlists?add=${item.id}`)
                    : undefined
                }
                onCompare={(item) =>
                  setSelected((previous) => {
                    const next = new Set(previous);
                    if (next.has(item.id)) next.delete(item.id);
                    else next.add(item.id);
                    return next;
                  })
                }
              />
            )}
          </Sheet>

          <SelectionBar
            count={selected.size}
            onCompare={() =>
              router.push(`/compare?ids=${[...selected].join(",")}`)
            }
            onAddToShortlist={
              canShortlist
                ? () => router.push(`/shortlists?add=${[...selected].join(",")}`)
                : undefined
            }
            onAddToCampaign={campaigns.length > 0 ? () => setAddingToCampaign(true) : undefined}
            onClear={() => setSelected(new Set())}
          />

          {addingToCampaign && (
            <AddToCampaign
              campaigns={campaigns}
              count={selected.size}
              onClose={() => setAddingToCampaign(false)}
              onDone={() => {
                setAddingToCampaign(false);
                setSelected(new Set());
              }}
              influencerIds={[...selected]}
            />
          )}
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
