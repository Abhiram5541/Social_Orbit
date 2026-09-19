import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { formatCompact } from "@/lib/format";
import { databaseStats } from "@/server/repositories/ops-repository";
import { LinkButton } from "@/components/ui/button";
import { MarketingChrome } from "@/components/shell/marketing-chrome";
import { CountUp } from "@/components/marketing/count-up";
import { collectedAgo, landingCreators, landingFacets, landingQualityPoints } from "@/components/marketing/live";
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
  toLiveDossier,
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
 * The page is the product's own material — the soft canvas and white cards
 * the application is built from — rather than a dark housing around it.
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
  { href: "#discover", label: "Discover", note: "Search a real index on audience quality, not size." },
  { href: "#evaluate", label: "Evaluate", note: "A deterministic health score with its confidence beside it." },
  { href: "#verify", label: "Verify", note: "Every figure names its source, method and freshness." },
  { href: "#activate", label: "Activate", note: "Shortlist, agree rates, track the hashtag." },
  { href: "#measure", label: "Measure", note: "Campaign performance scored on its own axis." },
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
  // A real creator for the hero and the dossier, real rows for the search
  // surface, real facet counts and the real quality scatter. The campaign and
  // AI examples stay illustrative (live.ts says why) and are disclosed.
  const { hero, rows } = landingCreators();
  const dossier = hero ? toLiveDossier(hero, rows[0]) : null;
  const facets = landingFacets();
  const quality = landingQualityPoints();
  const live = [
    { label: "Creators indexed", raw: stats.totalInfluencers, value: formatCompact(stats.totalInfluencers) },
    { label: "Content items read", raw: stats.totalContent, value: formatCompact(stats.totalContent) },
    { label: "Historical snapshots", raw: stats.totalSnapshots, value: formatCompact(stats.totalSnapshots) },
    { label: "Markets", raw: stats.byCountry.length, value: formatCompact(stats.byCountry.length) },
  ];

  return (
    <MarketingChrome>
      {/* ============================================================== HERO
          The product's own material: the soft canvas the application sits
          on, and the creator surface set in it as a white card. The page no
          longer opens inside a dark housing — the people who buy this are
          marketing teams, and the first screen should look like the tool
          they will use, not the instrument it is built on. */}
      <section className="relative overflow-hidden bg-canvas">
        {/* One soft bloom behind the surface: the page's single decorative
            gradient, and it sits behind a product surface rather than on one. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-40 top-10 size-[38rem] rounded-full bg-brand/10 blur-3xl lg:-right-20"
        />
        <div className="relative mx-auto grid max-w-6xl items-center gap-x-14 gap-y-12 px-4 pb-16 pt-14 sm:px-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:pb-24 lg:pt-20">
          <Reveal>
            <p className="inline-flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 text-sm font-medium text-ink-muted card-shadow">
              <span aria-hidden className="size-1.5 rounded-full bg-brand" />
              Influencer intelligence for marketing teams
            </p>
            <h1 className="display-lg mt-6 text-ink">
              Find the creators worth betting your brand on.
            </h1>
            <p className="mt-6 max-w-xl text-md leading-7 text-ink-muted">
              SENSO is the intelligence layer between a shortlist and a signed
              creator: discovery, evaluation, verification and campaign measurement,
              with evidence behind every important number.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <LinkButton href="/register" variant="primary" size="lg">
                Request a demo
              </LinkButton>
              <LinkButton href="#discover" size="lg" className="gap-2">
                See how it works
                <ArrowRight className="size-4" aria-hidden />
              </LinkButton>
            </div>

            {/* The live coverage figures belong where the claim is made. */}
            <dl className="mt-12 grid max-w-lg grid-cols-3 gap-x-6 border-t border-line pt-6">
              {live.slice(0, 3).map((figure) => (
                <div key={figure.label} className="min-w-0">
                  <dd className="font-num text-stat-lg font-semibold leading-none text-ink">
                    <CountUp value={figure.raw} text={figure.value} />
                  </dd>
                  <dt className="mt-1.5 text-sm text-ink-subtle">{figure.label}</dt>
                </div>
              ))}
            </dl>
          </Reveal>

          <Reveal delay={120} className="min-w-0 lg:-mr-6 xl:-mr-12">
            <PointerGlow tilt className="rounded-2xl bg-surface text-ink shadow-lifted">
              <DossierMasthead live={dossier} />
            </PointerGlow>
            {/* The page's one disclosure. Repeating it on every surface would
                read as defensiveness; withholding it, on a product whose pitch
                is that its numbers are checkable, worse. */}
            <p className="mt-4 text-sm text-ink-subtle">
              {dossier
                ? "Creators, scores and coverage on this page are live from the SENSO database. The campaign and AI examples are illustrative."
                : "Product surfaces on this page are the real interface, rendered with illustrative creators. Coverage figures are live."}
            </p>
          </Reveal>
        </div>
      </section>

      {/* =========================================================== JOURNEY
          The five stops, stated once as one divided strip. Every band after
          this demonstrates one of them, in this order. */}
      <section className="border-y border-line bg-surface">
        <ol className="mx-auto grid max-w-6xl divide-y divide-rule px-4 sm:px-6 md:grid-cols-5 md:divide-x md:divide-y-0">
          {JOURNEY.map((stop, index) => (
            <li key={stop.href}>
              <a
                href={stop.href}
                className="group block py-5 md:px-5 md:first:pl-0 md:last:pr-0"
              >
                <span className="font-num text-xs text-ink-subtle">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="mt-1 flex items-center gap-1.5 text-md font-semibold text-ink">
                  {stop.label}
                  <ArrowRight
                    className="size-3.5 text-ink-subtle transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </span>
                <span className="mt-1 block text-sm leading-5 text-ink-muted">
                  {stop.note}
                </span>
              </a>
            </li>
          ))}
        </ol>
      </section>

      {/* ========================================================= 1 DISCOVER
          The surface is the section: one line of copy, then the product at
          full width. */}
      <section id="discover" className="bg-canvas">
        <div className="mx-auto max-w-7xl px-4 pb-16 pt-20 sm:px-6 lg:pb-20 lg:pt-24">
          <Reveal className="mx-auto max-w-3xl text-center">
            <p className="label-caps text-brand-ink">01 · Discover</p>
            <h2 className="display-sm mt-3 text-ink">
              Don&apos;t choose creators by follower count.
            </h2>
          </Reveal>

          <div className="mt-10">
            <DiscoverySurface
              rows={rows.length >= 5 ? rows : undefined}
              facets={rows.length >= 5 ? facets : undefined}
              matching={rows.length >= 5 ? stats.totalInfluencers : undefined}
            />
          </div>

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
          Sticky split: the copy holds while the dossier scrolls past it. */}
      <section id="evaluate" className="border-t border-line bg-surface">
        <div className="mx-auto grid max-w-6xl gap-x-12 gap-y-8 px-4 py-20 sm:px-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-start lg:py-24">
          <div className="lg:sticky lg:top-24">
            <p className="label-caps text-brand-ink">02 · Evaluate</p>
            <h2 className="display-sm mt-3 text-ink">
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
            <CreatorDossier live={dossier} />
          </div>
        </div>
      </section>

      {/* =========================================================== 3 VERIFY
          The interaction is the explanation: the panel drawn open beside the
          figure it explains. */}
      <section id="verify" className="border-t border-line bg-canvas">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
          <div className="grid items-start gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <div>
              <p className="label-caps text-brand-ink">03 · Verify</p>
              <h2 className="display-sm mt-3 text-ink">
                Every important number carries its evidence.
              </h2>
              <p className="mt-5 max-w-md text-md leading-6 text-ink-muted">
                Most tools hand you a confident figure and no way to check it. Ours shows
                its working — on any number you might have to defend in a meeting.
              </p>
            </div>
            <ProvenanceDossier
              live={
                dossier
                  ? {
                      engagement: dossier.creator.engagement,
                      collected: collectedAgo(dossier.profile),
                      confidence: dossier.creator.confidence,
                      sourceUrl: dossier.profile.socialAccounts[0]?.url ?? null,
                    }
                  : null
              }
            />
          </div>

          <ol className="mt-12 grid divide-y divide-line rounded-xl bg-surface px-5 card-shadow lg:grid-cols-5 lg:divide-x lg:divide-y-0 lg:px-0">
            {FACT_STATES.map((state) => (
              <li key={state.label} className="py-4 lg:px-5">
                <p className="flex items-center gap-1.5">
                  <state.icon className={`size-3.5 ${state.tone}`} aria-hidden />
                  <span className="label-caps text-ink">{state.label}</span>
                </p>
                <p className="mt-1.5 text-sm leading-5 text-ink-muted">{state.detail}</p>
              </li>
            ))}
          </ol>

          <p className="mt-6 max-w-3xl text-base text-ink-muted">
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
      <section id="intelligence" className="border-t border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <p className="label-caps text-brand-ink">Intelligence layer</p>
            <h2 className="display-sm mt-3 text-ink">
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
                    <span aria-hidden className="h-px w-4 shrink-0 bg-critical" />
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
          Offset layers — the one place two surfaces sit at different
          elevations. */}
      <section id="activate" className="border-t border-line bg-canvas">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
          <div className="mx-auto max-w-3xl">
            <p className="label-caps text-brand-ink">04 · Activate</p>
            <h2 className="display-sm mt-3 text-ink">
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
      <section id="measure" className="border-t border-line bg-surface">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:py-24">
          <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
            <div className="max-w-2xl">
              <p className="label-caps text-brand-ink">05 · Measure</p>
              <h2 className="display-sm mt-3 text-ink">
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
              <QualityCanvas points={quality.length >= 50 ? quality : undefined} />
            </div>
            <div className="border-t border-rule bg-sunken/50 px-5 py-3 text-base text-ink-muted">
              {quality.length >= 50
                ? "Every creator in the index, as scored today. Confidence sits in the middle band for all of them: the index is read from official platform APIs, and no creator has yet connected an account. A creator scoring 90 on that evidence is exactly the case this axis exists to expose — and exactly what every other tool in this category would have shown you as a clean 90."
                : "The top-right quadrant is where a shortlist should be drawn from: creators scoring above 70 on evidence that is itself above 70% confident. The cluster low and to the right is the case this axis exists to expose — a strong score standing on history too thin to rely on, which every other tool in this category would have shown you as a clean number."}
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================== FOUNDATION
          The live figures and the pipeline behind them, in one band. */}
      <section className="border-t border-line bg-canvas">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 lg:py-24">
          <div className="grid gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
            <div>
              <p className="label-caps text-brand-ink">Foundation</p>
              <h2 className="display-sm mt-3 text-ink">
                Where the numbers come from.
              </h2>
              <p className="mt-4 text-base leading-6 text-ink-muted">
                Live from the SENSO database as this page rendered. Collected from
                official platform APIs and creator-authorised accounts — no prohibited
                scraping, and no purchased list.
              </p>
              <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-6">
                {live.map((figure) => (
                  <div key={figure.label} className="min-w-0">
                    <dd className="font-num text-metric font-semibold leading-none text-ink">
                      {figure.value}
                    </dd>
                    <dt className="mt-1.5 text-sm text-ink-subtle">{figure.label}</dt>
                  </div>
                ))}
              </dl>
            </div>

            <ol className="grid divide-y divide-rule rounded-xl bg-surface px-5 card-shadow sm:grid-cols-2 sm:divide-x sm:divide-y-0 md:grid-cols-5 md:px-0">
              {PIPELINE.map((stage, index) => (
                <li key={stage.label} className="py-4 sm:px-4 md:px-4">
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
          </div>

          <p className="mt-8 max-w-3xl text-sm text-ink-subtle">
            A cohort of fewer than eight creators publishes no percentile. A rank computed
            against two accounts is noise wearing the costume of a statistic, and it would
            be the most quotable number on the page.
          </p>
        </div>
      </section>

      {/* =============================================================== CTA
          The one feature card on the page: the mark's tile, used once. */}
      <section className="border-t border-line bg-canvas">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
          <div className="relative overflow-hidden rounded-2xl bg-instrument px-6 py-12 text-instrument-ink sm:px-10 lg:px-14 lg:py-16">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-brand-glow/25 blur-3xl"
            />
            <div className="relative flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
              <div className="max-w-xl">
                <h2 className="display-sm text-instrument-ink">
                  Bring your own shortlist.
                </h2>
                <p className="mt-4 text-md leading-6 text-instrument-muted">
                  Start with five searches a month, free. Saved profiles, shortlists and
                  comparisons stay available whether or not you have searches left.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <LinkButton href="/register" variant="primary" size="lg">
                  Request a demo
                </LinkButton>
                <LinkButton
                  href="/pricing"
                  size="lg"
                  variant="ghost"
                  className="text-instrument-ink hover:bg-instrument-raised hover:text-instrument-ink"
                >
                  See plans
                </LinkButton>
              </div>
            </div>
          </div>
        </div>
      </section>
    </MarketingChrome>
  );
}
