"use client";

import * as React from "react";
import Link from "next/link";
import { PanelRight, Plus } from "lucide-react";
import { cn } from "@/lib/class-names";
import { CATEGORY_LABEL, PLATFORM_LABEL } from "@/lib/contracts/common";
import type { InfluencerSummary } from "@/lib/contracts/influencer";
import { formatCompact, formatPercent } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RiskDot, ScorePill } from "@/components/intelligence/score";
import { LastActive } from "./result-table";

/* ---------------------------------------------------------------------------
 * Search results as a card grid.
 *
 * The browsing view: a face, a name, the score, and the three figures a first
 * pass is made on. The table view stays one toggle away for the comparison
 * pass, where column alignment matters more than faces.
 * ------------------------------------------------------------------------ */

export function ResultCards({
  items,
  selected,
  onToggleSelect,
  onShortlist,
  onPreview,
  previewId,
}: {
  items: InfluencerSummary[];
  selected: Set<string>;
  onToggleSelect: (id: string) => void;
  onShortlist?: (item: InfluencerSummary) => void;
  onPreview?: (id: string) => void;
  previewId?: string | null;
}) {
  return (
    <ul className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => {
        const isSelected = selected.has(item.id);
        const open = previewId === item.id;
        return (
          <li
            key={item.id}
            className={cn(
              "lift relative flex flex-col rounded-xl bg-sunken/60 p-4 transition-colors",
              open && "bg-brand-softer ring-2 ring-brand-line",
              isSelected && "ring-2 ring-brand",
            )}
          >
            <div className="flex items-start gap-3">
              <Avatar
                name={item.displayName}
                src={item.avatarUrl}
                size="lg"
                verification={item.verification}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <Link prefetch={false}
                    href={`/influencers/${item.id}`}
                    className="min-w-0 truncate rounded-md font-display text-md font-bold text-ink hover:text-brand-ink"
                  >
                    {item.displayName}
                  </Link>
                  {item.isDemo && <Badge tone="caution">Demo</Badge>}
                </div>
                <p className="mt-0.5 truncate text-sm text-ink-muted">
                  @{item.primaryHandle}
                  <span aria-hidden> · </span>
                  {PLATFORM_LABEL[item.primaryPlatform]}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {item.categories.slice(0, 2).map((category) => (
                    <Badge key={category} tone="neutral">
                      {CATEGORY_LABEL[category]}
                    </Badge>
                  ))}
                  <span className="inline-flex items-center gap-1.5 text-xs text-ink-subtle">
                    <RiskDot level={item.risk} />
                    <LastActive at={item.lastActiveAt} />
                  </span>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <span className="block text-xs font-medium text-ink-subtle">Health</span>
                <ScorePill value={item.healthScore} label="Health" size="lg" />
              </div>
            </div>

            <dl className="mt-4 grid grid-cols-3 divide-x divide-line rounded-lg bg-surface py-3 text-center">
              <div className="px-2">
                <dd className="font-num text-md font-bold text-ink">
                  {formatCompact(item.followers)}
                </dd>
                <dt className="mt-0.5 text-xs text-ink-subtle">Followers</dt>
              </div>
              <div className="px-2">
                <dd className="font-num text-md font-bold text-ink">
                  {formatPercent(item.engagementRate)}
                </dd>
                <dt className="mt-0.5 text-xs text-ink-subtle">Engagement</dt>
              </div>
              <div className="px-2">
                <dd className="font-num text-md font-bold text-ink">
                  {Math.round(item.confidence)}%
                </dd>
                <dt className="mt-0.5 text-xs text-ink-subtle">Confidence</dt>
              </div>
            </dl>

            <div className="mt-3 flex items-center gap-2">
              <label className="flex cursor-pointer items-center gap-2 rounded-full bg-surface py-1.5 pl-2.5 pr-3 text-sm font-medium text-ink-muted hover:text-ink">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onToggleSelect(item.id)}
                  aria-label={`Select ${item.displayName} for comparison`}
                  className="size-3.5 cursor-pointer rounded accent-brand"
                />
                Compare
              </label>
              <span className="flex-1" />
              {onPreview && (
                <Button
                  size="icon"
                  variant="secondary"
                  onClick={() => onPreview(item.id)}
                  aria-label={`Preview intelligence for ${item.displayName}`}
                  className="size-9"
                >
                  <PanelRight className="size-4" aria-hidden />
                </Button>
              )}
              {onShortlist && (
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => onShortlist(item)}
                  aria-label={`Add ${item.displayName} to a shortlist`}
                  className="gap-1.5"
                >
                  <Plus className="size-3.5" aria-hidden />
                  Shortlist
                </Button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
