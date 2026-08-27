"use client";

import * as React from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  ActivityStatus,
  CATEGORY_LABEL,
  PLATFORM_LABEL,
  type Platform,
} from "@/lib/contracts/common";
import type { InfluencerSummary } from "@/lib/contracts/influencer";
import type { SortKey } from "@/lib/contracts/search";
import { formatCompact, formatPercent, formatRelativeTime } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  SortableTh,
  Table,
  TableWrap,
  Tbody,
  Td,
  Th,
  Thead,
  Tr,
} from "@/components/ui/table";
import { ConfidenceMeter } from "@/components/intelligence/provenance";
import { RiskBadge, ScorePill } from "@/components/intelligence/score";

/* ---------------------------------------------------------------------------
 * Search results — DPR §11.4.
 *
 * A real table on desktop because the comparison the user is doing is across
 * rows, and a card grid destroys column alignment. Below `lg` it becomes a
 * stacked card list, which is a different information hierarchy rather than a
 * squeezed version of the same one.
 * ------------------------------------------------------------------------ */

const ACTIVITY: Record<ActivityStatus, { label: string; tone: "positive" | "neutral" | "caution" | "critical" }> = {
  active: { label: "Active", tone: "positive" },
  recently_active: { label: "Recent", tone: "neutral" },
  slowing: { label: "Slowing", tone: "caution" },
  dormant: { label: "Dormant", tone: "critical" },
};

const SORT_FOR_COLUMN: Partial<Record<string, SortKey>> = {
  followers: "followers_desc",
  engagement: "engagement_desc",
  medianViews: "median_views_desc",
  health: "health_score_desc",
  fit: "campaign_fit_desc",
  lastActive: "last_active_desc",
};

export function ResultTable({
  items,
  sort,
  onSortChange,
  selected,
  onToggleSelect,
  onShortlist,
}: {
  items: InfluencerSummary[];
  sort: SortKey;
  onSortChange: (sort: SortKey) => void;
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  onShortlist: (item: InfluencerSummary) => void;
}) {
  return (
    <>
      <TableWrap label="Influencer search results" className="hidden lg:block">
        <Table>
          <Thead>
            <Tr>
              <Th className="w-9 pr-0">
                <span className="sr-only">Select</span>
              </Th>
              <Th>Creator</Th>
              <SortableTh
                label="Followers"
                numeric
                active={sort === SORT_FOR_COLUMN.followers}
                onSort={() => onSortChange(SORT_FOR_COLUMN.followers!)}
              />
              <SortableTh
                label="Median views"
                numeric
                active={sort === SORT_FOR_COLUMN.medianViews}
                onSort={() => onSortChange(SORT_FOR_COLUMN.medianViews!)}
              />
              <SortableTh
                label="Engagement"
                numeric
                active={sort === SORT_FOR_COLUMN.engagement}
                onSort={() => onSortChange(SORT_FOR_COLUMN.engagement!)}
              />
              <SortableTh
                label="Health"
                numeric
                active={sort === SORT_FOR_COLUMN.health}
                onSort={() => onSortChange(SORT_FOR_COLUMN.health!)}
              />
              <SortableTh
                label="Fit"
                numeric
                active={sort === SORT_FOR_COLUMN.fit}
                onSort={() => onSortChange(SORT_FOR_COLUMN.fit!)}
              />
              <Th>Confidence</Th>
              <Th>Status</Th>
              <Th className="text-right">
                <span className="sr-only">Actions</span>
              </Th>
            </Tr>
          </Thead>
          <Tbody>
            {items.map((item) => (
              <Tr key={item.id} selected={selected.has(item.id)}>
                <Td className="pr-0">
                  <input
                    type="checkbox"
                    checked={selected.has(item.id)}
                    onChange={() => onToggleSelect(item.id)}
                    aria-label={`Select ${item.displayName} for comparison`}
                    className="size-3.5 cursor-pointer rounded accent-brand"
                  />
                </Td>
                <Td>
                  <CreatorCell item={item} />
                </Td>
                <Td numeric>{formatCompact(item.followers)}</Td>
                <Td numeric>{formatCompact(item.medianViews)}</Td>
                <Td numeric>{formatPercent(item.engagementRate)}</Td>
                <Td numeric>
                  <ScorePill value={item.healthScore} label="Health" />
                </Td>
                <Td numeric>
                  <ScorePill value={item.campaignFit} label="Campaign fit" />
                </Td>
                <Td>
                  <ConfidenceMeter
                    compact
                    confidence={{
                      score: item.confidence,
                      band:
                        item.confidence >= 90
                          ? "high"
                          : item.confidence >= 70
                            ? "good"
                            : item.confidence >= 50
                              ? "moderate"
                              : "preliminary",
                    }}
                  />
                </Td>
                <Td>
                  <div className="flex items-center gap-1">
                    <RiskBadge level={item.risk} />
                    <Badge tone={ACTIVITY[item.activity].tone} dot>
                      {ACTIVITY[item.activity].label}
                    </Badge>
                  </div>
                </Td>
                <Td className="text-right">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => onShortlist(item)}
                    aria-label={`Add ${item.displayName} to a shortlist`}
                    className="gap-1"
                  >
                    <Plus className="size-3.5" aria-hidden />
                    Shortlist
                  </Button>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </TableWrap>

      {/* Below lg the same records read as cards: the columns a table needs
          simply do not fit, and a horizontally scrolling table hides the
          metrics that drive the decision. */}
      <ul className="divide-y divide-line lg:hidden">
        {items.map((item) => (
          <li key={item.id} className="p-4">
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={selected.has(item.id)}
                onChange={() => onToggleSelect(item.id)}
                aria-label={`Select ${item.displayName} for comparison`}
                className="mt-1 size-3.5 shrink-0 cursor-pointer rounded accent-brand"
              />
              <div className="min-w-0 flex-1">
                <CreatorCell item={item} />
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
                  <Metric label="Followers" value={formatCompact(item.followers)} />
                  <Metric label="Median views" value={formatCompact(item.medianViews)} />
                  <Metric label="Engagement" value={formatPercent(item.engagementRate)} />
                  <Metric
                    label="Health"
                    value={<ScorePill value={item.healthScore} label="Health" />}
                  />
                </dl>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <RiskBadge level={item.risk} />
                  <Badge tone={ACTIVITY[item.activity].tone} dot>
                    {ACTIVITY[item.activity].label}
                  </Badge>
                  <Button
                    size="sm"
                    onClick={() => onShortlist(item)}
                    className="ml-auto gap-1"
                  >
                    <Plus className="size-3.5" aria-hidden />
                    Shortlist
                  </Button>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

function CreatorCell({ item }: { item: InfluencerSummary }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <Avatar
        name={item.displayName}
        src={item.avatarUrl}
        size="sm"
        verification={item.verification}
      />
      <div className="min-w-0">
        <Link
          href={`/influencers/${item.id}`}
          className="block truncate rounded text-[13px] font-medium text-ink hover:text-brand-ink hover:underline"
        >
          {item.displayName}
        </Link>
        <p className="truncate text-[12px] text-ink-muted">
          <span className="font-num">@{item.primaryHandle}</span>
          <span aria-hidden> · </span>
          {item.platforms.map((p: Platform) => PLATFORM_LABEL[p]).join(", ")}
          {item.countryName && (
            <>
              <span aria-hidden> · </span>
              {item.countryName}
            </>
          )}
          <span aria-hidden> · </span>
          {item.categories.map((c) => CATEGORY_LABEL[c]).join(", ")}
        </p>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-[0.05em] text-ink-muted">{label}</dt>
      <dd className="font-num text-[13px] tabular-nums text-ink">{value}</dd>
    </div>
  );
}

/** Selection bar shown once the user has picked creators to compare. */
export function SelectionBar({
  count,
  onCompare,
  onClear,
  className,
}: {
  count: number;
  onCompare: () => void;
  onClear: () => void;
  className?: string;
}) {
  if (count === 0) return null;
  return (
    <div
      role="status"
      className={cn(
        "sticky bottom-4 z-20 mx-auto flex w-fit items-center gap-3 rounded-lg border border-line",
        "bg-ink px-3 py-2 text-[13px] text-ink-inverse shadow-overlay",
        className,
      )}
    >
      <span className="font-num tabular-nums">{count}</span>
      <span>selected</span>
      <span className="h-4 w-px bg-white/20" aria-hidden />
      <button
        type="button"
        onClick={onCompare}
        disabled={count < 2}
        className="rounded px-2 py-1 font-medium text-white transition-colors hover:bg-white/10 disabled:text-white/40 disabled:hover:bg-transparent"
      >
        Compare
      </button>
      <button
        type="button"
        onClick={onClear}
        className="rounded px-2 py-1 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
      >
        Clear
      </button>
      {count < 2 && (
        <span className="text-[12px] text-white/50">Select at least two</span>
      )}
    </div>
  );
}

/** Relative-time cell, exported for reuse by the shortlist and campaign tables. */
export function LastActive({ at }: { at: string | null }) {
  return <span className="text-[12px] text-ink-muted">{formatRelativeTime(at)}</span>;
}
