import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { formatCompact } from "@/lib/format";
import { databaseStats } from "@/server/repositories/ops-repository";
import { LinkButton } from "@/components/ui/button";
import { MarketingChrome } from "@/components/shell/marketing-chrome";
import { PointerGlow, Reveal } from "@/components/marketing/reveal";
import {
  CampaignDeliveryPanel,
  CampaignLeaderboard,
  CreatorDossier,
  DiscoverySurface,
  DossierMasthead,
  EnrichmentExtract,
  FACT_STATES,
  ProvenanceDossier,
  QualityCanvas,
} from "@/components/marketing/product-surfaces";

export const metadata: Metadata = {
  title: "SENSO — Influencer Intelligence",
  description:
    "Find the creators worth betting your brand on. Discovery, evaluation, verification and campaign measurement for marketing teams — with evidence behind every important number.",
};

// The proof bar reads the live database, so the page cannot be prerendered.
export const dynamic = "force-dynamic";

/* ---------------------------------------------------------------------------
 * The landing page.
 *
 * Ordered by the buyer's journey — discover, evaluate, verify, activate,
 * measure — rather than by the system's architecture. The previous page opened
 * on a scoring philosophy and worked outward to the pipeline and the API, which
 * is the order an engineer would present it in and not the order anyone decides
 * to buy in.
 *
 * Two rules govern the composition:
 *
 *   1. The product carries the argument. Every section leads with a surface
 *      composed from the application's own components, and the prose around it
 *      is at most two lines. A visitor who reads nothing should still be able
 *      to see discovery, evaluation, verification, campaigns and analysis.
 *   2. No two bands share a shape. The repeated eyebrow-heading-paragraph-card
 *      rhythm is the specific thing that made the old page read as generated.
 *      Full-bleed surfaces, a sticky split, an open panel, offset layers and a
 *      single oversized canvas each appear exactly once.
 *
 * Specimen creators are fictional and disclosed once, under the hero and again
 * in the footer. Every aggregate figure is live.
 * ------------------------------------------------------------------------ */

const JOURNEY = [
  { href: "#discover", label: "Discover" },
  { href: "#evaluate", label: "Evaluate" },
  { href: "#verify", label: "Verify" },
  { href: "#activate", label: "Activate" },
  { href: "#measure", label: "Measure" },
];

const DISCOVER_OUTCOMES = [
  {
    title: "Filter on audience quality, not size",
    body: "Engagement, authenticity risk, publishing cadence and verification state are filters, not footnotes.",
  },
  {
    title: "See what a filter costs before you apply it",
    body: "Every facet carries a live count against the index, so you know what narrowing removes.",
  },
  {
    title: "Sort on the score, not the follower count",
    body: "SENSO Health is a deterministic composite of nine weighted components, not a popularity rank.",
  },
];

const EVALUATE_POINTS = [
  {
    title: "Nine components, published weights",
    body: "Authenticity, engagement quality and rate, growth, view consistency, audience activity, comment quality, upload consistency, brand safety.",
  },
  {
    title: "Confidence is its own axis",
    body: "A creator can score 91 on health with 40% confidence. Folding the two together is the most misleading thing a tool in this category can do.",
  },
  {
    title: "Absent is never zero",
    body: "A component nobody could measure is withheld and the remaining weights renormalise. It is never scored as a nought.",
  },
  {
    title: "Reproducible years later",
    body: "Every score stores its components, its inputs and its formula version, so a number recorded last quarter can be recomputed today.",
  },
];

const AI_PROHIBITIONS = [
  "Follower counts",
  "Engagement rates",
  "View counts",
  "Audience demographics",
  "Bot percentages",
  "Any historical metric",
];

const PIPELINE = [
  { label: "Platform APIs", note: "Authoritative structured metrics" },
  { label: "OAuth connection", note: "First-party creator analytics" },
  { label: "Normalise & snapshot", note: "Appended, never overwritten" },
  { label: "Deterministic scoring", note: "Versioned, components stored" },
  { label: "AI enrichment", note: "Explained and evidenced", inferred: true },
];

export default function LandingPage() {
  // Real coverage from the running database. The only unmarked figures on the
  // page, because they are the only ones that were measured.
  const stats = databaseStats();

  return (
    <MarketingChrome onDark>
      {/* ============================================================== HERO
          The instrument, opened. The page begins inside the housing the
          product's own chrome is made of and only steps out onto paper once
          the argument starts — so the first thing a visitor sees is the
          material the application is built from, not a picture of it. */}
      <section className="relative overflow-hidden bg-instrument text-instrument-ink">
        {/* One orbit, drawn as geometry rather than decoration: the arc the
            mark is built on, set at the scale of the page. */}
        <svg
          aria-hidden
          viewBox="0 0 1200 800"
          preserveAspectRatio="xMidYMid slice"
          className="pointer-events-none absolute inset-0 size-full opacity-70"
        >
          <ellipse
            cx="880"
            cy="330"
            rx="560"
            ry="300"
            transform="rotate(-18 880 330)"
            fill="none"
            stroke="var(--color-instrument-line)"
            strokeWidth="1"
          />
          <ellipse
            cx="880"
            cy="330"
            rx="380"
            ry="196"
            transform="rotate(-18 880 330)"
            fill="none"
            stroke="var(--color-instrument-line)"
            strokeWidth="1"
          />
        </svg>

        <div className="relative mx-auto grid max-w-6xl items-center gap-x-14 gap-y-12 px-4 pb-20 pt-14 sm:px-6 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:pb-28 lg:pt-20">
          <Reveal>
            <h1 className="display-lg text-instrument-ink">
              Find the creators worth betting your brand on.
            </h1>
            <p className="mt-6 max-w-xl text-md leading-7 text-instrument-muted">
              SENSO gives marketing teams an intelligence layer for discovering,
              evaluating and measuring creators — with evidence behind every important
              number.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <LinkButton href="/register" variant="accent" size="lg">
                Request a demo
              </LinkButton>
              <LinkButton
                href="#discover"
                size="lg"
                variant="ghost"
                className="gap-2 text-instrument-ink hover:bg-instrument-raised hover:text-instrument-ink"
              >
                Explore the platform
                <ArrowRight className="size-4" aria-hidden />
              </LinkButton>
            </div>

            {/* The live coverage figures, promoted into the hero. They are the
                only measured numbers on this page, so they belong where the
                claim is made rather than in a band underneath it. */}
            <dl className="mt-12 grid max-w-lg grid-cols-3 gap-x-6 border-t border-instrument-line pt-6">
              {[
                { label: "Creators indexed", value: formatCompact(stats.totalInfluencers) },
                { label: "Content read", value: formatCompact(stats.totalContent) },
                { label: "Markets", value: formatCompact(stats.byCountry.length) },
              ].map((figure) => (
                <div key={figure.label} className="min-w-0">
                  <dd className="font-num text-stat-lg font-medium leading-none text-instrument-ink">
                    {figure.value}
                  </dd>
                  <dt className="label-caps-sm mt-1.5 text-instrument-subtle">
                    {figure.label}
                  </dt>
                </div>
              ))}
            </dl>
          </Reveal>

          <Reveal delay={120} className="min-w-0 lg:-mr-8 xl:-mr-14">
            <PointerGlow className="rounded-2xl bg-surface text-ink shadow-instrument">
              <DossierMasthead />
            </PointerGlow>
            {/* The page's one specimen disclosure. Repeating it on all eight
                surfaces would read as defensiveness; withholding it entirely,
                on a product whose pitch is that its numbers are checkable,
                would be worse. */}
            <p className="mt-4 text-sm text-instrument-subtle">
              Product surfaces on this page are the real interface, rendered with
              illustrative creators. Coverage figures are live.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ====================================================== JOURNEY RAIL
          No heading. The journey is stated once, in words, here — every band
          after this demonstrates a stop on it. It is also the seam: graphite
          above, paper below. */}
      <nav
        aria-label="How SENSO works"
        className="border-b border-line bg-sunken"
      >
        <ol className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-2 gap-y-1 px-4 py-4 sm:px-6">
          {JOURNEY.map((stop, index) => (
            <li key={stop.href} className="flex items-center gap-2">
              {index > 0 && (
                <ArrowRight className="size-3 shrink-0 text-ink-subtle" aria-hidden />
              )}
              <a
                href={stop.href}
                className="label-caps rounded px-1 py-0.5 text-ink-muted transition-colors hover:text-ink"
              >
                {stop.label}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {/* ========================================================= PROOF BAR
          The remaining live figures, and the sourcing statement they need. */}
      <section className="border-b border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <Reveal>
            <dl className="grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4">
              {[
                { label: "Accounts resolved", value: formatCompact(stats.totalAccounts) },
                { label: "Content items read", value: formatCompact(stats.totalContent) },
                {
                  label: "Historical snapshots",
                  value: formatCompact(stats.totalSnapshots),
                },
                { label: "Markets covered", value: formatCompact(stats.byCountry.length) },
              ].map((figure) => (
                <div key={figure.label} className="min-w-0">
                  <dt className="label-caps-sm text-ink-subtle">{figure.label}</dt>
                  <dd className="mt-1.5 font-num text-metric font-medium leading-none text-ink">
                    {figure.value}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-7 measure text-sm text-ink-subtle">
              Live from the SENSO database as this page rendered. Collected from
              official platform APIs and creator-authorised accounts — no prohibited
              scraping, and no purchased list.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ========================================================= 1 DISCOVER
          The surface is the section: one line of copy, then the product at
          full width. */}
      <section id="discover" className="border-b border-line bg-canvas">
        <div className="mx-auto max-w-7xl px-4 pb-16 pt-20 sm:px-6 lg:pb-20 lg:pt-24">
          <Reveal className="mx-auto max-w-3xl">
            <h2 className="display-sm text-ink">
              Don&apos;t choose creators by follower count.
            </h2>
          </Reveal>

          <div className="mt-10">
            <DiscoverySurface />
          </div>

          {/* Rules, not cards. Three outcomes on one divided row. */}
          <dl className="mt-10 grid divide-y divide-line border-t border-line md:grid-cols-3 md:divide-x md:divide-y-0">
            {DISCOVER_OUTCOMES.map((outcome) => (
              <div key={outcome.title} className="py-5 md:px-6 md:first:pl-0 md:last:pr-0">
                <dt className="text-md font-semibold text-ink">{outcome.title}</dt>
                <dd className="mt-1.5 text-base leading-6 text-ink-muted">
                  {outcome.body}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ========================================================= 2 EVALUATE
          Sticky split-screen: the copy holds while the dossier scrolls past
          it. The tallest section and the visual centrepiece. */}
      <section id="evaluate" className="border-b border-line bg-surface">
        <div className="mx-auto grid max-w-6xl gap-x-12 gap-y-8 px-4 py-20 sm:px-6 lg:py-24 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-start">
          <div className="lg:sticky lg:top-24">
            <h2 className="display-sm text-ink">
              Understand the creator behind the audience.
            </h2>
            <dl className="mt-8 divide-y divide-rule border-t border-rule">
              {EVALUATE_POINTS.map((point) => (
                <div key={point.title} className="py-4">
                  <dt className="text-base font-semibold text-ink">{point.title}</dt>
                  <dd className="mt-1 text-base leading-6 text-ink-muted">{point.body}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="min-w-0">
            <CreatorDossier />
          </div>
        </div>
      </section>

      {/* =========================================================== 3 VERIFY
          The interaction is the explanation: the panel is drawn open beside
          the figure it explains. No paragraph. */}
      <section id="verify" className="border-b border-line bg-sunken">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
          <div className="grid items-start gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <div>
              <h2 className="display-sm text-ink">
                Every important number carries its evidence.
              </h2>
              <p className="mt-5 max-w-md text-md leading-6 text-ink-muted">
                Most tools hand you a confident figure and no way to check it. Ours shows
                its working — on any number you might have to defend in a meeting.
              </p>
            </div>
            <ProvenanceDossier />
          </div>

          {/* The five states as a ladder across the band, not five cards. */}
          <ol className="mt-12 grid divide-y divide-line border-y border-line lg:grid-cols-5 lg:divide-x lg:divide-y-0">
            {FACT_STATES.map((state) => (
              <li key={state.label} className="px-0 py-4 lg:px-5 lg:first:pl-0 lg:last:pr-0">
                <p className="flex items-center gap-1.5">
                  <state.icon className={`size-3.5 ${state.tone}`} aria-hidden />
                  <span className="label-caps text-ink">{state.label}</span>
                </p>
                <p className="mt-1.5 text-sm leading-5 text-ink-muted">{state.detail}</p>
              </li>
            ))}
          </ol>

          <p className="mt-5 max-w-3xl text-base text-ink-muted">
            Sources are ranked, and the ranking is visible. An official API measurement
            outranks permitted public research, which outranks model inference — and where
            two sources disagree, the conflict is raised for a human rather than silently
            resolved in the platform&apos;s favour.
          </p>
        </div>
      </section>

      {/* =============================================================== 4 AI
          The output on one side, the constraint on the other. The constraint
          is the sales argument, so it is set as plainly as the output. */}
      <section id="intelligence" className="border-b border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="display-sm text-ink">
              AI explains the score. It never sets it.
            </h2>
          </div>

          <div className="mt-10 grid items-start gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.75fr)]">
            <EnrichmentExtract />

            <div>
              <p className="text-base leading-6 text-ink-muted">
                Models classify, extract and explain. They are asked for one object
                matching a schema, in strict mode, and the reply is re-validated before
                anything is stored — so the prohibition is enforced by there being no
                field to fill, not by wording in a prompt.
              </p>
              <p className="label-caps-sm mt-8 text-ink-subtle">
                A model may never produce
              </p>
              <ul className="mt-2 divide-y divide-rule border-y border-rule">
                {AI_PROHIBITIONS.map((item) => (
                  <li
                    key={item}
                    className="flex items-center gap-3 py-2.5 text-base text-ink"
                  >
                    <span
                      aria-hidden
                      className="h-px w-4 shrink-0 bg-critical"
                    />
                    {item}
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-sm text-ink-subtle">
                Every AI output stores its provider, model, prompt version, schema version
                and the evidence behind each claim.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================= 5 ACTIVATE
          Offset overlapping layers — the only place on the page where two
          surfaces sit at different elevations. */}
      <section id="platform" className="border-b border-line bg-canvas">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
          <div className="mx-auto max-w-3xl">
            <h2 className="display-sm text-ink">
              From creator selection to measurable delivery.
            </h2>
            <p className="mt-4 text-md leading-6 text-ink-muted">
              Select talent from a shortlist, record the agreed rate, set a tracking
              hashtag, and SENSO attributes what each creator actually delivered.
            </p>
          </div>

          <div className="relative mt-10 lg:grid lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:items-start lg:gap-0">
            <div className="lg:relative lg:z-10 lg:mt-10">
              <CampaignDeliveryPanel />
            </div>
            <div className="mt-5 min-w-0 lg:-ml-10 lg:mt-0 lg:pl-10">
              <CampaignLeaderboard />
            </div>
          </div>

          <p className="mt-8 max-w-3xl text-base text-ink-muted">
            A creator&apos;s campaign performance is scored separately from their
            SENSO Health — the first answers &ldquo;how did they do for us?&rdquo;,
            the second &ldquo;who are they?&rdquo;. The two are never merged, and both
            carry their own formula version.
          </p>
        </div>
      </section>

      {/* ========================================================== 6 MEASURE
          One oversized canvas. The section is the chart. */}
      <section id="measure" className="border-b border-line bg-surface">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:py-24">
          <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
            <div className="max-w-2xl">
              <h2 className="display-sm text-ink">
                Quality on one axis. Evidence on the other.
              </h2>
            </div>
            <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-muted">
              {[
                ["bg-positive", "Excellent"],
                ["bg-positive", "Strong"],
                ["bg-caution", "Fair"],
                ["bg-critical", "Needs review"],
              ].map(([dot, label]) => (
                <li key={label} className="inline-flex items-center gap-1.5">
                  <span aria-hidden className={`size-1.5 rounded-full ${dot}`} />
                  {label}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-8 overflow-hidden rounded-xl bg-surface card-shadow">
            <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-rule px-5 py-3">
              <span className="label-caps text-ink-muted">
                Data confidence against SENSO Health
              </span>
              <span className="text-sm text-ink-subtle">
                Every scored profile in the cohort
              </span>
            </div>
            <div className="px-5 py-5">
              <QualityCanvas />
            </div>
            <div className="border-t border-rule bg-sunken/50 px-5 py-3 text-base text-ink-muted">
              The top-right quadrant is where a shortlist should be drawn from: creators
              scoring above 70 on evidence that is itself above 70% confident. The cluster
              low and to the right is the case this axis exists to expose — a strong score
              standing on history too thin to rely on, which every other tool in this
              category would have shown you as a clean number.
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================== FOUNDATION
          A horizontal track, not a card grid. */}
      <section className="border-b border-line bg-sunken">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
          <div className="max-w-2xl">
            <h2 className="text-title font-semibold tracking-display text-ink">
              Where the numbers come from.
            </h2>
          </div>

          <ol className="mt-9 grid gap-y-6 border-t border-line pt-6 md:grid-cols-5 md:gap-x-6">
            {PIPELINE.map((stage, index) => (
              <li
                key={stage.label}
                className={
                  stage.inferred
                    ? "border-l border-dashed border-inferred-line pl-4 md:border-l md:pl-5"
                    : "border-l border-line pl-4 md:pl-5 md:first:border-l-0 md:first:pl-0"
                }
              >
                <span className="font-num text-xs text-ink-subtle">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <p
                  className={`mt-1.5 text-base font-semibold ${
                    stage.inferred ? "text-inferred" : "text-ink"
                  }`}
                >
                  {stage.label}
                </p>
                <p className="mt-0.5 text-sm leading-5 text-ink-muted">{stage.note}</p>
              </li>
            ))}
          </ol>

          <p className="mt-8 max-w-3xl text-base text-ink-muted">
            A cohort of fewer than eight creators publishes no percentile. A rank computed
            against two accounts is noise wearing the costume of a statistic, and it would
            be the most quotable number on the page.
          </p>
        </div>
      </section>

      {/* =============================================================== CTA */}
      <section className="bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-10 gap-y-5 px-4 py-12 sm:px-6">
          <div className="max-w-xl">
            <h2 className="text-title font-semibold tracking-display text-ink">
              Start with five searches.
            </h2>
            <p className="mt-2 text-base leading-6 text-ink-muted">
              The free plan includes five influencer searches per month. Saved profiles,
              shortlists and comparisons stay available whether or not you have searches
              left.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <LinkButton href="/register" variant="primary" size="lg">
              Request a demo
            </LinkButton>
            <LinkButton href="/pricing" size="lg">
              See plans
            </LinkButton>
          </div>
        </div>
      </section>
    </MarketingChrome>
  );
}
