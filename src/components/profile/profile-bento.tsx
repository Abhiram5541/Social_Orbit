import * as React from "react";
import Link from "next/link";
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Clock,
  ShieldCheck,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/class-names";

import type { Provenance } from "@/lib/contracts/common";
import type { InfluencerProfile } from "@/lib/contracts/influencer";
import type { HealthComponentKey } from "@/lib/contracts/score";
import { formatCompact, formatDate, formatPercent, formatRelativeTime, NO_VALUE } from "@/lib/format";
import { Avatar } from "@/components/ui/avatar";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { LinkButton } from "@/components/ui/button";
import { Instrument } from "@/components/ui/panel";
import { SensoMark } from "@/components/shell/logo";
import { AreaCurve } from "@/components/charts/bento";
import { ColumnsToggle } from "@/components/charts/columns-toggle";
import { CardHead, RoundLink, SplitFigure } from "@/components/intelligence/bento-card";
import { ProvenanceMix, TrackedValue } from "@/components/intelligence/provenance";
import { HEALTH_BAND_LABEL, RiskBadge } from "@/components/intelligence/score";
import { RelativeTime } from "@/components/ui/relative-time";

/* ---------------------------------------------------------------------------
 * The creator dossier as a bento.
 *
 * One hero card carrying identity and the four first-pass figures, then a
 * grid of small cards each holding one reading. Every card keeps the
 * product's rules: measured figures carry provenance, modelled ones are
 * labelled, the AI card is the one dark surface and says it interprets.
 * ------------------------------------------------------------------------ */

type Tint = "brand" | "inferred" | "critical" | "teal" | "caution" | "slate";

const TINT: Record<Tint, { tile: string; icon: string }> = {
  brand: { tile: "bg-brand-soft", icon: "bg-brand text-white" },
  inferred: { tile: "bg-inferred-soft", icon: "bg-inferred text-white" },
  critical: { tile: "bg-critical-soft", icon: "bg-critical text-white" },
  teal: { tile: "bg-tint-teal-soft", icon: "bg-tint-teal text-white" },
  caution: { tile: "bg-caution-soft", icon: "bg-caution text-white" },
  slate: { tile: "bg-tint-slate-soft", icon: "bg-tint-slate text-white" },
};

/** Card chrome shared by every bento card: icon coin, title, ↗ or a badge. */
export function BentoHead({
  icon: Icon,
  tint = "brand",
  title,
  subtitle,
  href,
  aside,
}: {
  icon?: LucideIcon;
  tint?: Tint;
  title: string;
  subtitle?: string;
  href?: string;
  aside?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3">
      <div className="flex min-w-0 items-center gap-2.5">
        {Icon && (
          <span className={cn("grid size-8 shrink-0 place-items-center rounded-md", TINT[tint].icon)}>
            <Icon className="size-4" aria-hidden />
          </span>
        )}
        <div className="min-w-0">
          <h2 className="truncate text-base font-bold text-ink">{title}</h2>
          {subtitle && <p className="truncate text-xs text-ink-subtle">{subtitle}</p>}
        </div>
      </div>
      {aside ??
        (href && (
          <Link
            href={href}
            className="press grid size-8 shrink-0 place-items-center rounded-full bg-sunken text-ink-muted hover:bg-sunken-strong hover:text-ink"
            aria-label={`Open ${title.toLowerCase()}`}
          >
            <ArrowUpRight className="size-4" aria-hidden />
          </Link>
        ))}
    </div>
  );
}

export function Bento({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return <section className={cn("min-w-0 overflow-hidden rounded-xl bg-surface", className)} {...props} />;
}

/** The provenance every observed and derived figure on the dossier carries. */
function provenanceFor(profile: InfluencerProfile): { observed: Provenance; derived: Provenance } {
  const observed: Provenance = {
    tier: profile.verification === "verified" ? "oauth_authorized" : "platform_api",
    kind: profile.verification === "verified" ? "verified" : "observed",
    collectedAt: profile.lastRefreshedAt ?? profile.createdAt,
    verifiedAt: null,
    sourceUrl: profile.socialAccounts[0]?.url ?? null,
    confidence: profile.confidence,
    ai: null,
  };
  return { observed, derived: { ...observed, kind: "derived" } };
}

/* --- The green card: the score ------------------------------------------ */

export function HealthGreenCard({ profile }: { profile: InfluencerProfile }) {
  const { health, riskSignals: risk } = profile;
  const measured = health.sufficient;
  return (
    <Bento>
      <CardHead
        title="Health score"
        subtitle={`Formula ${health.formulaVersion} · ${formatRelativeTime(health.computedAt)}`}
        aside={<RiskBadge level={risk.level} />}
      />
      <div className="px-5 pb-5">
        <div className="relative overflow-hidden rounded-xl bg-brand p-5 text-white">
          <span
            aria-hidden
            className="pointer-events-none absolute -right-10 -top-16 size-44 rounded-full bg-white/10"
          />
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <SensoMark tile={false} className="size-6" />
              <span className="font-display text-base font-bold">SENSO</span>
            </span>
            <span className="rounded-full bg-white/15 px-2.5 py-1 label-caps-sm text-white">
              {measured ? HEALTH_BAND_LABEL[health.band].split(" ")[0] : "Unscored"}
            </span>
          </div>
          <p className="mt-6 text-xs font-medium text-white/70">Health</p>
          <p className="mt-1 flex items-baseline gap-1.5">
            <span className="font-num text-hero font-bold leading-none tracking-tight">
              {measured ? Math.round(health.value) : NO_VALUE}
            </span>
            <span className="font-num text-lg font-semibold text-white/70">/100</span>
          </p>
          <div className="mt-6 flex items-center justify-between text-xs font-medium text-white/75">
            <span className="font-num tracking-widest">
              •••• {Math.round(health.weightCovered * 100)}% measurable
            </span>
            <span>{profile.benchmarks ? `${ordinal(profile.benchmarks.metrics[0]?.percentile ?? 0)} pct.` : "no cohort"}</span>
          </div>
        </div>
      </div>
    </Bento>
  );
}

function ordinal(value: number): string {
  const rounded = Math.round(value);
  const suffix =
    rounded % 100 >= 11 && rounded % 100 <= 13
      ? "th"
      : (["th", "st", "nd", "rd"][rounded % 10] ?? "th");
  return `${rounded}${suffix}`;
}

/** The small card under the green one. */
export function EngagementSmallCard({ profile }: { profile: InfluencerProfile }) {
  return (
    <Bento>
      <div className="flex items-center justify-between gap-3 p-5">
        <div className="min-w-0">
          <p className="text-sm text-ink-muted">Engagement rate</p>
          <TrackedValue
            label="Engagement rate"
            value={formatPercent(profile.glance.engagementRate)}
            provenance={provenanceFor(profile).derived}
            derivation="(likes + comments) ÷ views, median across indexed uploads"
            className="mt-1"
            valueClassName="text-stat-lg font-bold leading-none text-ink"
          />
        </div>
        <Badge tone="neutral">derived</Badge>
      </div>
    </Bento>
  );
}

/* --- The column chart: components, or recent uploads --------------------- */

export function ProfileChartCard({ profile }: { profile: InfluencerProfile }) {
  const components = [...profile.health.components].sort((a, b) => b.weight - a.weight);
  const best = components.filter((c) => c.available).sort((a, b) => b.value - a.value)[0];
  const uploads = [...profile.recentContent]
    .sort((a, b) => a.publishedAt.localeCompare(b.publishedAt))
    .slice(-8);
  const maxViews = Math.max(1, ...uploads.map((item) => item.views ?? 0));
  const topUpload = uploads.reduce<(typeof uploads)[number] | null>(
    (top, item) => ((item.views ?? -1) > (top?.views ?? -1) ? item : top),
    null,
  );
  return (
    <Bento className="flex flex-col">
      <CardHead
        icon={BarChart3}
        title="Score components"
        subtitle="Nine weighted inputs, or the last uploads' views"
      />
      <div className="flex-1 px-5 pb-5 pt-0">
        <ColumnsToggle
          height={250}
          options={[
            {
              label: "Components",
              items: components.map((component) => ({
                id: component.key,
                label: SHORT_COMPONENT[component.key as HealthComponentKey],
                value: component.available ? component.value : null,
                highlight: best !== undefined && component.key === best.key,
              })),
            },
            {
              label: "Uploads",
              items: uploads.map((item) => ({
                id: item.id,
                label: formatDate(item.publishedAt).replace(/ \d{4}$/, ""),
                value: item.views === null ? null : (item.views / maxViews) * 100,
                display: `${formatCompact(item.views)} views`,
                highlight: topUpload !== null && item.id === topUpload.id,
                href: item.url,
              })),
            },
          ]}
        />
      </div>
    </Bento>
  );
}

/** Axis labels; the full name is in each column's title attribute. */
const SHORT_COMPONENT: Record<HealthComponentKey, string> = {
  authenticity: "Auth",
  engagementQuality: "Qual",
  engagementRate: "Rate",
  growthPattern: "Grow",
  viewConsistency: "View",
  audienceActivity: "Actv",
  commentQuality: "Cmnt",
  uploadConsistency: "Upld",
  brandSafety: "Safe",
};

/* --- The table: similar creators ---------------------------------------- */

export function LookalikeTable({
  profile,
  linkToProfiles = true,
}: {
  profile: InfluencerProfile;
  linkToProfiles?: boolean;
}) {
  const rows = profile.lookalikes.slice(0, 6);
  return (
    <Bento>
      <CardHead
        title="Similar creators"
        subtitle="Weighted overlap of category, themes, audience size, country and language"
        href={linkToProfiles ? `/discovery?category=${profile.categories[0] ?? ""}` : undefined}
      />
      {rows.length === 0 ? (
        <p className="px-5 pb-5 text-sm text-ink-muted">No comparable creators indexed yet.</p>
      ) : (
        <div className="scroll-x px-3 pb-3">
          <table className="w-full min-w-[36rem] border-separate border-spacing-0 text-base">
            <thead>
              <tr className="text-left text-xs font-medium text-ink-subtle">
                <th scope="col" className="px-3 pb-2 font-medium">Creator</th>
                <th scope="col" className="px-3 pb-2 font-medium">Followers</th>
                <th scope="col" className="px-3 pb-2 font-medium">Shares</th>
                <th scope="col" className="px-3 pb-2 font-medium">Status</th>
                <th scope="col" className="px-3 pb-2 text-right font-medium">Match</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((creator) => {
                const strong = creator.score >= 75;
                const name = (
                  <span className="flex items-center gap-3">
                    <Avatar name={creator.displayName} src={creator.avatarUrl} size="sm" />
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-ink">{creator.displayName}</span>
                      <span className="block truncate text-xs text-ink-subtle">@{creator.handle}</span>
                    </span>
                  </span>
                );
                return (
                  <tr
                    key={creator.id}
                    className="[&>td]:py-2.5 even:[&>td]:bg-sunken/70 [&>td:first-child]:rounded-l-lg [&>td:last-child]:rounded-r-lg"
                  >
                    <td className="px-3">
                      {linkToProfiles ? (
                        <Link href={`/influencers/${creator.id}`} className="block rounded-md hover:text-brand-ink">
                          {name}
                        </Link>
                      ) : (
                        name
                      )}
                    </td>
                    <td className="px-3 font-num text-ink">{formatCompact(creator.followers)}</td>
                    <td className="max-w-56 truncate px-3 text-sm text-ink-muted">
                      {creator.reasons.join(" · ")}
                    </td>
                    <td className="px-3">
                      <Badge tone={strong ? "positive" : "neutral"} dot={strong}>
                        {strong ? "Strong match" : "Match"}
                      </Badge>
                    </td>
                    <td className="px-3 text-right font-num font-bold text-ink">
                      {creator.score.toFixed(1)}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Bento>
  );
}

/* --- Right column: followers with the curve, then confidence ------------- */

export function FollowersCard({ profile }: { profile: InfluencerProfile }) {
  const { observed, derived } = provenanceFor(profile);
  const series = profile.followerHistory;
  const points = series.points
    .map((point) => point.followers)
    .filter((value): value is number => value !== null);
  const drawable = series.sufficient && points.length >= 2;
  return (
    <Bento>
      <CardHead
        title="Followers"
        subtitle="Observed from the platform API"
        href={profile.socialAccounts[0]?.url}
      />
      <div className="px-5 pb-5 pt-0 text-center">
        <p className="text-xs text-ink-subtle">Current audience</p>
        {/* The headline figure can explain itself — CLAUDE.md D20. */}
        <TrackedValue
          label="Followers"
          value={formatCompact(profile.glance.followers)}
          provenance={observed}
          className="mt-1 justify-center"
          valueClassName="text-metric-lg font-bold leading-none tracking-tight text-ink"
        />
        <dl className="mt-4 grid grid-cols-2 divide-x divide-rule rounded-lg bg-sunken py-2.5">
          <div className="px-2">
            <dt className="text-xs text-ink-subtle">Total views</dt>
            <dd className="mt-0.5">
              <TrackedValue
                label="Total views"
                value={formatCompact(profile.glance.totalViews)}
                provenance={observed}
                valueClassName="text-md font-bold text-ink"
              />
            </dd>
          </div>
          <div className="px-2">
            <dt className="text-xs text-ink-subtle">Median views</dt>
            <dd className="mt-0.5">
              <TrackedValue
                label="Median views"
                value={formatCompact(profile.glance.medianViews)}
                provenance={derived}
                derivation="Median of views across every indexed upload"
                valueClassName="text-md font-bold text-ink"
              />
            </dd>
          </div>
        </dl>
        {drawable ? (
          <>
            <AreaCurve values={points} height={120} className="mt-4" ariaLabel="Follower history" />
            <p className="mt-1 text-2xs text-ink-subtle">
              {formatDate(series.points[0]?.date)} – {formatDate(series.points[series.points.length - 1]?.date)}
            </p>
          </>
        ) : (
          <div className="mt-4 rounded-lg border border-dashed border-line-strong px-4 py-5">
            <p className="text-sm font-semibold text-ink">Growth history still building</p>
            <p className="mt-1 text-xs text-ink-muted">
              {points.length} of {series.minimumPoints} snapshots collected. A trend is drawn once
              there is enough history to read one honestly.
            </p>
            <span className="mx-auto mt-3 block h-1.5 w-32 overflow-hidden rounded-full bg-sunken-strong">
              <span
                className="block h-full rounded-full bg-brand"
                style={{ width: `${Math.min(100, (points.length / series.minimumPoints) * 100)}%` }}
              />
            </span>
          </div>
        )}
        <div className="mt-4 flex gap-2">
          <LinkButton href={`/compare?ids=${profile.id}`} variant="primary" size="sm" className="flex-1 gap-1.5">
            Compare
            <ArrowUpRight className="size-3.5" aria-hidden />
          </LinkButton>
          <LinkButton
            href={`/campaigns/new?influencer=${profile.id}`}
            variant="secondary"
            size="sm"
            className="flex-1 gap-1.5 border-0 bg-sunken"
          >
            Campaign
            <ArrowDownRight className="size-3.5" aria-hidden />
          </LinkButton>
        </div>
      </div>
    </Bento>
  );
}

export function ConfidenceCard({ profile }: { profile: InfluencerProfile }) {
  const confidence = profile.confidenceDetail;
  const tone: BadgeTone =
    confidence.band === "preliminary" ? "critical" : confidence.band === "moderate" ? "caution" : "positive";
  return (
    <Bento>
      <CardHead icon={ShieldCheck} title="Data confidence" subtitle="Separate from the score" />
      <div className="px-5 pb-5 pt-0">
        <div className="flex flex-wrap items-center gap-3">
          <SplitFigure value={`${Math.round(confidence.score)}%`} />
          <Badge tone={tone} className="capitalize">
            {confidence.band}
          </Badge>
        </div>
        <div className="mt-5 rounded-lg bg-sunken p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-base font-semibold text-ink">Where it came from</p>
              <p className="text-xs text-ink-subtle">Share of figures by source</p>
            </div>
            <RoundLink href="/help/verification" label="How verification works" />
          </div>
          <ProvenanceMix mix={confidence.mix} className="mt-3" />
        </div>
      </div>
    </Bento>
  );
}

/* --- Versions: what produced these figures ------------------------------ */

export function VersionsCard({ profile }: { profile: InfluencerProfile }) {
  const cells: { label: string; value: React.ReactNode }[] = [
    { label: "Score version", value: profile.health.scoreVersion },
    { label: "Formula", value: profile.health.formulaVersion },
    {
      label: "Confidence",
      value: (
        <>
          {Math.round(profile.confidenceDetail.score)}%{" "}
          <span className="font-sans text-xs font-normal capitalize text-ink-subtle">
            {profile.confidenceDetail.band}
          </span>
        </>
      ),
    },
    { label: "Last refresh", value: <RelativeTime at={profile.lastRefreshedAt} /> },
  ];
  return (
    <Bento>
      <CardHead title="Versions" subtitle="What produced these figures" />
      <dl className="grid grid-cols-2 gap-2 px-5 pb-5 pt-0">
        {cells.map((cell) => (
          <div key={cell.label} className="rounded-lg bg-sunken px-3 py-2.5">
            <dt className="text-xs text-ink-subtle">{cell.label}</dt>
            <dd className="mt-0.5 truncate font-num text-base font-semibold text-ink">{cell.value}</dd>
          </div>
        ))}
      </dl>
    </Bento>
  );
}

/* --- Cadence ("Time tracker") -------------------------------------------- */

export function CadenceCard({ profile }: { profile: InfluencerProfile }) {
  const glance = profile.glance;
  const rows: { label: string; value: string; share: number; tone: string }[] = [
    {
      label: "Content indexed",
      value: formatCompact(glance.contentCount),
      share: 100,
      tone: "bg-brand",
    },
    {
      label: "Avg. length",
      value: glance.averageContentLength === null ? NO_VALUE : `${Math.round(glance.averageContentLength)}s`,
      share: glance.averageContentLength === null ? 0 : Math.min(100, (glance.averageContentLength / 600) * 100),
      tone: "bg-inferred",
    },
    {
      label: "Est. reach / month",
      value: formatCompact(glance.estimatedMonthlyReach),
      share: 70,
      tone: "bg-tint-teal",
    },
  ];
  return (
    <Bento>
      <BentoHead icon={Clock} tint="brand" title="Publishing cadence" subtitle="Observed upload rhythm" />
      <div className="px-4 pb-4">
        <p className="font-num text-metric font-bold leading-none text-ink">
          {glance.uploadFrequency === null ? NO_VALUE : glance.uploadFrequency.toFixed(1)}
          <span className="ml-1 text-md font-semibold text-ink-subtle">/ week</span>
        </p>
        <ul className="mt-4 space-y-2.5">
          {rows.map((row) => (
            <li key={row.label} className="text-sm">
              <div className="flex items-center justify-between">
                <span className="text-ink-muted">{row.label}</span>
                <span className="font-num font-semibold text-ink">{row.value}</span>
              </div>
              <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-sunken-strong">
                <span className={cn("block h-full rounded-full", row.tone)} style={{ width: `${row.share}%` }} />
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Bento>
  );
}

/* --- Provenance ---------------------------------------------------------- */

export function ProvenanceCard({ profile }: { profile: InfluencerProfile }) {
  const confidence = profile.confidenceDetail;
  return (
    <Bento>
      <BentoHead icon={ShieldCheck} tint="slate" title="Where the numbers come from" subtitle="Source mix and confidence" />
      <div className="space-y-4 px-4 pb-4">
        <div className="grid grid-cols-2 gap-2.5">
          <div className="rounded-lg bg-sunken p-3">
            <p className="text-xs text-ink-muted">Data confidence</p>
            <p className="mt-1 font-num text-stat font-bold text-ink">{Math.round(confidence.score)}%</p>
            <p className="text-2xs capitalize text-ink-subtle">{confidence.band}</p>
          </div>
          <div className="rounded-lg bg-sunken p-3">
            <p className="text-xs text-ink-muted">Formula coverage</p>
            <p className="mt-1 font-num text-stat font-bold text-ink">
              {Math.round(profile.health.weightCovered * 100)}%
            </p>
            <p className="text-2xs text-ink-subtle">
              {profile.health.components.filter((c) => !c.available).length} not measurable
            </p>
          </div>
        </div>
        <ProvenanceMix mix={confidence.mix} />
      </div>
    </Bento>
  );
}

/* --- AI ("Flowora AI") --------------------------------------------------- */

export function AiCard({ profile }: { profile: InfluencerProfile }) {
  const ai = profile.ai;
  return (
    <Instrument bleed className="flex flex-col rounded-xl py-5 shadow-none">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-lg bg-white/10 text-brand-lift">
          <Sparkles className="size-5" aria-hidden />
        </span>
        <div>
          <p className="font-display text-base font-bold text-instrument-ink">SENSO AI</p>
          <p className="text-xs text-instrument-muted">Interprets the score. Never sets it.</p>
        </div>
        <Badge tone="inferred" onInstrument className="ml-auto">
          AI
        </Badge>
      </div>
      {ai ? (
        <>
          <p className="mt-4 text-base leading-6 text-instrument-ink">{ai.signalReading}</p>
          <p className="mt-3 text-xs text-instrument-muted">
            {ai.provider} {ai.model} · prompt {ai.promptVersion} · {formatRelativeTime(ai.generatedAt)}
          </p>
          {ai.strengths.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-1.5">
              {ai.strengths.slice(0, 3).map((item) => (
                <li key={item} className="rounded-full bg-white/10 px-2.5 py-1 text-xs text-instrument-ink">
                  {item}
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <div className="mt-4 rounded-lg bg-white/8 p-4">
          <p className="text-base font-semibold text-instrument-ink">No interpretation yet</p>
          <p className="mt-1 text-sm leading-5 text-instrument-muted">
            The AI layer has not run for this creator. Classification, brand safety and
            comment quality appear here once it has — the measured figures are unaffected.
          </p>
        </div>
      )}
    </Instrument>
  );
}

/* --- Signals ("Upcoming tasks") ------------------------------------------ */

export function SignalsCard({ profile }: { profile: InfluencerProfile }) {
  const unavailable = profile.health.components.filter((c) => !c.available).length;
  const signals: { label: string; detail: string; tone: BadgeTone; priority: string }[] = [];
  if (profile.verification !== "verified")
    signals.push({
      label: "Identity not verified",
      detail: "Figures are observed from the platform API, not confirmed by the creator.",
      tone: "caution",
      priority: "Medium",
    });
  if (profile.riskSignals.level === "unknown")
    signals.push({
      label: "Audience risk not assessed",
      detail: "Needs authorised access; reported as unknown, not as low.",
      tone: "neutral",
      priority: "Info",
    });
  else if (profile.riskSignals.level !== "low")
    signals.push({
      label: `Audience risk ${profile.riskSignals.level}`,
      detail: "A single disqualifying signal sets the floor; risk does not average.",
      tone: "critical",
      priority: "High",
    });
  if (unavailable > 0)
    signals.push({
      label: `${unavailable} score components unmeasured`,
      detail: "Weights are renormalised rather than counted as zero.",
      tone: "neutral",
      priority: "Info",
    });
  if (profile.confidenceDetail.band === "preliminary")
    signals.push({
      label: "Preliminary confidence",
      detail: "Too little history to rely on these numbers yet.",
      tone: "critical",
      priority: "High",
    });

  return (
    <Bento>
      <BentoHead icon={ShieldCheck} tint="critical" title="Things to know" subtitle={`${signals.length} flagged`} />
      {signals.length === 0 ? (
        <p className="px-4 pb-4 text-sm text-ink-muted">Nothing flagged for this creator.</p>
      ) : (
        <ul className="divide-y divide-rule px-4 pb-2">
          {signals.map((signal) => (
            <li key={signal.label} className="flex items-start gap-3 py-2.5">
              <span
                aria-hidden
                className={cn(
                  "mt-1.5 size-2 shrink-0 rounded-full",
                  signal.tone === "critical" ? "bg-critical" : signal.tone === "caution" ? "bg-caution" : "bg-line-strong",
                )}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink">{signal.label}</p>
                <p className="text-xs leading-4 text-ink-subtle">{signal.detail}</p>
              </div>
              <Badge tone={signal.tone}>{signal.priority}</Badge>
            </li>
          ))}
        </ul>
      )}
    </Bento>
  );
}
