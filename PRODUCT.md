# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Three confirmed audiences, deliberately **co-primary** — no single audience wins a design
conflict by default, and each conflict is resolved on its own merits rather than by rank.

- **Client organisations (brand and agency teams).** Marketing managers, campaign
  strategists and agency planners deciding *"should we work with this creator?"* and later
  *"how did this creator perform?"* They work in the client workspace: discovery, profile
  dossiers, comparison, shortlists, campaigns, reports, usage, API portal. Two roles:
  `client_owner` (adds billing and API keys) and `client_member`.
- **SocialOrbit platform staff.** `super_admin`, `manager` and `analytics_manager` maintain
  the shared influencer database and the trust layer: connectors, ingestion runs, AI jobs,
  verification review, anomaly queue, benchmarks, orgs, audit, system config. Their work is
  queue- and evidence-driven, not exploratory.
- **Creators (influencers).** Own their profile, connect their own accounts via OAuth,
  claim verification, read their own authorized analytics, and file correction requests
  against facts the platform holds about them.

Every audience is doing a job with consequences attached — a spend decision, a trust
decision, or a claim about themselves — so none of the three surfaces is decorative.

## Product Purpose

SocialOrbit maintains a proprietary, continuously refreshed influencer database and turns
it into decision support. It answers two questions with numbers a user can defend in a
meeting: *should I work with this creator*, and *how did this creator perform for my
campaign*.

Pipeline: official/authorized APIs and permitted research → normalized database →
historical snapshots → deterministic analytics → AI enrichment (explanation and
classification only) → explainable scoring → advanced search → role dashboards → external
v1 API.

Success is a user acting on a SocialOrbit figure and being able to show where it came from.

## Positioning

**Every surfaced fact carries its provenance, and the scores are reproducible arithmetic —
not model output.**

The mechanism a neighbouring product could not truthfully copy:

- Scores are computed by versioned backend formulas. Given the same inputs they return the
  same output forever; every component value and input metric is stored alongside the
  score. AI explains a score and never changes one.
- Five source tiers rank every fact (official platform API → OAuth-authorized account →
  licensed provider → permitted public-web research → AI inference), and the interface
  renders `verified`, `observed`, `inferred` and `estimated` differently, always with
  freshness.
- Confidence is a separate axis from quality, with its own components and bands. A
  high-quality score with thin evidence says so.
- Absent is not zero. Unmeasurable components are excluded and labelled rather than
  defaulted; `unknown` risk means "no audience-quality signal was measurable", not "low
  risk". Verified status comes only from OAuth account matching, never from public data.
- Cohorts below eight creators publish no benchmark percentile.

## Operating Context

- **Client workflow:** search and facet the shared database → read a creator dossier and
  its provenance → compare candidates → shortlist and annotate → hand the shortlist to a
  campaign with a required unique hashtag → track → read separately-computed campaign
  performance. Findings leave the product as reports, CSV/webhook exports, or through
  Slack, Teams and email integrations.
- **Free plan reality:** five Influencer Intelligence searches per month, enforced
  server-side. Evaluation happens under a visible, hard budget.
- **Staff workflow:** run connector harvests against a daily API quota, review what came
  back through four queues (verification, anomalies, score review, corrections), enrich in
  explicit batched operator actions, and answer to an audit log.
- **Creator workflow:** connect accounts, prove ownership, read own analytics, dispute a
  fact.
- **Machine consumers:** the versioned public `/api/v1` reads the same service layer the
  interface does, authenticated by hashed API keys with scopes and quotas.

## Capabilities and Constraints

Built and exercised end to end: authentication and sessions, RBAC and tenant isolation
enforced in the repository layer, normalization and append-only historical snapshots, the
deterministic analytics engine, the deterministic scoring engine (nine weighted health
components, renormalising when a component is unmeasurable), risk scoring with a
dominant-signal floor, confidence scoring, campaign fit as a ranking model, cohort
benchmarks, search and discovery with server-enforced quota, the influencer profile,
comparison, shortlists, campaigns with campaign-specific scoring, reports, the API portal
and public v1 API, the admin workspace and its queues, the creator portal, and the
integrations catalog (Slack, Teams, email, CSV/webhook export).

Confirmed constraints:

- **Two intelligence engines exist; the third does not.** Influencer Intelligence and
  Campaign Intelligence are built. Consumer Intelligence is deferred — no defined data
  source exists for it in either source document.
- **The database is real and small in coverage.** 627 real YouTube channels and 30,759
  indexed uploads. Whole regions of the interface are legitimately empty for every
  creator: no audience demographics, no bot-risk signal on API-key-only ingestion, no
  verified creators, and benchmarks only where a cohort reaches eight.
- **Snapshot history is four days deep for 627 of 631 creators.** No period-over-period
  delta may be shown on any org-level figure; charts render an explicit "building history"
  state instead. This is data-confidence behaviour, not a placeholder.
- **AI is bounded by schema, not prompt.** The AI layer may classify category/niche/
  language, judge comment quality and brand safety from comments actually read, extract
  structured facts, summarise, explain scores, and assess campaign fit qualitatively. It
  may not produce follower counts, engagement numbers, view counts, demographics, bot
  percentages or any historical metric — there is no schema field to hold one.
- **No database yet.** PostgreSQL and live platform credentials are deferred; all access
  already runs through repository interfaces written against them. TikTok, AI rate
  negotiation, payments, contracts and CRM are out of scope.
- **Deployment shape:** one Next.js deployable plus one worker entry point over a shared
  service layer.
- **Terminology that must stay exact:** health score, confidence, risk (`unknown` is a
  measurability state, not a severity), campaign fit, source tier, fact kind
  (`verified` / `observed` / `inferred` / `estimated`), cohort, shortlist, campaign
  hashtag, snapshot, formula version.

## Brand Commitments

- **Name:** SocialOrbit. Descriptor: "Influencer Intelligence".
- **Mark:** an orbit — a body, its path, and a satellite on that path, creators moving
  around a brand. Drawn in code (`src/components/shell/logo.tsx`) rather than imported, so
  it inherits colour and stays crisp at rail size. This is the real, binding mark.
- **Voice:** authoritative, quiet, precise. The product states what it measured and what it
  could not. Candour about gaps is the brand, not a caveat on it — a homepage promising
  features the product lacks is the most expensive possible lie for a product whose pitch
  is that its numbers are checkable.
- **Marketing surfaces render the real product components**, not pictures of them, and
  every fabricated value on them is quarantined in one module so a reader can check in one
  place which figures were chosen rather than measured.
- Capabilities that do not exist are never depicted: no natural-language query, no ROI
  model, no audience demographics.

## Evidence on Hand

**Real:**

- The influencer database itself — 627 real YouTube channels, 30,759 indexed uploads,
  ingested through official platform APIs. Coverage figures on public surfaces are read
  live from `databaseStats()`.
- The verification record in `docs/STATUS.md`: TypeScript strict clean, 66 unit tests, 140
  E2E passing across desktop and mobile, zero accessibility findings, RBAC and
  tenant-isolation probes held, chart palette passing the six-check validator.
- The plan **structure** on `/pricing` is committed product fact: Free (5 searches/month,
  2 seats, no campaigns/API/exports), Growth (500 searches, 10 seats, 50,000 API
  requests/month, all features), Enterprise (unlimited searches and seats, all features).
- The source documents: `docs/SocialOrbit_Influencer_Intelligence_Platform_DPR.docx` and
  `docs/Influencer_Platform_Architecture.docx`.

**Absent — future work must not fabricate any of these:**

- **No citable customers.** No named clients, customer logos, testimonials, quotes,
  results or case studies exist or may be shown.
- **No monetary prices.** The plans carry allowances, seats and features; no currency
  amount has been decided. Do not invent one.
- No press, awards, funding, headcount or adoption figures.
- No audience demographics, bot-risk percentages or verified-creator examples in the data.
- No period-over-period growth figure for the platform or any org.

## Product Principles

1. **A number must be defensible.** Anything surfaced carries its source tier, collection
   time and confidence, and can be opened to see the method and formula that produced it.
2. **Deterministic where it counts, AI only where it explains.** Formulas produce scores;
   the model produces language and classification. The boundary is enforced by schema.
3. **Absence is stated, never filled.** An empty region, an `unknown` risk band, a withheld
   percentile and a "building history" chart are all correct output. Manufacturing a number
   to avoid an empty state is the one unrecoverable failure.
4. **Confidence is not quality.** The two axes stay visually and structurally separate, in
   the data model and on screen.
5. **Enforcement is server-side; the interface is a convenience.** RBAC, tenant isolation
   and quota are decided in the repository and service layers. Hiding a control is never a
   control.

## Accessibility & Inclusion

No formal external standard has been made binding. The practised floor, already enforced in
CI, stands: keyboard reachable, visible focus, semantic HTML, labelled controls,
contrast-checked, accessible dialogs and tables, axe-clean at desktop and mobile widths, no
page-level horizontal scroll at 390 / 768 / 1024 / 1440, and a chart palette validated for
colour-vision deficiency. Density is high by design, which raises rather than lowers the
target-size and contrast obligations.

Open decision: whether to commit to WCAG 2.2 AA (or a VPAT / Section 508 conformance
record) for enterprise procurement. Not decided; do not claim conformance until it is.
