"use client";

import * as React from "react";
import { ArrowUpRight, Plus, Scale } from "lucide-react";
import {
  CATEGORY_LABEL,
  PLATFORM_LABEL,
  confidenceBand,
} from "@/lib/contracts/common";
import type { InfluencerSummary } from "@/lib/contracts/influencer";
import { formatCompact, formatPercent } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, LinkButton } from "@/components/ui/button";
import { RelativeTime } from "@/components/ui/relative-time";
import { ConfidenceMeter } from "@/components/intelligence/provenance";
import { RiskBadge, ScoreRing } from "@/components/intelligence/score";

/* ---------------------------------------------------------------------------
 * The intelligence preview.
 *
 * Discovery's job is a decision, and a decision needs more than a row of
 * columns: it needs the score, what is behind the score, and how much of it
 * was actually measured. This panel is the step between "found them" and
 * "opened the dossier" — it costs no extra request, because everything it
 * renders is already on the search result.
 *
 * What it deliberately does not do is invent the parts of the dossier it does
 * not hold. Audience demographics, brand safety detail and score components
 * live on the profile; the panel links there rather than showing a thinner
 * copy of them.
 * ------------------------------------------------------------------------ */

export function CreatorPreview({
  item,
  onShortlist,
  onCompare,
  selected,
}: {
  item: InfluencerSummary;
  onShortlist?: (item: InfluencerSummary) => void;
  onCompare?: (item: InfluencerSummary) => void;
  selected?: boolean;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-rule px-4 py-4">
        <div className="flex items-start gap-3">
          <Avatar
            name={item.displayName}
            src={item.avatarUrl}
            size="lg"
            verification={item.verification}
          />
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="truncate text-md font-semibold text-ink">
                {item.displayName}
              </span>
              {item.isDemo && (
                <span
                  className="label-caps-sm shrink-0 rounded-sm border border-caution-line bg-caution-soft px-1 py-px text-caution"
                  title="Demonstration record — figures were chosen, not measured."
                >
                  Demo
                </span>
              )}
            </p>
            <p className="mt-0.5 truncate text-sm text-ink-muted">
              <span className="font-num">@{item.primaryHandle}</span>
              <span aria-hidden> · </span>
              {item.platforms.map((platform) => PLATFORM_LABEL[platform]).join(", ")}
              {item.countryName && (
                <>
                  <span aria-hidden> · </span>
                  {item.countryName}
                </>
              )}
            </p>
            {item.categories.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-1">
                {item.categories.map((category) => (
                  <li key={category}>
                    <Badge tone="neutral">{CATEGORY_LABEL[category]}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 border-b border-rule px-4 py-4">
        <ScoreRing value={item.healthScore} size={80} />
        <div className="min-w-0 flex-1 space-y-2.5">
          <ConfidenceMeter
            confidence={{
              score: item.confidence,
              band: confidenceBand(item.confidence),
            }}
          />
          <div className="flex flex-wrap gap-1.5">
            <RiskBadge level={item.risk} />
            {item.verification === "verified" ? (
              <Badge tone="brand" dot>
                SocialOrbit Verified
              </Badge>
            ) : (
              <Badge tone="neutral">Not identity-verified</Badge>
            )}
          </div>
        </div>
      </div>

      <dl className="grid grid-cols-2 divide-x divide-y divide-rule border-b border-rule">
        <PreviewFigure label="Followers" value={formatCompact(item.followers)} />
        <PreviewFigure label="Median views" value={formatCompact(item.medianViews)} />
        <PreviewFigure label="Engagement" value={formatPercent(item.engagementRate)} />
        <PreviewFigure
          label="Campaign fit"
          value={item.campaignFit === null ? "—" : String(Math.round(item.campaignFit))}
        />
      </dl>

      <div className="space-y-3 px-4 py-4 text-sm">
        <p className="text-ink-muted">
          Last observed{" "}
          <span className="text-ink">
            <RelativeTime at={item.lastActiveAt} />
          </span>
          .{" "}
          {item.risk === "unknown"
            ? "No audience-quality signal was measurable — that requires authorised access, and is reported as unknown rather than as low risk."
            : "Risk is set by the strongest single signal, not by an average of them."}
        </p>
        {item.languages.length > 0 && (
          <p className="text-ink-muted">
            Publishes in{" "}
            <span className="text-ink">{item.languages.join(", ")}</span>.
          </p>
        )}
      </div>

      <div className="mt-auto flex flex-wrap gap-2 border-t border-rule bg-sunken/50 px-4 py-3">
        <LinkButton
          href={`/influencers/${item.id}`}
          variant="primary"
          size="sm"
          className="gap-1.5"
        >
          Full intelligence
          <ArrowUpRight className="size-3.5" aria-hidden />
        </LinkButton>
        {onShortlist && (
          <Button size="sm" onClick={() => onShortlist(item)} className="gap-1.5">
            <Plus className="size-3.5" aria-hidden />
            Shortlist
          </Button>
        )}
        {onCompare && (
          <Button size="sm" onClick={() => onCompare(item)} className="gap-1.5">
            <Scale className="size-3.5" aria-hidden />
            {selected ? "Deselect" : "Compare"}
          </Button>
        )}
      </div>
    </div>
  );
}

function PreviewFigure({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="px-4 py-2.5">
      <dt className="label-caps-sm text-ink-subtle">{label}</dt>
      <dd className="font-num text-stat font-medium text-ink">{value}</dd>
    </div>
  );
}
