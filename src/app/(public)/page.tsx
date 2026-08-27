import type { Metadata } from "next";
import {
  BadgeCheck,
  Blocks,
  Code2,
  Database,
  GitBranch,
  Megaphone,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { HEALTH_COMPONENT_LABEL, HEALTH_WEIGHTS } from "@/lib/contracts/score";
import { LinkButton } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, Eyebrow } from "@/components/ui/card";
import { ScoreBar, ScoreRing } from "@/components/intelligence/score";
import * as React from "react";
import { MarketingChrome } from "@/components/shell/marketing-chrome";

export const metadata: Metadata = {
  title: "SocialOrbit — Influencer Intelligence",
  description:
    "Evidence-based influencer intelligence: verified creator profiles, deterministic scoring, audience-quality signals and campaign performance measurement.",
};

/* The hero is built from the product's own components rather than a picture of
   them: what a visitor sees on this page is literally what a profile renders. */
/** How much of the profile above was measured rather than inferred. */
const PROVENANCE_MIX = [
  { label: "Verified", share: 22, bar: "bg-verified" },
  { label: "Observed", share: 48, bar: "bg-observed" },
  { label: "Derived", share: 16, bar: "bg-instrument-muted" },
  { label: "Estimated", share: 6, bar: "bg-estimated" },
  { label: "AI inferred", share: 8, bar: "bg-inferred" },
];

export default function LandingPage() {
  return (
    <MarketingChrome>
      {/* --- Hero ------------------------------------------------------- */}
      <section className="border-b border-line bg-surface">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:py-20">
          <div className="space-y-6">
            <Badge tone="brand">Influencer · Consumer · Campaign intelligence</Badge>
            <h1 className="text-[34px] font-semibold leading-[1.1] tracking-[-0.025em] text-ink sm:text-[44px]">
              Every number on a creator profile should say where it came from.
            </h1>
            <p className="max-w-xl text-[15px] leading-6 text-ink-muted">
              Most influencer tools hand you a confident number and no way to check it.
              SocialOrbit labels every fact — verified, observed, derived, estimated or
              AI-inferred — with its source, its collection time and its confidence, so you
              can tell a measurement from a guess before you spend a budget on it.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <LinkButton href="/register" variant="primary" size="lg">
                Request access
              </LinkButton>
              <LinkButton href="/login" size="lg">
                Sign in
              </LinkButton>
            </div>
            <p className="text-[12px] text-ink-subtle">
              Data from official platform APIs, OAuth-authorized creator accounts and
              permitted public research. No prohibited scraping.
            </p>
          </div>

          {/* The hero is the product's signature artifact, not a picture of
              it: the same instrument panel a profile renders, built from the
              same components, showing a measurement beside its own
              uncertainty. */}
          <div className="animate-rise overflow-hidden rounded-xl bg-instrument text-instrument-ink shadow-instrument">
            <header className="flex items-center justify-between gap-3 border-b border-instrument-line px-4 py-2.5">
              <span className="label-caps text-instrument-muted">SocialOrbit Health</span>
              <span className="font-num text-[11px] tracking-[0.04em] text-instrument-muted">
                health-1.0.0
              </span>
            </header>

            <div className="flex flex-wrap items-center gap-5 p-5">
              <ScoreRing value={79} size={112} tone="instrument" />
              <div className="min-w-44 flex-1 space-y-2">
                <p className="text-[18px] font-semibold leading-tight tracking-[-0.02em]">
                  Strong performance
                </p>
                <p className="text-[12px] leading-5 text-instrument-muted">
                  87th percentile of 214 technology creators in the 1M+ follower band.
                </p>
                <Badge tone="positive" dot onInstrument>
                  Low risk
                </Badge>
              </div>
            </div>

            <div className="grid gap-x-7 gap-y-3 border-t border-instrument-line px-5 py-4 sm:grid-cols-2">
              {(["authenticity", "engagementRate", "growthPattern", "brandSafety"] as const).map(
                (key, index) => (
                  <ScoreBar
                    key={key}
                    label={HEALTH_COMPONENT_LABEL[key]}
                    weight={HEALTH_WEIGHTS[key]}
                    value={[79, 90, 70, 94][index]}
                    tone="instrument"
                    index={index}
                  />
                ),
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-instrument-line px-5 py-3">
              <div className="min-w-40 flex-1 space-y-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="label-caps text-instrument-muted">Data confidence</span>
                  <span className="font-num text-[13px] font-semibold tabular-nums">91%</span>
                </div>
                <div className="h-1 overflow-hidden rounded-sm bg-instrument-line">
                  <div
                    className="animate-extend h-full rounded-sm bg-brand-glow"
                    style={{ width: "91%", "--stagger": "300ms" } as React.CSSProperties}
                  />
                </div>
                <p className="text-[11px] text-instrument-muted">
                  high confidence — separate from the score above
                </p>
              </div>
            </div>

            {/* The provenance mix: what the reader is actually looking at. */}
            <div className="border-t border-instrument-line bg-instrument-raised px-5 py-3">
              <div className="mb-2 flex h-1 overflow-hidden rounded-sm" aria-hidden>
                {PROVENANCE_MIX.map((slice) => (
                  <span
                    key={slice.label}
                    className={slice.bar}
                    style={{ width: `${slice.share}%` }}
                  />
                ))}
              </div>
              <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
                {PROVENANCE_MIX.map((slice) => (
                  <li
                    key={slice.label}
                    className="inline-flex items-center gap-1.5 text-[11px] text-instrument-muted"
                  >
                    <span className={`size-1 rounded-full ${slice.bar}`} aria-hidden />
                    {slice.label}
                    <span className="font-num tabular-nums text-instrument-ink">
                      {slice.share}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* --- The rule ---------------------------------------------------- */}
      <section id="intelligence" className="border-b border-line">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <div className="max-w-2xl space-y-3">
            <Eyebrow>The rule the platform is built on</Eyebrow>
            <h2 className="text-[26px] font-semibold tracking-[-0.02em] text-ink">
              AI explains the score. It never sets it.
            </h2>
            <p className="text-[14px] leading-6 text-ink-muted">
              Health, authenticity, engagement quality, growth and risk are computed in
              backend code by versioned formulas over stored observations. The same inputs
              produce the same score today and in three years, and every component that fed
              it is stored alongside the result. A model can classify a comment or read the
              output back to you in plain language — it cannot move the number.
            </p>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <Principle
              icon={GitBranch}
              title="Deterministic and versioned"
              body="Nine weighted components, published weights, stored inputs, a formula version on every result. Reproducible by definition."
            />
            <Principle
              icon={ShieldCheck}
              title="Confidence is its own axis"
              body="A creator can score 91 on health with 40% confidence. We show both, separately, because folding them together is the most misleading thing a tool like this can do."
            />
            <Principle
              icon={Sparkles}
              title="AI stays in its lane"
              body="Classification, extraction, summaries and explanations — each stored with its provider, model, prompt version and evidence. Never follower counts, never demographics."
            />
          </div>
        </div>
      </section>

      {/* --- Workflows --------------------------------------------------- */}
      <section id="platform" className="border-b border-line bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <div className="max-w-2xl space-y-3">
            <Eyebrow>Two workflows, one data foundation</Eyebrow>
            <h2 className="text-[26px] font-semibold tracking-[-0.02em] text-ink">
              Decide who to work with. Then measure what they delivered.
            </h2>
          </div>

          <div className="mt-8 grid gap-5 lg:grid-cols-2">
            <Workflow
              icon={Search}
              eyebrow="Workflow A"
              title="Influencer Intelligence"
              question="Should I work with this creator?"
              steps={[
                "Search by country, language, category, audience size, engagement, health, risk and campaign fit",
                "Open an evidence-based report covering the account, its audience and its content",
                "Compare creators on normalised metrics over comparable time ranges",
                "Shortlist, annotate and export",
              ]}
            />
            <Workflow
              icon={Megaphone}
              eyebrow="Workflow B"
              title="Campaign Management"
              question="How did this creator perform for us?"
              steps={[
                "Select talent from a shortlist and record agreed rates",
                "Set a tracking hashtag — every campaign requires one",
                "Attribute posts to the campaign by hashtag match",
                "Score each creator's campaign performance separately from their profile",
              ]}
            />
          </div>
        </div>
      </section>

      {/* --- Pipeline ---------------------------------------------------- */}
      <section id="verification" className="border-b border-line">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
          <div className="max-w-2xl space-y-3">
            <Eyebrow>Data foundation</Eyebrow>
            <h2 className="text-[26px] font-semibold tracking-[-0.02em] text-ink">
              Sources are ranked, and the ranking is visible.
            </h2>
            <p className="text-[14px] leading-6 text-ink-muted">
              An official API measurement outranks public research, which outranks model
              inference. Where a creator connects their account through OAuth, first-party
              analytics become available and the profile earns SocialOrbit Verified — a
              status that is never issued from public data alone.
            </p>
          </div>

          <ol className="mt-8 grid gap-3 md:grid-cols-5">
            {[
              { icon: Blocks, label: "Platform APIs", note: "YouTube, Meta" },
              { icon: BadgeCheck, label: "OAuth connection", note: "First-party analytics" },
              { icon: Database, label: "Normalise & snapshot", note: "History, never overwritten" },
              { icon: GitBranch, label: "Analytics & scoring", note: "Deterministic" },
              { icon: Sparkles, label: "AI enrichment", note: "Explained, evidenced" },
            ].map((step, index) => (
              <li
                key={step.label}
                className="flex flex-col gap-2 rounded-lg border border-line bg-surface p-3"
              >
                <div className="flex items-center gap-2">
                  <span className="font-num text-[11px] text-ink-subtle">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <step.icon className="size-4 text-brand" aria-hidden />
                </div>
                <p className="text-[13px] font-medium leading-tight text-ink">{step.label}</p>
                <p className="text-[12px] text-ink-muted">{step.note}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* --- API --------------------------------------------------------- */}
      <section id="api" className="border-b border-line bg-surface">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:items-center">
          <div className="space-y-3">
            <Eyebrow>Developer API</Eyebrow>
            <h2 className="text-[26px] font-semibold tracking-[-0.02em] text-ink">
              The same database the product runs on.
            </h2>
            <p className="text-[14px] leading-6 text-ink-muted">
              A versioned REST API over the canonical influencer record, with hashed keys,
              rotation, per-client rate limits, field-level access control and usage
              tracking. Not an export — the same service layer the application itself calls.
            </p>
            <LinkButton href="/register" size="md">
              <Code2 className="size-4" aria-hidden />
              <span className="ml-2">Get API access</span>
            </LinkButton>
          </div>

          <div className="overflow-hidden rounded-xl border border-line bg-ink">
            <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
              <span className="size-2 rounded-full bg-white/25" />
              <span className="font-num text-[11px] text-white/50">GET /v1/influencers</span>
            </div>
            <pre className="scroll-x px-3 py-3 font-num text-[12px] leading-5 text-white/80">
              <code>{`GET /v1/influencers
  ?country=IN
  &language=en
  &category=technology
  &followers_min=100000
  &followers_max=1000000
  &health_min=75
  &engagement_min=3
  &verified=true
  &sort=health_score_desc

Authorization: Bearer so_live_••••••••`}</code>
            </pre>
          </div>
        </div>
      </section>

      {/* --- CTA --------------------------------------------------------- */}
      <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-6 rounded-xl border border-line bg-surface p-6">
          <div className="space-y-1">
            <h2 className="text-[20px] font-semibold tracking-[-0.015em] text-ink">
              Start with five searches.
            </h2>
            <p className="max-w-lg text-[13px] text-ink-muted">
              The free plan includes five influencer searches per month. Saved profiles,
              shortlists and comparisons stay available whether or not you have searches
              left.
            </p>
          </div>
          <div className="flex gap-2">
            <LinkButton href="/register" variant="primary" size="lg">
              Create account
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

function Principle({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof ShieldCheck;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <span className="grid size-8 place-items-center rounded-lg border border-line bg-canvas text-brand">
        <Icon className="size-4" aria-hidden />
      </span>
      <h3 className="mt-3 text-[14px] font-semibold text-ink">{title}</h3>
      <p className="mt-1 text-[13px] leading-5 text-ink-muted">{body}</p>
    </div>
  );
}

function Workflow({
  icon: Icon,
  eyebrow,
  title,
  question,
  steps,
}: {
  icon: typeof Search;
  eyebrow: string;
  title: string;
  question: string;
  steps: string[];
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg border border-line bg-canvas text-brand">
            <Icon className="size-4" aria-hidden />
          </span>
          <div>
            <Eyebrow>{eyebrow}</Eyebrow>
            <CardTitle as="h3">{title}</CardTitle>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-[14px] font-medium italic text-ink-muted">“{question}”</p>
        <ol className="space-y-2">
          {steps.map((step, index) => (
            <li key={step} className="flex gap-2.5 text-[13px] leading-5 text-ink-muted">
              <span className="mt-0.5 font-num text-[11px] text-ink-subtle">
                {String(index + 1).padStart(2, "0")}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
