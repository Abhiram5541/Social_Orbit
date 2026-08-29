# SocialOrbit — Project Instructions

Influencer intelligence, verification, analytics and API platform. This file is the
permanent orientation document: read it before touching anything.

Sources of truth, in order:

1. `docs/SocialOrbit_Influencer_Intelligence_Platform_DPR.docx` — product & technical blueprint
2. `docs/Influencer_Platform_Architecture.docx` — workflow & intelligence-engine architecture
3. This file — decisions, deviations and assumptions made during implementation
4. `docs/ROADMAP.md` — milestone sequence, `docs/STATUS.md` — what is built today

The Stitch prototype (`~/Downloads/stitch_socialorbit_enterprise_intelligence_platform/`)
is **visual reference only**. Its information architecture and design tokens informed the
design system; its markup, mock data and page structure are not carried forward.

---

## 1. Product

SocialOrbit maintains a proprietary, continuously refreshed influencer database and turns
it into decision support: *"should I work with this creator?"* and *"how did this creator
perform for my campaign?"*

The durable pipeline, from DPR §33:

```
official/authorized APIs + permitted research
  → normalized database
  → historical snapshots
  → deterministic analytics
  → AI enrichment (explanations, classification)
  → explainable SocialOrbit scoring
  → advanced search
  → role dashboards
  → external v1 API
```

Three intelligence engines share one data foundation and one AI layer:
**Influencer Intelligence** (built), **Campaign Intelligence** (built), **Consumer
Intelligence** (deferred — no defined data source in either document).

### Non-negotiable product rules

| Rule | Source |
| --- | --- |
| Scores are computed by backend formulas, never by an LLM | DPR §10 |
| Scores are deterministic, versioned, reproducible; components stored | DPR §10, §26 |
| AI explains scores; it never changes them | Arch §6 |
| AI is an intelligence layer, not a social-data source | Arch §4, DPR §7 |
| Every fact carries source, collection time, confidence, and AI model version if AI-derived | DPR §16.1 |
| Estimated / inferred values are labelled as such and never shown as verified | DPR §22 |
| Verified status only after OAuth account matching, never from public data | Arch §2 |
| Confidence is displayed separately from quality | DPR §28 |
| Free-plan clients get 5 Influencer Intelligence searches per month, enforced server-side | Arch §3 |
| RBAC enforced server-side, not by hiding UI | DPR §22 |

---

## 2. Decisions taken (and why)

These were open in the documents. Decided here; change them here.

**D1 — Multi-tenant SaaS.** Client organisations sign up and own their own workspaces.
Every client-owned artifact (`shortlists`, `campaigns`, `saved influencers`, `api_keys`,
`usage`, `reports`) carries `orgId` and is isolated. The influencer database itself is
**global and shared** — it is the product, not tenant data. SocialOrbit staff (Super Admin,
Manager, Analytics Manager) belong to the platform org and read across tenants.
DPR §12 describes only the internal role set; the client/tenant layer sits alongside it.

**D2 — Frontend-first build order.** No database in this phase. All reads and writes go
through `src/server/repositories/*`, which currently resolve against a clearly isolated
development dataset (`src/server/data/`). PostgreSQL replaces the driver behind the same
interfaces later without touching a single component or route handler. Social platform
connectors are implemented against their real API shapes but return
`ConnectorUnavailable` until credentials are supplied.

**D3 — Single Next.js deployable + one worker entry point.** DPR §15 draws a separate API
gateway and worker fleet. A single Next app hosting `/api/v1/*` route handlers over a
shared service layer satisfies "API-first: React and external clients use the same backend
service layer" with far less infrastructure. Workers are a separate process importing the
same `src/server` code. Split into services only if a real scaling need appears.

**D4 — Scope.** DPR M01–M16 plus Architecture Workflow B (campaigns, hashtag tracking,
campaign performance scoring). Deferred with connector/engine slots left open: Consumer
Intelligence, TikTok, AI rate negotiation, payments, contracts, CRM.

**D5 — Typography deviates from the Stitch spec.** Stitch pairs Geist with Poppins for
numerals. Poppins is a geometric sans with non-tabular figures — columns misalign and
long metric tables become hard to scan, which defeats the stated "financial terminal"
thesis. Use **Geist** for interface text and **Geist Mono** for every numeric value,
metric, score, delta and table figure. This is the DESIGN.md variant-1 direction executed
properly.

**D6 — No dark mode in v1.** The product is a light, dense analytical surface. Adding a
second theme doubles the visual QA surface for no stated requirement. Tokens are defined
so a dark palette can be added by redefining variables only.


**D7 — Development state is anchored on `globalThis`.** Next builds route handlers and
server components into separate module graphs, so a plain module-level array is instantiated
more than once and a write from a handler is invisible to the next page render. All
in-memory development state goes through `src/server/data/process-store.ts`. This exists only
because the development driver keeps state in memory; the Postgres driver deletes it.

**D8 — Client components never import from `src/server`.** Doing so drags the session
module — and with it `next/headers` — into the browser bundle and breaks the build. Shapes a
client component needs (for example the API key view) live in `src/lib/contracts`.

**D9 — Props crossing to a client component must be serialisable.** A server component
cannot hand a client component a function, so formatting choices are named values
(`"compact" | "integer" | "percent" | "exact"`) rather than closures.

**D10 — Cohorts below 8 creators publish no benchmark.** A percentile against two accounts
is noise wearing the costume of a statistic, and it would be the most quotable number on the
page. Scoring still normalises against a small cohort's median; only the published rank is
withheld.

**D12 — The influencer database is real, and there is no generator.**
The seeded creator generator is deleted. `src/server/data/` now holds record shapes and a
read view over `ingested-store.ts`, which contains what the connectors actually wrote.
Consequences that follow, and are intended:

- **Persistence.** Refilling the database costs API quota against a daily budget, so it is
  written to `.data/ingested.json` and survives a restart. Gitignored: it is a database, not
  source, and it is rebuildable.
- **Nothing has a fixed id.** Demo shortlists, campaigns and the creator-portal sign-in
  resolve their creators from whatever the database holds. E2E does the same through
  `creatorIds` in `e2e/test-helpers.ts`. A hard-coded id would dangle on the next harvest.
- **A fresh clone starts empty.** Every screen must render its empty state. That is a
  feature of the design, not a gap — the app is not allowed to depend on fixtures existing.
- **Whole regions of the UI are now empty for every creator.** No audience demographics, no
  bot-risk signal, no AI classification, no verified creators, and benchmarks only where a
  cohort reaches eight. That is what a public API can honestly support, and the product was
  built to show it rather than fill it.

**D13 — Absent is not zero, and the type system now says so.**
Ingesting a real channel with only an API key produces a creator with no bot-risk signal, no
comment-quality figure and no AI classification. Three shapes were coercing those absences
into confident numbers, so each was widened rather than defaulted: `RiskSignals.botRisk` /
`inactiveAudience` / `viewAnomaly` are nullable, `CampaignFit` excludes an unmeasurable
component instead of scoring it 0, and `RiskLevel` gained `unknown` — *not* a fourth
severity, but "no audience-quality signal was measurable". Rendering that as "low risk"
would have been a safety claim manufactured out of missing data.

**D16 — The AI layer is bounded by its schema, not by its prompt.**
`src/server/ai/` asks OpenAI for one object matching a Zod schema, in `strict` JSON-schema
mode, and re-validates the reply. The §7 prohibition — no follower counts, view counts,
engagement rates, demographics or bot percentages — is enforced by there being **no such
field to fill**. A prompt can be talked around; a schema cannot, and a test asserts no
field matching those names is ever added. Malformed, refused or truncated output is
rejected rather than stored: a half-parsed response written to the database is a fabricated
fact carrying a version stamp.

Consequences:
- **Comment quality is judged from real comments.** `commentThreads.list` costs 1 quota unit
  and needs no OAuth, so the model rates material actually read from the platform rather
  than producing a number from nothing.
- **Inferred categories are stored apart from observed ones.** `RawAiOutput.categories` is
  separate from `RawInfluencer.categories`; reads merge them observed-first. YouTube's
  channel topics put 458 of 627 creators in `lifestyle` and never emit beauty, finance or
  parenting at all, so without the inferred set those creators are undiscoverable.
- **Two health components stay unmeasurable, and should.** Authenticity needs a bot-risk
  signal the model is forbidden to produce; growth pattern needs snapshots over time.
  Enrichment takes coverage from 5/9 to 7/9, not to 9/9.
- **Enrichment never runs on a page render.** Each creator is a model call plus comment
  reads — roughly 2,900 tokens — so it is an explicit operator action, batched, skipping
  creators already classified.

**D15 — Discovery is the only expensive call, so it is the only one budgeted.**
`search.list` costs 100 quota units against 10,000/day; every other YouTube endpoint costs 1.
So the harvest uses search only to *find* channel ids, then reads everything about them
through the cheap endpoints — `channels.list` batches 50 ids into a single unit. A category
costs roughly 280 units and yields up to 40 creators. Progress is committed per category so
an interrupted sweep keeps the quota it already spent.

**D14 — YouTube topic categories are observed, not inferred.**
`topicDetails.topicCategories` is a classification YouTube itself publishes, so it sets a
creator's category with no AI label. Topics with no mapping are dropped rather than pushed
into the nearest category: a wrong category puts the creator in a wrong cohort and corrupts
the benchmark medians of everyone genuinely in it.

**D11 — Risk does not average.** A blended composite let one severe signal be washed out by
three clean ones — 85/100 bot risk read as "medium". A single disqualifying signal now sets
a floor the composite cannot pull below.

---

## 3. Stack

| Layer | Choice | Notes |
| --- | --- | --- |
| Framework | Next.js 16 App Router, React 19 | Server components by default |
| Language | TypeScript, `strict` | No `any` in `src/server` or `src/lib/contracts` |
| Styling | Tailwind CSS v4 (`@theme` tokens in `globals.css`) | No inline hex outside the token block |
| Validation | Zod | Every external input, every API boundary |
| Data fetching | Server components; TanStack Query for interactive lists | |
| Charts | Recharts + hand-rolled SVG for sparklines | Palette validated with the dataviz six-check validator |
| Icons | lucide-react | Stitch used Material Symbols; not carried over |
| Testing | Vitest (unit/service), Playwright (E2E) | |
| Persistence | *(deferred)* PostgreSQL + Drizzle | Repository interfaces already written against it |
| Queue | *(deferred)* Redis + BullMQ | |

---

## 4. Directory layout

```
src/
  app/
    (public)/            landing, pricing, login, register, reset
    (client)/            client workspace — discovery, profiles, shortlists, campaigns, reports
    (influencer)/        creator portal — connections, verification, own analytics
    (admin)/             platform ops — users, connectors, ingestion, AI jobs, API, audit
    api/
      v1/                external, API-key authenticated, versioned, documented
      internal/          session-authenticated, consumed by this app only
  components/
    ui/                  design-system primitives — no domain knowledge
    charts/              chart primitives
    <domain>/            feature components
  lib/
    contracts/           Zod schemas + inferred types — the shared language
    format.ts, class-names.ts   pure helpers
  server/
    auth/                sessions, password hashing, RBAC
    repositories/        data access interfaces + current driver
    services/            business logic — the only place it lives
    scoring/             formulas.ts — deterministic, versioned: health, risk, confidence, fit
    analytics/           deterministic metric calculation
    connectors/          youtube/ meta/ instagram/ — one folder per platform
    ai/                  provider abstraction, prompt/schema versions
    data/                driver: record shapes, read view, storage — never imported by components
```

Rules:

- Components never import from `src/server/data`. Ever.
- A file's name says what it *is*. When that stops being true, rename it — the layout guide
  is `docs/STRUCTURE.md`.
- Route handlers are thin: validate → call a service → serialise. No business logic.
- Business logic lives in `src/server/services`. Data access lives in
  `src/server/repositories`. Nothing skips a layer.
- Anything crossing a network or process boundary is described by a Zod schema in
  `src/lib/contracts`.

---

## 5. Roles & permissions

| Role | Scope |
| --- | --- |
| `super_admin` | Platform org. Everything: users, roles, connectors, AI config, scoring weights, API plans, audit, system config |
| `manager` | Platform org. Influencer CRUD, discovery, verification review, shortlists |
| `analytics_manager` | Platform org. Analytics, benchmarks, anomaly queue, score review. **No** user administration |
| `influencer` | Own profile, own OAuth connections, own authorized analytics, correction requests |
| `client_owner` | Client org. Everything within their org, plus billing and API keys |
| `client_member` | Client org. Search, profiles, compare, shortlists, campaigns. No billing, no API keys |

Enforcement lives in `src/server/auth/rbac.ts`. Every route handler calls it. UI hiding is
a convenience, never a control. A permission test must exist for every protected route.

---

## 6. Scoring

`src/server/scoring/` is a pure, deterministic, versioned formula engine. Given the same
inputs it must return the same output forever.

Health score weights (DPR §10.1) — authenticity .20, engagement quality .15, engagement
rate .15, growth pattern .15, view consistency .10, audience activity .10, comment quality
.05, upload consistency .05, brand safety .05.

Every computed score persists: value, `scoreVersion`, `formulaVersion`, every component
value, every input metric, and `computedAt`. A score with no stored components is a bug.

Confidence (DPR §10.2) is a **separate** axis: completeness + historical depth + source
authority + observation count − staleness − conflicts. Never fold it into quality.

Campaign performance scores are computed and stored separately from general intelligence
scores (Arch §11) — the same creator has both, and they must never be merged.

---

## 7. AI

`src/server/ai/` wraps providers behind one interface. OpenAI is primary; Gemini is used
for validation and search-grounded research.

AI **may**: classify category/niche/language, classify comment quality and brand safety,
extract structured facts from retrieved source material, summarise, explain scores in
plain language, assess campaign fit qualitatively.

AI **may not**: produce follower counts, engagement numbers, view counts, demographics,
bot percentages, historical metrics, or any number the platform did not observe.

Every AI output stores `provider`, `model`, `promptVersion`, `schemaVersion`,
`generatedAt`, and its evidence list (claim + source URL + confidence). Free-form
responses are never stored as canonical profile data — extraction uses structured schemas.

When OpenAI and Gemini conflict on a high-value fact, create a review task. Never silently
pick one (DPR UC-12).

---

## 8. Data provenance

Five source tiers, highest wins (DPR §7.1): official platform API → OAuth-authorized
account → licensed provider → permitted public-web research → AI inference.

Every fact surfaced in the UI carries its tier. The UI renders `verified`, `observed`,
`inferred` and `estimated` differently, and always shows freshness. This is a product
feature, not decoration — it is what separates SocialOrbit from a directory.

---

## 9. Frontend principles

Design language: **Modern Corporate Minimalism** — a high-density analytical surface that
should read like a financial terminal. Authoritative, quiet, precise.

- Depth comes from 1px borders and tonal layering, not shadows. Shadows only for
  overlays that genuinely float.
- Intelligence Blue is for intent — actions, active state, focus. Never large fills,
  never decoration.
- Colour on data means something: emerald = growth, amber = caution, rose = risk. A chart
  series that carries no meaning gets a neutral.
- Every numeric uses Geist Mono with tabular figures so columns align.
- Density is compact by default. 8px table row padding. Whitespace separates groups, not
  rows.
- No gradients, no glassmorphism, no decorative charts, no hero sections inside the app.
- Every screen implements loading, empty, error and partial-data states. A blank screen
  is a bug.
- Charts that lack sufficient history render an explicit "building history" state — this
  is formal data-confidence behaviour (DPR §10.2), not a placeholder message.

Accessibility is not optional: keyboard reachable, visible focus, semantic HTML, labelled
controls, contrast-checked, accessible dialogs and tables. Audit with the
`web-design-guidelines` skill.

Responsive: real information hierarchy per breakpoint, not shrunk desktop. Tables become
cards or gain horizontal scroll containers; filters become a sheet; sidebar collapses to a
rail then a drawer.

---

## 10. Security

- Server-side authorization on every protected route, keyed off session, never off input.
- Tenant isolation enforced in the repository layer, not remembered per query.
- OAuth tokens encrypted at rest; never sent to the browser.
- API keys stored hashed only; the raw key is shown exactly once at creation.
- Secrets come from environment variables. Nothing sensitive is ever logged.
- Validate every external input with Zod at the boundary.
- Rate limit authentication, search and the public API.
- Audit login, role changes, profile edits, verification decisions and API key lifecycle.

---

## 11. Testing

- Unit: scoring formulas, analytics calculations, formatters. These must be exhaustive —
  every higher feature depends on them.
- Service: business rules, especially the search quota and tenant isolation.
- API: contract shape, auth, permission matrix per role.
- E2E (Playwright): auth, discovery/search/filter/paginate, profile, compare, shortlist,
  campaign create → track → performance, and the RBAC matrix.

Run E2E continuously during development, not at the end.

---

## 12. Conventions

- Commits: `feat|fix|refactor|test|docs|chore(scope): summary`
- Never commit secrets, tokens, credentials or `.env`
- `.env.example` lists every variable by name with no real value
- New assumptions go in §2 of this file, not in a code comment

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
