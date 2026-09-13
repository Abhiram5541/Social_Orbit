import * as React from "react";
import {
  BadgeCheck,
  CircleDot,
  ExternalLink,
  Sigma,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/class-names";
import {
  HEALTH_COMPONENT_LABEL,
  HEALTH_WEIGHTS,
  type HealthComponentKey,
} from "@/lib/contracts/score";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScoreBar, ScorePill, ScoreRing } from "@/components/intelligence/score";
import {
  SPECIMEN_CAMPAIGN,
  SPECIMEN_COMPONENTS,
  SPECIMEN_DOSSIER,
  SPECIMEN_ENRICHMENT,
  SPECIMEN_FACETS,
  SPECIMEN_QUALITY_POINTS,
  SPECIMEN_RESULTS,
} from "./specimen";

/* ---------------------------------------------------------------------------
 * Product surfaces for the marketing site.
 *
 * These are not screenshots. Each one composes the same components the
 * application renders — the score instrument, the confidence track, the risk
 * vocabulary, the provenance panel — so what a visitor sees is the product
 * rather than a picture of it, and it cannot drift out of date when the
 * product changes.
 *
 * Two constraints follow from that, and both are deliberate:
 *
 *   · Server components only. No interactive overlay is used, so the
 *     provenance panel is drawn open rather than mounted behind a click.
 *   · Nothing here imports Recharts. The one plot on the page is hand-rolled
 *     SVG over a fixed specimen set; a marketing page has no business
 *     shipping a charting library to a first-time visitor.
 * ------------------------------------------------------------------------ */

const RISK_LABEL = {
  low: "Low risk",
  medium: "Medium risk",
  high: "High risk",
  unknown: "Risk not assessed",
} as const;

const RISK_DOT = {
  low: "bg-positive",
  medium: "bg-caution",
  high: "bg-critical",
  unknown: "bg-line-strong",
} as const;

const ACTIVITY_DOT = {
  Active: "bg-positive",
  Recent: "bg-neutral-metric",
  Slowing: "bg-caution",
} as const;

/** The frame every product surface sits in: a hairline and a named chrome bar. */
export function SurfaceFrame({
  label,
  meta,
  className,
  bodyClassName,
  children,
}: {
  label: string;
  meta?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <figure
      className={cn(
        "m-0 overflow-hidden rounded-xl bg-surface shadow-overlay",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-line bg-sunken px-4 py-2.5">
        <span className="label-caps text-ink-muted">{label}</span>
        {meta && <span className="text-sm text-ink-subtle">{meta}</span>}
      </div>
      <div className={bodyClassName}>{children}</div>
    </figure>
  );
}

/* --- Hero: the dossier masthead, cropped ---------------------------------- */

export function DossierMasthead() {
  return (
    <SurfaceFrame label="Creator intelligence" meta="Northlight Studio">
      <div className="flex flex-wrap items-center gap-4 border-b border-rule px-5 py-4">
        <Avatar name={SPECIMEN_DOSSIER.name} size="lg" verification="verified" />
        <div className="min-w-0 flex-1">
          <p className="text-md font-semibold text-ink">{SPECIMEN_DOSSIER.name}</p>
          <p className="mt-0.5 truncate text-sm text-ink-muted">
            <span className="font-num">@{SPECIMEN_DOSSIER.handle}</span>
            <span aria-hidden> · </span>
            {SPECIMEN_DOSSIER.platform}
            <span aria-hidden> · </span>
            {SPECIMEN_DOSSIER.market}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge tone="brand" dot>
              SocialOrbit Verified
            </Badge>
            <Badge tone="positive" dot>
              Low risk
            </Badge>
          </div>
        </div>
      </div>

      <div className="bg-instrument px-5 py-5 text-instrument-ink">
        <div className="flex flex-wrap items-center gap-5">
          <ScoreRing value={SPECIMEN_DOSSIER.health} size={104} tone="instrument" />
          <div className="min-w-40 flex-1 space-y-3">
            <div>
              <p className="label-caps text-instrument-muted">SocialOrbit Health</p>
              <p className="mt-0.5 font-display text-stat font-bold leading-tight">Excellent</p>
            </div>
            <div className="space-y-2">
              {(["authenticity", "engagementQuality", "growthPattern"] as const).map(
                (key, index) => (
                  <ScoreBar
                    key={key}
                    label={HEALTH_COMPONENT_LABEL[key]}
                    weight={HEALTH_WEIGHTS[key]}
                    value={SPECIMEN_COMPONENTS[key]}
                    tone="instrument"
                    index={index}
                  />
                ),
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 border-t border-instrument-line pt-3">
          <div className="flex items-baseline justify-between gap-3">
            <span className="label-caps text-instrument-muted">Data confidence</span>
            <span className="font-num text-base font-semibold">
              {SPECIMEN_DOSSIER.confidence}%
            </span>
          </div>
          <div className="mt-1.5 h-1 overflow-hidden rounded-sm bg-instrument-line">
            <div
              className="h-full rounded-sm bg-brand-glow"
              style={{ width: `${SPECIMEN_DOSSIER.confidence}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-instrument-muted">
            High confidence — a separate axis from the score above
          </p>
        </div>
      </div>
    </SurfaceFrame>
  );
}

/* --- §1 Discover ---------------------------------------------------------- */

export function DiscoverySurface() {
  return (
    <SurfaceFrame
      label="Creator search"
      meta="6,847 creators match · 3 filters"
      bodyClassName="grid lg:grid-cols-[16rem_1fr]"
    >
      <div className="border-b border-line bg-surface lg:border-b-0 lg:border-r">
        {SPECIMEN_FACETS.map((facet) => (
          <div key={facet.group} className="border-b border-rule px-4 py-3 last:border-b-0">
            <p className="text-base font-semibold text-ink">{facet.group}</p>
            <ul className="mt-2 space-y-1.5">
              {facet.options.map(([label, count]) => (
                <li
                  key={label}
                  className="flex items-center justify-between gap-2 text-base text-ink-muted"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      aria-hidden
                      className={cn(
                        "size-3.5 shrink-0 rounded-[3px] border",
                        label === "Low risk" || label === "Mega · 1M+"
                          ? "border-brand bg-brand"
                          : "border-line-strong bg-surface",
                      )}
                    />
                    <span className="truncate">{label}</span>
                  </span>
                  <span className="font-num text-sm text-ink-subtle">{count}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="scroll-x min-w-0">
        <table className="w-full min-w-max border-collapse text-base">
          <thead className="border-b border-rule bg-sunken text-ink-muted">
            <tr>
              <th scope="col" className="label-caps px-3 py-2 text-left">
                Creator
              </th>
              <th scope="col" className="label-caps px-3 py-2 text-right">
                Audience
              </th>
              <th scope="col" className="label-caps px-3 py-2 text-right">
                Engagement
              </th>
              <th
                scope="col"
                className="label-caps border-l border-rule px-3 py-2 text-right"
              >
                Health ↓
              </th>
              <th scope="col" className="label-caps px-3 py-2 text-right">
                Confidence
              </th>
              <th scope="col" className="label-caps border-l border-rule px-3 py-2 text-left">
                Signals
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rule">
            {SPECIMEN_RESULTS.map((creator) => (
              <tr key={creator.handle}>
                <td className="max-w-[17rem] px-3 py-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Avatar
                      name={creator.name}
                      size="sm"
                      verification={creator.verified ? "verified" : "unverified"}
                    />
                    <div className="min-w-0">
                      <span className="block truncate text-base font-medium text-ink">
                        {creator.name}
                      </span>
                      <span className="block truncate text-sm text-ink-muted">
                        <span className="font-num">@{creator.handle}</span>
                        <span aria-hidden> · </span>
                        {creator.market}
                        <span aria-hidden> · </span>
                        {creator.categories[0]}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2 text-right">
                  <span className="block font-num leading-tight text-ink">
                    {creator.followers}
                  </span>
                  <span className="block font-num text-xs text-ink-subtle">
                    {creator.medianViews} views
                  </span>
                </td>
                <td className="px-3 py-2 text-right font-num text-ink">
                  {creator.engagement}
                </td>
                <td className="border-l border-rule px-3 py-2 text-right">
                  <ScorePill value={creator.health} label="Health" size="lg" />
                </td>
                <td className="px-3 py-2 text-right">
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      aria-hidden
                      className="h-[5px] w-12 overflow-hidden rounded-full bg-sunken-strong"
                    >
                      <span
                        className={cn(
                          "block h-full rounded-full",
                          creator.confidence >= 90
                            ? "bg-positive"
                            : creator.confidence >= 70
                              ? "bg-brand"
                              : "bg-caution",
                        )}
                        style={{ width: `${creator.confidence}%` }}
                      />
                    </span>
                    <span className="font-num text-xs text-ink-muted">
                      {creator.confidence}%
                    </span>
                  </span>
                </td>
                <td className="border-l border-rule px-3 py-2">
                  <span className="flex items-center gap-2 whitespace-nowrap">
                    <span
                      aria-hidden
                      className={cn("size-1.5 rounded-full", RISK_DOT[creator.risk])}
                    />
                    <span className="text-sm text-ink-muted">
                      {RISK_LABEL[creator.risk]}
                    </span>
                    <span
                      aria-hidden
                      className={cn("size-1.5 rounded-full", ACTIVITY_DOT[creator.activity])}
                    />
                    <span className="text-sm text-ink-muted">{creator.activity}</span>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SurfaceFrame>
  );
}

/* --- §2 Evaluate ---------------------------------------------------------- */

export function CreatorDossier() {
  const keys = Object.keys(HEALTH_WEIGHTS) as HealthComponentKey[];

  return (
    <SurfaceFrame label="Creator dossier" meta="health-1.1.0">
      <div className="flex flex-wrap items-start gap-4 border-b border-rule px-5 py-4">
        <Avatar name={SPECIMEN_DOSSIER.name} size="xl" verification="verified" />
        <div className="min-w-48 flex-1">
          <h3 className="text-[28px] font-medium leading-tight text-ink">
            {SPECIMEN_DOSSIER.name}
          </h3>
          <p className="mt-1 text-base text-ink-muted">
            <span className="font-num">@{SPECIMEN_DOSSIER.handle}</span>
            <span aria-hidden> · </span>
            {SPECIMEN_DOSSIER.platform}
            <span aria-hidden> · </span>
            {SPECIMEN_DOSSIER.market}
            <span aria-hidden> · </span>
            {SPECIMEN_DOSSIER.categories.join(", ")}
          </p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            <Badge tone="brand" dot>
              SocialOrbit Verified
            </Badge>
            <Badge tone="positive" dot>
              Low risk
            </Badge>
            <Badge tone="neutral">Active</Badge>
          </div>
        </div>
      </div>

      {/* The instrument: the one dark surface the product allows itself. */}
      <div className="bg-instrument px-5 py-5 text-instrument-ink">
        <div className="flex flex-wrap items-center gap-6">
          <ScoreRing value={SPECIMEN_DOSSIER.health} size={128} tone="instrument" />
          <div className="min-w-56 flex-1">
            <p className="label-caps text-instrument-muted">SocialOrbit Health</p>
            <p className="mt-1 text-stat-lg font-semibold leading-tight">Excellent</p>
            <p className="mt-1 text-sm text-instrument-muted">
              94th percentile of 412 technology creators in the 1M+ follower band.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-x-8 gap-y-3 border-t border-instrument-line pt-4 sm:grid-cols-2">
          {keys.map((key, index) => (
            <ScoreBar
              key={key}
              label={HEALTH_COMPONENT_LABEL[key]}
              weight={HEALTH_WEIGHTS[key]}
              value={SPECIMEN_COMPONENTS[key]}
              tone="instrument"
              index={index}
            />
          ))}
        </div>

        <div className="mt-5 grid gap-x-8 gap-y-3 border-t border-instrument-line pt-4 sm:grid-cols-2">
          <InstrumentTrack
            label="Data confidence"
            value={SPECIMEN_DOSSIER.confidence}
            note="high confidence — separate from the score"
          />
          <InstrumentTrack
            label="Formula coverage"
            value={100}
            note="all nine components measurable"
          />
        </div>
      </div>

      <dl className="grid grid-cols-2 divide-x divide-y divide-rule border-b border-rule sm:grid-cols-4 sm:divide-y-0">
        {[
          ["Followers", SPECIMEN_DOSSIER.followers],
          ["Median views", SPECIMEN_DOSSIER.medianViews],
          ["Engagement", SPECIMEN_DOSSIER.engagement],
          ["Brand safety", String(SPECIMEN_ENRICHMENT.brandSafety)],
        ].map(([label, value]) => (
          <div key={label} className="px-4 py-3">
            <dt className="label-caps-sm text-ink-subtle">{label}</dt>
            <dd className="mt-1 font-num text-stat font-medium text-ink">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="px-5 py-4">
        <p className="label-caps-sm text-ink-subtle">Content performance</p>
        <ul className="mt-2 divide-y divide-rule">
          {[
            ["Thermals after 200 hours: the honest numbers", "412.8K", "1.9×"],
            ["What the spec sheet does not tell you", "298.1K", "1.3×"],
            ["Six months with the workstation nobody reviewed", "241.6K", "1.1×"],
          ].map(([title, views, index]) => (
            <li key={title} className="flex items-center gap-3 py-2">
              <span className="min-w-0 flex-1 truncate text-base text-ink">{title}</span>
              <span className="shrink-0 font-num text-sm text-ink-muted">{views}</span>
              <span className="w-12 shrink-0 text-right font-num text-sm text-ink">
                {index}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-sm text-ink-subtle">
          Each post measured against this creator&apos;s own median, not against other
          creators.
        </p>
      </div>
    </SurfaceFrame>
  );
}

function InstrumentTrack({
  label,
  value,
  note,
}: {
  label: string;
  value: number;
  note: string;
}) {
  return (
    <div className="min-w-40 space-y-1">
      <div className="flex items-baseline justify-between gap-3">
        <span className="label-caps text-instrument-muted">{label}</span>
        <span className="font-num text-base font-semibold">{value}%</span>
      </div>
      <div className="h-1 overflow-hidden rounded-sm bg-instrument-line">
        <div className="h-full rounded-sm bg-brand-glow" style={{ width: `${value}%` }} />
      </div>
      <p className="text-xs text-instrument-muted">{note}</p>
    </div>
  );
}

/* --- §3 Verify ------------------------------------------------------------ */

/**
 * The provenance panel, drawn open.
 *
 * In the product this is a click-through from any figure. Here it is rendered
 * in its open state beside the figure it explains, because the panel *is* the
 * argument — describing it in a paragraph would be the exact failure the
 * section exists to correct.
 */
export function ProvenanceDossier() {
  return (
    <div className="grid items-start gap-5 sm:grid-cols-[minmax(0,14rem)_minmax(0,20rem)]">
      <div className="rounded-xl bg-surface card-shadow px-5 py-5">
        <p className="label-caps-sm text-ink-subtle">Engagement rate</p>
        <p className="mt-2 font-num text-metric-lg font-medium leading-none text-ink underline decoration-line-strong decoration-dotted underline-offset-8">
          5.4%
        </p>
        <p className="mt-4 text-sm text-ink-muted">
          Every figure on a profile carries this. Click it and the platform shows its
          working.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl bg-surface shadow-popover">
        <div className="border-b border-rule px-3 py-2.5">
          <p className="label-caps-sm text-ink-subtle">Engagement rate</p>
          <p className="mt-1 flex items-baseline gap-2">
            <span className="font-num text-stat font-medium text-ink">5.4%</span>
            <span className="inline-flex items-center gap-1 rounded-sm border border-line bg-sunken px-1 py-px text-2xs font-semibold uppercase tracking-[0.06em] text-ink-muted">
              <Sigma className="size-2.5" aria-hidden />
              Derived
            </span>
          </p>
        </div>

        <dl className="divide-y divide-rule px-3 text-sm">
          <ProvenanceRow
            term="Method"
            detail="Calculated by SocialOrbit from observed values using a published formula."
          />
          <ProvenanceRow
            term="Source"
            detail={
              <>
                Official platform API{" "}
                <span className="text-ink-subtle">· tier 1 of 5</span>
                <br />
                <span className="inline-flex items-center gap-1 text-brand-ink">
                  View source
                  <ExternalLink className="size-3" aria-hidden />
                </span>
              </>
            }
          />
          <ProvenanceRow term="Collected" detail="2 hours ago" />
          <ProvenanceRow
            term="Derivation"
            detail="Observed interactions ÷ observed views. Posts that hide likes or disable comments contribute no interactions and are not counted as zero."
          />
        </dl>

        <div className="border-t border-rule px-3 py-2.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm text-ink-muted">Field confidence</span>
            <span className="font-num text-sm font-medium text-ink">94%</span>
          </div>
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-sunken-strong">
            <div className="h-full rounded-full bg-positive" style={{ width: "94%" }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function ProvenanceRow({ term, detail }: { term: string; detail: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[5.5rem_1fr] gap-3 py-2">
      <dt className="text-ink-subtle">{term}</dt>
      <dd className="min-w-0 text-ink">{detail}</dd>
    </div>
  );
}

export const FACT_STATES = [
  {
    label: "Verified",
    icon: BadgeCheck,
    tone: "text-verified",
    detail: "Confirmed through the creator's own authorised platform connection.",
  },
  {
    label: "Observed",
    icon: CircleDot,
    tone: "text-observed",
    detail: "Measured directly through an official platform API.",
  },
  {
    label: "Derived",
    icon: Sigma,
    tone: "text-ink-muted",
    detail: "Computed from observed values by a published, versioned formula.",
  },
  {
    label: "Estimated",
    icon: Sigma,
    tone: "text-estimated",
    detail: "A model estimate. Labelled as a range, never as a measurement.",
  },
  {
    label: "AI inferred",
    icon: Sparkles,
    tone: "text-inferred",
    detail: "Classified by a model from source material, with its evidence stored.",
  },
] as const;

/* --- §4 AI ---------------------------------------------------------------- */

export function EnrichmentExtract() {
  return (
    <SurfaceFrame
      label="Profile intelligence"
      meta={
        <span className="inline-flex items-center gap-1 text-inferred">
          <Sparkles className="size-3" aria-hidden />
          AI classified
        </span>
      }
    >
      <div className="space-y-4 p-5">
        <div className="rounded-lg border border-inferred-line bg-inferred-soft/60 p-4">
          <p className="label-caps text-inferred">Creator type</p>
          <p className="mt-1 text-base text-ink">{SPECIMEN_ENRICHMENT.creatorType}</p>
          <p className="label-caps mt-3 text-inferred">Audience intent</p>
          <p className="mt-1 text-base text-ink">{SPECIMEN_ENRICHMENT.audienceIntent}</p>
        </div>

        <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
          <ListBlock title="Strengths" items={SPECIMEN_ENRICHMENT.strengths} />
          <ListBlock
            title="Risks"
            items={SPECIMEN_ENRICHMENT.risks}
            tone="bg-caution"
          />
        </div>

        <div>
          <p className="label-caps-sm text-ink-subtle">Content themes</p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {SPECIMEN_ENRICHMENT.themes.map((theme) => (
              <li key={theme}>
                <Badge tone="inferred" className="whitespace-normal text-left">
                  {theme}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-rule bg-sunken/50 px-5 py-2.5 font-num text-sm text-ink-subtle">
        {SPECIMEN_ENRICHMENT.provider} {SPECIMEN_ENRICHMENT.model} · prompt{" "}
        {SPECIMEN_ENRICHMENT.promptVersion} · stored with its evidence
      </div>
    </SurfaceFrame>
  );
}

function ListBlock({
  title,
  items,
  tone = "bg-ink-subtle",
}: {
  title: string;
  items: readonly string[];
  tone?: string;
}) {
  return (
    <div>
      <p className="label-caps-sm text-ink-subtle">{title}</p>
      <ul className="mt-1.5 space-y-1.5">
        {items.map((item) => (
          <li key={item} className="flex gap-2.5 text-base text-ink-muted">
            <span
              aria-hidden
              className={cn("mt-[0.5rem] size-1 shrink-0 rounded-full", tone)}
            />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* --- §5 Activate ---------------------------------------------------------- */

export function CampaignDeliveryPanel() {
  const campaign = SPECIMEN_CAMPAIGN;
  return (
    <div className="relative overflow-hidden rounded-2xl bg-instrument text-instrument-ink shadow-instrument before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-white/8">
      <div className="flex items-center justify-between gap-3 border-b border-instrument-line px-4 py-2.5">
        <span className="label-caps text-instrument-muted">Campaign delivery</span>
        <span className="font-num text-xs text-instrument-muted">campaign-1.0.0</span>
      </div>
      <div className="flex flex-wrap items-center gap-5 px-5 py-5">
        <div className="shrink-0 text-center">
          <ScoreRing
            value={campaign.score}
            size={96}
            tone="instrument"
            label="Campaign score"
          />
          <p className="label-caps-sm mt-2 text-instrument-muted">Campaign score</p>
        </div>
        <div className="min-w-40 flex-1">
          <p className="font-num text-stat-lg font-medium leading-none">
            {campaign.attributedPosts}
          </p>
          <p className="label-caps mt-1 text-instrument-muted">Attributed posts</p>
          <p className="mt-2 text-sm text-instrument-muted">
            Matched to <span className="font-num">#{campaign.hashtag}</span> across 4
            confirmed creators.
          </p>
        </div>
      </div>
      <dl className="grid grid-cols-2 divide-x divide-instrument-line border-t border-instrument-line">
        {[
          ["Cost per engagement", campaign.costPerEngagement],
          ["Reach", campaign.reach],
        ].map(([label, value]) => (
          <div key={label} className="px-5 py-3">
            <dt className="label-caps text-instrument-muted">{label}</dt>
            <dd className="mt-0.5 font-num text-stat font-medium">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="border-t border-instrument-line px-5 py-3">
        <div className="flex items-baseline justify-between gap-3">
          <span className="label-caps text-instrument-muted">Spend against budget</span>
          <span className="font-num text-sm">
            {campaign.spend} <span className="text-instrument-muted">of {campaign.budget}</span>
          </span>
        </div>
        <div className="mt-1.5 h-1 overflow-hidden rounded-sm bg-instrument-line">
          <div className="h-full rounded-sm bg-brand-glow" style={{ width: "85%" }} />
        </div>
      </div>
    </div>
  );
}

export function CampaignLeaderboard() {
  return (
    <SurfaceFrame label="Creator performance" meta="Ranked by campaign score">
      <div className="scroll-x">
        <table className="w-full min-w-max border-collapse text-base">
          <thead className="border-b border-rule bg-sunken text-ink-muted">
            <tr>
              <th scope="col" className="label-caps px-3 py-2 text-left">
                Creator
              </th>
              <th scope="col" className="label-caps px-3 py-2 text-right">
                Agreed
              </th>
              <th scope="col" className="label-caps px-3 py-2 text-right">
                Posts
              </th>
              <th scope="col" className="label-caps px-3 py-2 text-right">
                Reach
              </th>
              <th scope="col" className="label-caps px-3 py-2 text-right">
                Engagement
              </th>
              <th
                scope="col"
                className="label-caps border-l border-rule px-3 py-2 text-right"
              >
                Campaign score
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-rule">
            {SPECIMEN_CAMPAIGN.participants.map((participant) => (
              <tr key={participant.handle}>
                <td className="px-3 py-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Avatar name={participant.name} size="sm" />
                    <div className="min-w-0">
                      <span className="block truncate text-base font-medium text-ink">
                        {participant.name}
                      </span>
                      <span className="block truncate font-num text-sm text-ink-muted">
                        @{participant.handle}
                      </span>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2 text-right font-num text-ink">
                  {participant.rate}
                </td>
                <td className="px-3 py-2 text-right font-num text-ink">
                  {participant.posts}
                </td>
                <td className="px-3 py-2 text-right font-num text-ink">
                  {participant.reach}
                </td>
                <td className="px-3 py-2 text-right font-num text-ink">
                  {participant.engagement}
                </td>
                <td className="border-l border-rule px-3 py-2 text-right">
                  <ScorePill value={participant.score} label="Campaign score" size="lg" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SurfaceFrame>
  );
}

/* --- §6 Measure ----------------------------------------------------------- */

const PLOT_FILL = {
  positive: "var(--color-positive)",
  brand: "var(--color-series-1)",
  caution: "var(--color-caution)",
  critical: "var(--color-critical)",
} as const;

/**
 * Quality against evidence, hand-rolled.
 *
 * A fixed specimen set on two 0–100 axes needs no charting runtime, and
 * pulling Recharts onto the marketing page to draw 100 circles would cost a
 * first-time visitor more than the whole rest of the page put together.
 */
export function QualityCanvas({ className }: { className?: string }) {
  const W = 1000;
  const H = 360;
  const PAD = { top: 16, right: 16, bottom: 52, left: 66 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const ticks = [0, 25, 50, 75, 100];

  const px = (x: number) => PAD.left + (x / 100) * plotW;
  const py = (y: number) => PAD.top + plotH - (y / 100) * plotH;

  return (
    <figure
      className={cn("m-0", className)}
      role="img"
      aria-label="Every scored creator plotted by SocialOrbit Health against the data confidence behind it. The mass sits mid-health on moderate confidence; a small group scores well on evidence too thin to rely on."
    >
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" aria-hidden>
        {ticks.map((tick) => (
          <g key={`y${tick}`}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={py(tick)}
              y2={py(tick)}
              stroke="var(--color-grid)"
              strokeWidth={1}
            />
            <text
              x={PAD.left - 10}
              y={py(tick) + 4}
              textAnchor="end"
              fontSize={11}
              fill="var(--color-ink-subtle)"
            >
              {tick}
            </text>
          </g>
        ))}
        {/* The origin is printed by the y-axis already; repeating it under the
            corner reads as a stray glyph. */}
        {ticks.slice(1).map((tick) => (
          <text
            key={`x${tick}`}
            x={px(tick)}
            y={H - 30}
            textAnchor="middle"
            fontSize={11}
            fill="var(--color-ink-subtle)"
          >
            {tick}
          </text>
        ))}

        {/* Axis names. Without them the panel title is the only thing telling a
            reader which measure is on which axis, and a chart that has to be
            decoded from its caption is not doing its job. */}
        <text
          x={PAD.left + plotW / 2}
          y={H - 8}
          textAnchor="middle"
          fontSize={11}
          fill="var(--color-ink-subtle)"
        >
          SocialOrbit Health
        </text>
        <text
          x={-(PAD.top + plotH / 2)}
          y={16}
          transform="rotate(-90)"
          textAnchor="middle"
          fontSize={11}
          fill="var(--color-ink-subtle)"
        >
          Data confidence
        </text>

        {/* The threshold a shortlist should be drawn above, named rather than
            implied — the whole point of the plot is the quadrant. */}
        <line
          x1={px(70)}
          x2={px(70)}
          y1={PAD.top}
          y2={PAD.top + plotH}
          stroke="var(--color-line-strong)"
          strokeWidth={1}
          strokeDasharray="4 4"
        />
        <line
          x1={PAD.left}
          x2={W - PAD.right}
          y1={py(70)}
          y2={py(70)}
          stroke="var(--color-line-strong)"
          strokeWidth={1}
          strokeDasharray="4 4"
        />

        {SPECIMEN_QUALITY_POINTS.map((point, index) => (
          <circle
            key={index}
            cx={px(point.x)}
            cy={py(point.y)}
            r={4}
            fill={PLOT_FILL[point.tone]}
            fillOpacity={0.5}
          />
        ))}
      </svg>
    </figure>
  );
}
