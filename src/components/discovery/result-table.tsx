"use client";

import * as React from "react";
import Link from "next/link";
import { PanelRight, Plus } from "lucide-react";
import { cn } from "@/lib/class-names";
import {
  ActivityStatus,
  CATEGORY_LABEL,
  PLATFORM_LABEL,
  confidenceBand,
  type Platform,
} from "@/lib/contracts/common";
import type { InfluencerSummary } from "@/lib/contracts/influencer";
import type { SortKey } from "@/lib/contracts/search";
import { formatCompact, formatPercent } from "@/lib/format";
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
import { RiskBadge, RiskDot, ScorePill } from "@/components/intelligence/score";
import { RelativeTime } from "@/components/ui/relative-time";

/* ---------------------------------------------------------------------------
 * Search results — DPR §11.4.
 *
 * A real table on desktop because the comparison the user is doing is across
 * rows, and a card grid destroys column alignment. Below `lg` it becomes a
 * stacked card list, which is a different information hierarchy rather than a
 * squeezed version of the same one.
 * ------------------------------------------------------------------------ */

const ACTIVITY: Record<
  ActivityStatus,
  { label: string; tone: "positive" | "neutral" | "caution" | "critical"; dot: string }
> = {
  active: { label: "Active", tone: "positive", dot: "bg-positive" },
  recently_active: { label: "Recent", tone: "neutral", dot: "bg-neutral-metric" },
  slowing: { label: "Slowing", tone: "caution", dot: "bg-caution" },
  dormant: { label: "Dormant", tone: "critical", dot: "bg-critical" },
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
  onPreview,
  previewId,
}: {
  items: InfluencerSummary[];
  sort: SortKey;
  onSortChange: (sort: SortKey) => void;
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  /** Omitted where shortlists are not reachable, e.g. the operator view. */
  onShortlist?: (item: InfluencerSummary) => void;
  /** Opens the intelligence preview for a row. */
  onPreview?: (id: string) => void;
  previewId?: string | null;
}) {
  return (
    <>
      {/* A bounded viewport with the header pinned inside it. A page-scrolling
          table takes its column labels off screen by row twelve, and every
          figure below that becomes an unlabelled number. `max-h` rather than
          `h`: a short result set must not be stretched to fill the frame. */}
      <TableWrap
        label="Influencer search results"
        className="hidden max-h-[calc(100dvh-var(--spacing-topbar)-11rem)] overflow-y-auto lg:block"
      >
        <Table>
          <Thead className="sticky top-0 z-10 bg-surface/95 backdrop-blur supports-[backdrop-filter]:bg-surface/85">
            <Tr>
              <Th className="w-9 pr-0">
                <span className="sr-only">Select</span>
              </Th>
              <Th className="w-[15.5rem]">Creator</Th>
              {/* Audience size and typical reach are one reading, not two
                  columns: median views is only meaningful *against* the
                  follower count sitting above it. Pairing them also buys back
                  the width the filter rail costs. */}
              <SortableTh
                label="Audience"
                numeric
                active={
                  sort === SORT_FOR_COLUMN.followers || sort === SORT_FOR_COLUMN.medianViews
                }
                onSort={() =>
                  onSortChange(
                    sort === SORT_FOR_COLUMN.followers
                      ? SORT_FOR_COLUMN.medianViews!
                      : SORT_FOR_COLUMN.followers!,
                  )
                }
              />
              <SortableTh
                label="Engagement"
                numeric
                active={sort === SORT_FOR_COLUMN.engagement}
                onSort={() => onSortChange(SORT_FOR_COLUMN.engagement!)}
              />
              {/* The product's headline artifact, and the column the whole
                  screen is sorted around — set apart by a rule and a heavier
                  figure rather than by colour, which is spent elsewhere. */}
              <SortableTh
                label="Health"
                numeric
                active={sort === SORT_FOR_COLUMN.health}
                onSort={() => onSortChange(SORT_FOR_COLUMN.health!)}
                className="border-l border-rule"
              />
              <Th numeric>Confidence</Th>
              <Th className="border-l border-rule">Signals</Th>
              <Th className="text-right">
                <span className="sr-only">Actions</span>
              </Th>
            </Tr>
          </Thead>
          <Tbody>
            {items.map((item) => (
              <Tr
                key={item.id}
                selected={selected.has(item.id)}
                interactive={Boolean(onPreview)}
                aria-current={previewId === item.id ? "true" : undefined}
                className={cn("[&>td]:py-2.5", previewId === item.id && "bg-brand-softer")}
                onClick={
                  onPreview
                    ? (event) => {
                        // Never hijack a click that was already meaningful:
                        // the name is a link to the full dossier and the
                        // checkbox is selection, both of which live in the row.
                        const target = event.target as HTMLElement;
                        if (target.closest("a,button,input,label")) return;
                        onPreview(item.id);
                      }
                    : undefined
                }
              >
                <Td className="pr-0">
                  <input
                    type="checkbox"
                    checked={selected.has(item.id)}
                    onChange={() => onToggleSelect(item.id)}
                    aria-label={`Select ${item.displayName} for comparison`}
                    className="size-3.5 cursor-pointer rounded accent-brand"
                  />
                </Td>
                {/* Bounded, because the table is `min-w-max`: without a cap
                    the widest category list in the page decides the column
                    width, and `truncate` inside it never fires. */}
                <Td className="max-w-[15.5rem]">
                  <CreatorCell item={item} />
                </Td>
                <Td numeric>
                  <span className="block leading-tight">{formatCompact(item.followers)}</span>
                  <span
                    className="block text-xs text-ink-subtle"
                    title="Median views per post"
                  >
                    {formatCompact(item.medianViews)} views
                  </span>
                </Td>
                <Td numeric>{formatPercent(item.engagementRate)}</Td>
                <Td numeric className="border-l border-rule">
                  <ScorePill value={item.healthScore} label="Health" size="lg" />
                </Td>
                <Td numeric>
                  <ConfidenceMeter
                    compact
                    confidence={{
                      score: item.confidence,
                      band: confidenceBand(item.confidence),
                    }}
                  />
                </Td>
                <Td className="border-l border-rule">
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    <RiskDot level={item.risk} />
                    <span
                      className={cn("size-1.5 shrink-0 rounded-full", ACTIVITY[item.activity].dot)}
                      title={`${ACTIVITY[item.activity].label} — publication cadence`}
                      aria-hidden
                    />
                    <span className="sr-only">{ACTIVITY[item.activity].label}.</span>
                    <LastActive at={item.lastActiveAt} />
                  </div>
                </Td>
                <Td className="text-right">
                  {/* Icon-only in the table: a labelled button per row cost
                      the width the decision columns needed, and the preview
                      this row opens carries the same action spelled out. */}
                  <div className="flex items-center justify-end gap-0.5">
                    {onShortlist && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onShortlist(item)}
                        aria-label={`Add ${item.displayName} to a shortlist`}
                        title="Add to a shortlist"
                        className="px-1.5"
                      >
                        <Plus className="size-3.5" aria-hidden />
                      </Button>
                    )}
                    {onPreview && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onPreview(item.id)}
                        aria-label={`Preview intelligence for ${item.displayName}`}
                        title="Open intelligence preview"
                        className="px-1.5"
                      >
                        <PanelRight className="size-3.5" aria-hidden />
                      </Button>
                    )}
                  </div>
                </Td>
              </Tr>
            ))}
          </Tbody>
        </Table>
      </TableWrap>

      {/* Below lg the same records read as cards — and the hierarchy changes
          with the shape, rather than the desktop columns being stacked. On a
          phone the decision is made on one number, so the score leads at the
          top right and everything else is a supporting line under the name.
          Stacking eight equal cells instead just made the table taller. */}
      <ul className="divide-y divide-rule lg:hidden">
        {items.map((item) => (
          <li key={item.id} className="px-4 py-3">
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

                <dl className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-sm">
                  <div className="flex items-baseline gap-1.5">
                    <dt className="text-ink-subtle">Audience</dt>
                    <dd className="font-num text-ink">{formatCompact(item.followers)}</dd>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <dt className="text-ink-subtle">Engagement</dt>
                    <dd className="font-num text-ink">
                      {formatPercent(item.engagementRate)}
                    </dd>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <dt className="text-ink-subtle">Confidence</dt>
                    <dd className="font-num text-ink">{Math.round(item.confidence)}%</dd>
                  </div>
                </dl>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <RiskBadge level={item.risk} />
                  <Badge tone={ACTIVITY[item.activity].tone} dot>
                    {ACTIVITY[item.activity].label}
                  </Badge>
                  <LastActive at={item.lastActiveAt} />
                </div>
              </div>

              {/* The one figure the decision turns on, given the weight the
                  desktop table gives its own column. */}
              <div className="shrink-0 text-right">
                <span className="label-caps-sm block text-ink-subtle">Health</span>
                <ScorePill value={item.healthScore} label="Health" size="lg" />
              </div>
            </div>

            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              {onPreview && (
                <Button
                  size="sm"
                  onClick={() => onPreview(item.id)}
                  aria-label={`Preview intelligence for ${item.displayName}`}
                  className="gap-1.5"
                >
                  <PanelRight className="size-3.5" aria-hidden />
                  Intelligence
                </Button>
              )}
              {onShortlist && (
                <Button
                  size="sm"
                  onClick={() => onShortlist(item)}
                  // Named for the creator, matching the table view. A list of
                  // 25 buttons all announcing "Shortlist" gives a screen
                  // reader user no way to tell which one they are on.
                  aria-label={`Add ${item.displayName} to a shortlist`}
                  className="gap-1.5"
                >
                  <Plus className="size-3.5" aria-hidden />
                  Shortlist
                </Button>
              )}
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
        <div className="flex min-w-0 items-center gap-1.5">
          <Link prefetch={false}
            href={`/influencers/${item.id}`}
            className="truncate rounded text-base font-medium text-ink hover:text-brand-ink hover:underline"
          >
            {item.displayName}
          </Link>
          {/* On the name line, not under it: a stacked chip made every demo
              row three lines tall and broke the table's two-line rhythm. */}
          {item.isDemo && (
            <span
              className="shrink-0 rounded-sm border border-caution-line bg-caution-soft px-1 py-px label-caps-sm text-caution"
              title="Demonstration record — figures were chosen, not measured."
            >
              Demo
            </span>
          )}
        </div>
        <p className="truncate text-sm text-ink-muted">
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
          {/* Two categories and a count. A creator carrying five of them was
              setting the column width for all twenty-five rows. */}
          {item.categories.slice(0, 2).map((c) => CATEGORY_LABEL[c]).join(", ")}
          {item.categories.length > 2 && (
            <span className="font-num"> +{item.categories.length - 2}</span>
          )}
        </p>
      </div>
    </div>
  );
}

/** Selection bar shown once the user has picked creators to compare. */
export function SelectionBar({
  count,
  onCompare,
  onAddToCampaign,
  onAddToShortlist,
  onClear,
  className,
}: {
  count: number;
  onCompare: () => void;
  /** Absent when the plan or the role does not allow campaigns. */
  onAddToCampaign?: () => void;
  onAddToShortlist?: () => void;
  onClear: () => void;
  className?: string;
}) {
  if (count === 0) return null;
  // Light chrome: the instrument surface belongs to the score readout alone,
  // so the tray floats on shadow and a strong hairline, with the committed
  // action carried by the ink-primary button.
  return (
    <div
      role="status"
      className={cn(
        "sticky bottom-4 z-20 mx-auto flex w-fit items-center gap-3 rounded-lg border border-line-strong",
        "bg-surface px-3 py-2 text-base text-ink shadow-overlay",
        className,
      )}
    >
      <span className="font-num">{count}</span>
      <span className="text-ink-muted">selected</span>
      <span className="h-4 w-px bg-line-strong" aria-hidden />
      <Button size="sm" variant="primary" onClick={onCompare} disabled={count < 2}>
        Compare
      </Button>
      {onAddToShortlist && (
        <Button size="sm" variant="secondary" onClick={onAddToShortlist}>
          Add to shortlist
        </Button>
      )}
      {onAddToCampaign && (
        <Button size="sm" variant="secondary" onClick={onAddToCampaign}>
          Add to campaign
        </Button>
      )}
      <Button size="sm" variant="ghost" onClick={onClear}>
        Clear
      </Button>
      {count < 2 && (
        <span className="text-sm text-ink-muted">Select at least two</span>
      )}
    </div>
  );
}

/** Relative-time cell, exported for reuse by the shortlist and campaign tables. */
export function LastActive({ at }: { at: string | null }) {
  return <RelativeTime at={at} className="text-sm text-ink-muted" />;
}
