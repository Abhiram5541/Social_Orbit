"use client";

import * as React from "react";
import { RotateCcw } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  ActivityStatus,
  CATEGORY_LABEL,
  Category,
  PLATFORM_LABEL,
  Platform,
  RiskLevel,
  VerificationStatus,
} from "@/lib/contracts/common";
import {
  FOLLOWER_BANDS,
  type FollowerBand,
  type SearchFacet,
  type SearchQuery,
} from "@/lib/contracts/search";
import { formatCompact } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/field";

/* ---------------------------------------------------------------------------
 * Discovery filters — DPR §11.2.
 *
 * Every control writes into one `SearchQuery`, which is also the URL state and
 * the API contract, so a filtered view is always shareable and reproducible.
 * ------------------------------------------------------------------------ */

export type Draft = Partial<SearchQuery>;

const ACTIVITY_LABEL: Record<ActivityStatus, string> = {
  active: "Active",
  recently_active: "Recently active",
  slowing: "Slowing",
  dormant: "Dormant",
};

const VERIFICATION_LABEL: Record<VerificationStatus, string> = {
  verified: "SocialOrbit Verified",
  pending: "Connection pending",
  unverified: "Unverified",
};

const RISK_LABEL: Record<RiskLevel, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export function FilterPanel({
  draft,
  facets,
  onChange,
  onReset,
  className,
}: {
  draft: Draft;
  facets: SearchFacet[];
  onChange: (next: Draft) => void;
  onReset: () => void;
  className?: string;
}) {
  const facetCount = React.useCallback(
    (key: string, value: string) =>
      facets.find((facet) => facet.key === key)?.buckets.find((b) => b.value === value)?.count,
    [facets],
  );

  function toggle<K extends keyof Draft>(key: K, value: string) {
    const current = (draft[key] as string[] | undefined) ?? [];
    const next = current.includes(value)
      ? current.filter((item) => item !== value)
      : [...current, value];
    onChange({ ...draft, [key]: next.length ? next : undefined });
  }

  function setNumber(key: keyof Draft, raw: string) {
    const value = raw.trim() === "" ? undefined : Number(raw);
    onChange({ ...draft, [key]: Number.isFinite(value) ? value : undefined });
  }

  return (
    <div className={cn("flex flex-col", className)}>
      <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5">
        <Eyebrow>Filters</Eyebrow>
        <Button variant="ghost" size="sm" onClick={onReset} className="gap-1.5">
          <RotateCcw className="size-3.5" aria-hidden />
          Reset
        </Button>
      </div>

      <div className="min-h-0 flex-1 divide-y divide-line overflow-y-auto">
        <Group title="Platform" defaultOpen>
          {Platform.options
            .filter((platform) => platform !== "tiktok")
            .map((platform) => (
              <CheckRow
                key={platform}
                label={PLATFORM_LABEL[platform]}
                count={facetCount("platform", platform)}
                checked={(draft.platform ?? []).includes(platform)}
                onChange={() => toggle("platform", platform)}
              />
            ))}
          <p className="px-1 pt-1 text-[11px] text-ink-subtle">
            TikTok is not yet connected — no creators are indexed for it.
          </p>
        </Group>

        <Group title="Verification" defaultOpen>
          {VerificationStatus.options.map((status) => (
            <CheckRow
              key={status}
              label={VERIFICATION_LABEL[status]}
              count={facetCount("verification", status)}
              checked={(draft.verification ?? []).includes(status)}
              onChange={() => toggle("verification", status)}
            />
          ))}
        </Group>

        <Group title="Audience size" defaultOpen>
          {(Object.keys(FOLLOWER_BANDS) as FollowerBand[]).map((band) => (
            <CheckRow
              key={band}
              label={FOLLOWER_BANDS[band].label}
              checked={(draft.followerBand ?? []).includes(band)}
              onChange={() => toggle("followerBand", band)}
            />
          ))}
          <div className="grid grid-cols-2 gap-2 pt-2">
            <Field label="Min followers">
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                placeholder="0"
                defaultValue={draft.followersMin ?? ""}
                onBlur={(event) => setNumber("followersMin", event.currentTarget.value)}
              />
            </Field>
            <Field label="Max followers">
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                placeholder="Any"
                defaultValue={draft.followersMax ?? ""}
                onBlur={(event) => setNumber("followersMax", event.currentTarget.value)}
              />
            </Field>
          </div>
        </Group>

        <Group title="Category">
          <div className="max-h-56 overflow-y-auto pr-1">
            {Category.options.map((category) => {
              const count = facetCount("category", category);
              if (count === undefined && !(draft.category ?? []).includes(category)) return null;
              return (
                <CheckRow
                  key={category}
                  label={CATEGORY_LABEL[category]}
                  count={count}
                  checked={(draft.category ?? []).includes(category)}
                  onChange={() => toggle("category", category)}
                />
              );
            })}
          </div>
        </Group>

        <Group title="Location">
          <div className="max-h-48 overflow-y-auto pr-1">
            {facets
              .find((facet) => facet.key === "country")
              ?.buckets.map((bucket) => (
                <CheckRow
                  key={bucket.value}
                  label={bucket.label}
                  count={bucket.count}
                  checked={(draft.country ?? []).includes(bucket.value)}
                  onChange={() => toggle("country", bucket.value)}
                />
              ))}
          </div>
        </Group>

        <Group title="Performance">
          <Field label="Min engagement rate (%)">
            <Input
              type="number"
              step="0.1"
              min={0}
              placeholder="Any"
              defaultValue={draft.engagementMin ?? ""}
              onBlur={(event) => setNumber("engagementMin", event.currentTarget.value)}
            />
          </Field>
          <Field label="Min median views" className="pt-2">
            <Input
              type="number"
              min={0}
              placeholder="Any"
              defaultValue={draft.medianViewsMin ?? ""}
              onBlur={(event) => setNumber("medianViewsMin", event.currentTarget.value)}
            />
          </Field>
        </Group>

        <Group title="Quality">
          <RangeRow
            label="Minimum health score"
            value={draft.healthMin}
            onChange={(value) => onChange({ ...draft, healthMin: value })}
          />
          <RangeRow
            label="Minimum campaign fit"
            value={draft.campaignFitMin}
            onChange={(value) => onChange({ ...draft, campaignFitMin: value })}
          />
        </Group>

        <Group title="Risk">
          {RiskLevel.options.map((level) => (
            <CheckRow
              key={level}
              label={RISK_LABEL[level]}
              checked={(draft.risk ?? []).includes(level)}
              onChange={() => toggle("risk", level)}
            />
          ))}
        </Group>

        <Group title="Activity">
          {ActivityStatus.options.map((status) => (
            <CheckRow
              key={status}
              label={ACTIVITY_LABEL[status]}
              checked={(draft.activity ?? []).includes(status)}
              onChange={() => toggle("activity", status)}
            />
          ))}
        </Group>
      </div>
    </div>
  );
}

/**
 * A native <details> disclosure — it is keyboard operable and announced
 * correctly without a line of JavaScript.
 */
function Group({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details open={defaultOpen} className="group px-4 py-2.5">
      <summary className="flex cursor-pointer list-none items-center justify-between py-1 text-[13px] font-medium text-ink marker:hidden">
        {title}
        <svg viewBox="0 0 12 12" className="size-3 text-ink-subtle transition-transform group-open:rotate-180" aria-hidden>
          <path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>
      <div className="pt-1.5">{children}</div>
    </details>
  );
}

function CheckRow({
  label,
  count,
  checked,
  onChange,
}: {
  label: string;
  count?: number;
  checked: boolean;
  onChange: () => void;
}) {
  const id = React.useId();
  return (
    <div className="flex items-center gap-2 py-1">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="size-3.5 shrink-0 cursor-pointer rounded accent-brand"
      />
      <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer truncate text-[13px] text-ink">
        {label}
      </label>
      {count !== undefined && (
        <span className="shrink-0 font-num text-[11px] tabular-nums text-ink-subtle">
          {formatCompact(count)}
        </span>
      )}
    </div>
  );
}

function RangeRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | undefined;
  onChange: (value: number | undefined) => void;
}) {
  const id = React.useId();
  return (
    <div className="py-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-[12px] text-ink-muted">
          {label}
        </label>
        <span className="font-num text-[12px] tabular-nums text-ink">
          {value === undefined ? "Any" : value}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="range"
          min={0}
          max={100}
          step={5}
          value={value ?? 0}
          onChange={(event) => {
            const next = Number(event.currentTarget.value);
            onChange(next === 0 ? undefined : next);
          }}
          className="mt-1 h-1 w-full cursor-pointer accent-brand"
        />
      </div>
    </div>
  );
}
