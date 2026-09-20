import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { formatCompact } from "@/lib/format";
import { databaseStats } from "@/server/repositories/ops-repository";
import { LinkButton } from "@/components/ui/button";
import { MarketingChrome } from "@/components/shell/marketing-chrome";
import { CountUp } from "@/components/marketing/count-up";
import { collectedAgo, landingCreators, landingFacets, landingQualityPoints } from "@/components/marketing/live";
import { Reveal } from "@/components/marketing/reveal";
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
 * Three rules govern the composition (CLAUDE.md D40):
 *
 *   1. The product carries the argument. Every section leads with a surface
 *      composed from the application's own components, and the prose around it
 *      is at most two lines. A visitor who reads nothing should still be able
 *      to see discovery, evaluation, verification, campaigns and analysis.
 *   2. One grid. Every band sits in the same container with its heading on
 *      the same left edge; the previous page mixed three widths and two
 *      alignments, and the gutter jumping from band to band was most of what
 *      made it read as assembled rather than designed.
 *   3. One ground. The page is the canvas throughout, with white surfaces on
 *      it — no alternating bands, no rule between sections, and nothing
 *      overlapping anything else. Depth is spent on the product surfaces only.
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

const WRAP = "mx-auto max-w-6xl px-5 sm:px-8";

/** Every band opens the same way: a numbered kicker, a heading, at most one lede. */
function SectionHeader({
  kicker,
  title,
  lede,
  className,
}: {
  kicker: string;
  title: string;
  lede?: string;
  className?: string;
}) {
  return (
    <Reveal className={className}>
      <p className="label-caps text-brand-ink">{kicker}</p>
      <h2 className="display-sm mt-3 max-w-2xl text-ink">{title}</h2>
      {lede && <p className="mt-4 max-w-2xl text-md leading-7 text-ink-muted">{lede}</p>}
    </Reveal>
  );
}

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
          on, and the creator surface set in it as a white card. */}
      <section className="relative overflow-hidden">
        {/* One soft bloom behind the surface: the page's single decorative
            gradient, and it sits behind a product surface rather than on one. */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-40 top-0 size-[40rem] rounded-full bg-brand/10 blur-3xl lg:-right-10"
        />
        <div className={`${WRAP} relative grid items-center gap-x-16 gap-y-12 pb-16 pt-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:pb-20 lg:pt-24`}>
          <Reveal load>
            <h1 className="display-lg text-ink">
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

          <Reveal load delay={140} className="min-w-0">
            <DossierMasthead live={dossier} />
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

        {/* The five stops, stated once. Every band after this demonstrates one
            of them, in this order. */}
        <div className={`${WRAP} pb-4`}>
          <Reveal
            as="ol"
            stagger
            className="grid divide-y divide-rule rounded-2xl bg-surface shadow-popover md:grid-cols-5 md:divide-x md:divide-y-0"
          >
            {JOURNEY.map((stop, index) => (
              <li key={stop.href}>
                <a href={stop.href} className="group block px-5 py-5">
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
          </Reveal>
        </div>
      </section>

      {/* ========================================================= 1 DISCOVER
          The surface is the section: one line of copy, then the product at
          full width. */}
      <section id="discover" className="scroll-mt-16">
        <div className={`${WRAP} py-16 lg:py-20`}>
          <SectionHeader
            kicker="01 · Discover"
            title="Don't choose creators by follower count."
            lede="Search a real index on audience quality. Every facet carries a live count, and the sort is the score, not the size."
          />

          <Reveal className="mt-10">
            <DiscoverySurface
              rows={rows.length >= 5 ? rows : undefined}
              facets={rows.length >= 5 ? facets : undefined}
              matching={rows.length >= 5 ? stats.totalInfluencers : undefined}
            />
          </Reveal>

          <Reveal
            as="dl"
            stagger
            className="mt-10 grid divide-y divide-line border-t border-line md:grid-cols-3 md:divide-x md:divide-y-0"
          >
            {DISCOVER_OUTCOMES.map((outcome) => (
              <div key={outcome.title} className="py-5 md:px-6 md:first:pl-0 md:last:pr-0">
                <dt className="text-md font-semibold text-ink">{outcome.title}</dt>
                <dd className="mt-1.5 text-base leading-6 text-ink-muted">
                  {outcome.body}
                </dd>
              </div>
            ))}
          </Reveal>
        </div>
      </section>

      {/* ========================================================= 2 EVALUATE
          Sticky split: the copy holds while the dossier scrolls past it. */}
      <section id="evaluate" className="scroll-mt-16">
        <div className={`${WRAP} grid gap-x-16 gap-y-10 py-20 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-start lg:py-24`}>
          <div className="lg:sticky lg:top-24">
            <SectionHeader
              kicker="02 · Evaluate"
              title="Understand the creator behind the audience."
            />
            <Reveal as="dl" stagger className="mt-8 divide-y divide-rule border-t border-rule">
              {EVALUATE_POINTS.map((point) => (
                <div key={point.title} className="py-4">
                  <dt className="text-base font-semibold text-ink">{point.title}</dt>
                  <dd className="mt-1 text-base leading-6 text-ink-muted">{point.body}</dd>
                </div>
              ))}
            </Reveal>
          </div>

          <Reveal className="min-w-0">
            <CreatorDossier live={dossier} />
          </Reveal>
        </div>
      </section>

      {/* =========================================================== 3 VERIFY
          The interaction is the explanation: the panel drawn open beside the
          figure it explains. */}
      <section id="verify" className="scroll-mt-16">
        <div className={`${WRAP} py-16 lg:py-20`}>
          <div className="grid items-start gap-x-16 gap-y-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
            <SectionHeader
              kicker="03 · Verify"
              title="Every important number carries its evidence."
              lede="Most tools hand you a confident figure and no way to check it. Ours shows its working — on any number you might have to defend in a meeting."
            />
            <Reveal className="min-w-0">
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
            </Reveal>
          </div>

          <Reveal
            as="ol"
            stagger
            className="mt-12 grid divide-y divide-rule rounded-2xl bg-surface shadow-popover md:grid-cols-5 md:divide-x md:divide-y-0"
          >
            {FACT_STATES.map((state) => (
              <li key={state.label} className="px-5 py-4">
                <p className="flex items-center gap-1.5">
                  <state.icon className={`size-3.5 ${state.tone}`} aria-hidden />
                  <span className="label-caps text-ink">{state.label}</span>
                </p>
                <p className="mt-1.5 text-sm leading-5 text-ink-muted">{state.detail}</p>
              </li>
            ))}
          </Reveal>

          <Reveal as="p" className="mt-6 max-w-3xl text-base leading-6 text-ink-muted">
            Sources are ranked, and the ranking is visible. An official API measurement
            outranks permitted public research, which outranks model inference — and where
            two sources disagree, the conflict is raised for a human rather than silently
            resolved in the platform&apos;s favour.
          </Reveal>
        </div>
      </section>

      {/* =============================================================== 4 AI
          The output on one side, the constraint on the other. The constraint
          is the sales argument, so it is set as plainly as the output. */}
      <section id="intelligence" className="scroll-mt-16">
        <div className={`${WRAP} py-16 lg:py-20`}>
          <SectionHeader
            kicker="Intelligence layer"
            title="AI explains the score. It never sets it."
          />

          <div className="mt-10 grid items-start gap-x-16 gap-y-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
            <Reveal className="min-w-0">
              <EnrichmentExtract />
            </Reveal>

            <Reveal>
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
            </Reveal>
          </div>
        </div>
      </section>

      {/* ========================================================= 5 ACTIVATE
          Two surfaces side by side, the campaign readout and the roster it
          scores — at one elevation, on one grid. */}
      <section id="activate" className="scroll-mt-16">
        <div className={`${WRAP} py-16 lg:py-20`}>
          <SectionHeader
            kicker="04 · Activate"
            title="From creator selection to measurable delivery."
            lede="Select talent from a shortlist, record the agreed rate, set a tracking hashtag, and SENSO attributes what each creator actually delivered."
          />

          <div className="mt-10 grid items-start gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
            <Reveal>
              <CampaignDeliveryPanel />
            </Reveal>
            <Reveal delay={100} className="min-w-0">
              <CampaignLeaderboard />
            </Reveal>
          </div>

          <Reveal as="p" className="mt-8 max-w-3xl text-base leading-6 text-ink-muted">
            A creator&apos;s campaign performance is scored separately from their
            SENSO Health — the first answers &ldquo;how did they do for us?&rdquo;,
            the second &ldquo;who are they?&rdquo;. The two are never merged, and both
            carry their own formula version.
          </Reveal>
        </div>
      </section>

      {/* ========================================================== 6 MEASURE
          One oversized canvas. The section is the chart. */}
      <section id="measure" className="scroll-mt-16">
        <div className={`${WRAP} py-16 lg:py-20`}>
          <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
            <SectionHeader
              kicker="05 · Measure"
              title="Quality on one axis. Evidence on the other."
            />
            <Reveal as="ul" className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-muted">
              {[
                ["bg-positive", "Excellent"],
                ["bg-series-1", "Strong"],
                ["bg-caution", "Fair"],
                ["bg-critical", "Needs review"],
              ].map(([dot, label]) => (
                <li key={label} className="inline-flex items-center gap-1.5">
                  <span aria-hidden className={`size-1.5 rounded-full ${dot}`} />
                  {label}
                </li>
              ))}
            </Reveal>
          </div>

          <Reveal className="mt-8 overflow-hidden rounded-xl bg-surface shadow-overlay">
            <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line bg-sunken px-4 py-2.5">
              <span className="label-caps text-ink-muted">
                Data confidence against SENSO Health
              </span>
              <span className="text-sm text-ink-subtle">
                Every scored profile in the index
              </span>
            </div>
            <div className="px-5 py-5">
              <QualityCanvas points={quality.length >= 50 ? quality : undefined} />
            </div>
            <div className="border-t border-rule px-5 py-3.5 text-base leading-6 text-ink-muted">
              {quality.length >= 50
                ? "Confidence sits in the middle band for every creator: the index is read from official platform APIs, and no creator has yet connected an account. A creator scoring 90 on that evidence is exactly the case this axis exists to expose — and what every other tool would show you as a clean 90."
                : "Draw a shortlist from the top-right quadrant: creators scoring above 70 on evidence that is itself above 70% confident. The cluster low and to the right is the case this axis exists to expose — a strong score on history too thin to rely on."}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ======================================================== FOUNDATION
          The live figures and the pipeline behind them, in one band. */}
      <section className="scroll-mt-16">
        <div className={`${WRAP} grid gap-x-16 gap-y-10 py-20 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:py-24`}>
          <div>
            <SectionHeader
              kicker="Foundation"
              title="Where the numbers come from."
              lede="Live from the SENSO database as this page rendered. Collected from official platform APIs and creator-authorised accounts — no prohibited scraping, and no purchased list."
            />
            <Reveal as="dl" stagger className="mt-8 grid grid-cols-2 gap-x-6 gap-y-6">
              {live.map((figure) => (
                <div key={figure.label} className="min-w-0">
                  <dd className="font-num text-metric font-semibold leading-none text-ink">
                    <CountUp value={figure.raw} text={figure.value} />
                  </dd>
                  <dt className="mt-1.5 text-sm text-ink-subtle">{figure.label}</dt>
                </div>
              ))}
            </Reveal>
          </div>

          <Reveal
            as="ol"
            stagger
            className="divide-y divide-rule self-start rounded-2xl bg-surface px-6 shadow-popover"
          >
            {PIPELINE.map((stage, index) => (
              <li key={stage.label} className="grid grid-cols-[2.5rem_1fr] items-baseline gap-x-4 py-4">
                <span className="font-num text-sm text-ink-subtle">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-0.5">
                  <p
                    className={`text-md font-semibold ${
                      stage.inferred ? "text-inferred" : "text-ink"
                    }`}
                  >
                    {stage.label}
                  </p>
                  <p className="text-sm text-ink-muted">{stage.note}</p>
                </div>
              </li>
            ))}
          </Reveal>
        </div>
      </section>

      {/* =============================================================== CTA
          The one feature card on the page: the mark's tile, used once. */}
      <section>
        <div className={`${WRAP} pb-16 pt-2 lg:pb-20`}>
          <Reveal className="relative overflow-hidden rounded-3xl bg-instrument px-6 py-12 text-instrument-ink sm:px-10 lg:px-14 lg:py-16">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-brand-glow/25 blur-3xl"
            />
            <div className="relative flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
              <div className="max-w-xl">
                <h2 className="display-sm text-instrument-ink">
                  Bring your own shortlist.
                </h2>
                <p className="mt-4 text-md leading-7 text-instrument-muted">
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
          </Reveal>
        </div>
      </section>
    </MarketingChrome>
  );
}
