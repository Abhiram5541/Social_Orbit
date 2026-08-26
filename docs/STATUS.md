# SocialOrbit — implementation status

Last updated: 26 August 2026.

Scope note: the build was directed **frontend-first**, with PostgreSQL and live platform
credentials deferred to a later phase. Everything below is written against that decision
(CLAUDE.md D2). "Implemented" means the code path is real and exercised end to end; it does
not mean a production database is attached yet.

---

## Verification performed

| Check | Result |
| --- | --- |
| TypeScript, `strict`, whole project | clean |
| Unit tests (Vitest) | 37 passed |
| E2E (Playwright, desktop + mobile) | 102 passed, 4 skipped |
| Route sweep, all six seed roles | every route 200 or a deliberate redirect |
| RBAC probes against the API directly | every expected 401/403 held |
| Tenant isolation probe | a second tenant sees an empty list, not another org's data |
| Public v1 API | key issuance → query → revocation → 401 |
| Horizontal overflow, 390 / 768 / 1024 / 1440 | no page-level scroll |
| Chart palette, six-check validator | all pass (worst CVD ΔE 13.6, normal ΔE 28.8) |

The 4 skips are deliberate: keyboard-shortcut tests and the table-sort test do not apply at
phone width, and the shortlist dialog flow is asserted on desktop while its phone layout is
covered by the responsive suite.

---

## IMPLEMENTED

**Foundation**
- Next.js 16 App Router, React 19, TypeScript strict, Tailwind v4 with a tokenised theme
- Design system: buttons, cards, badges, forms, tables, tabs, dialogs (native `<dialog>`),
  menus (native popover), tooltips, skeletons, empty/error/notice states
- Three workspace shells (client, admin, creator) plus a shared group, responsive from
  240px sidebar → 64px rail → drawer
- Command palette with real search, debounced and abort-safe

**Intelligence core** — the part that matters most, and the part that is fully real
- Deterministic analytics engine: median/mean/σ, engagement rate with per-platform
  denominators, upload frequency and consistency, view consistency, anomaly detection,
  growth-pattern scoring, dormancy, windowed gains
- Deterministic scoring engine: nine weighted health components at the DPR §10.1 weights,
  renormalising when a component is unmeasurable, storing every component and its inputs
  with a formula version
- Risk scoring with a dominant-signal floor (a severe signal cannot be averaged away)
- Confidence as a genuinely separate axis, with its own components and bands
- Campaign fit as a ranking model, with unavailable inputs excluded rather than guessed
- Cohort benchmarks with a minimum cohort size before any percentile is published

**Provenance** — the product's differentiator
- Five source tiers and five fact kinds, rendered distinctly everywhere
- Freshness and staleness on every surfaced figure
- Provenance mix readout on profiles
- "Building history" as formal behaviour when snapshots are insufficient
- AI output isolated on its own tonal ground, labelled, with provider/model/prompt version

**Workflows**
- Auth: sign-in, registration request, password reset request, sessions (signed, httpOnly),
  timing-equalised credential checks, rate limiting, uniform failure messages
- RBAC: six roles, permission-based (not role-based) route guards, enforced server-side
- Multi-tenancy: `assertTenantAccess` in the repository layer
- Discovery: URL-as-state search, 12 filter groups, facet counts, sorting, pagination,
  active-filter chips, desktop table / mobile card list
- Free-plan allowance: 5 searches/month, server-side, charged only on a *narrowing* search
  and never on paging or re-sorting, with upgrade messaging
- Influencer profile: header, health panel, six tabs, benchmarks, content, audience gating
- Comparison: up to five creators, best-in-row marking, incomparable metrics flagged
- Shortlists: create, add, note, remove, compare-from-list, campaign hand-off
- Campaigns: create with a required unique tracking hashtag, participants, rate gaps,
  hashtag-attributed performance scored separately from health
- Creator portal: overview, profile, connections, verification, own analytics, corrections
- Admin: overview, database stats, connector health, AI provider status, four review queues,
  ingestion, analytics, benchmarks, users, orgs, API management, audit, system health
- Public v1 API: hashed keys, scopes, rotation, revocation, per-plan quota, burst limit,
  field-level access control, versioned responses, documented reference

---

## PARTIALLY IMPLEMENTED

| Area | What exists | What is missing |
| --- | --- | --- |
| Persistence | Repository interfaces, a process-wide dev store, mutations that behave correctly | PostgreSQL driver, migrations, indexes |
| Connectors | Adapter boundary, per-platform requirements, honest status reporting, degradation | The HTTP calls themselves; blocked on credentials |
| AI enrichment | Provider abstraction shape, structured output contract, evidence, versioning | Live OpenAI/Gemini calls; blocked on credentials |
| Reports | Report types, provenance guarantees, generation UI | Async generation, PDF/CSV rendering, storage |
| Verification | Full status model, creator-facing flow, admin review queue | The OAuth round trip itself |
| Notifications | Alert model, real detections from tracked creators, both inboxes | Delivery (email/webhook), read state |
| Billing | Plan model, usage metering, plan comparison | Payment provider, self-serve plan changes |

---

## MISSING (deliberately, per CLAUDE.md D4)

- Consumer Intelligence — neither source document defines a data source for it
- TikTok connector — DPR §29 roadmap
- AI rate negotiation — Architecture §9; SocialOrbit does not hold creator rates
- Background workers and queues — the job boundary exists; BullMQ does not
- Semantic/embedding search — DPR §24 says add it only when scale demands
- CRM, contracts, payments, white-label — DPR §29

---

## BROKEN

Nothing known. Every defect found during the build was fixed and is covered by a test:

| Defect found | Fix |
| --- | --- |
| Risk formula averaged away a severe bot-risk signal | Dominant-signal floor; test asserts 85/100 bot risk reads high |
| Benchmarks ranked a creator against a cohort of two | Minimum cohort size of 8 before publishing a percentile |
| Required-field asterisk leaked into the accessible name | Marker moved outside `<label>`, `aria-required` added |
| Two `<h1>` elements on the profile page | `PageHeader` yields the heading level |
| Mobile filter sheet duplicated every form control | Panel mounts only while open |
| Page-header actions forced 441px on a 390px screen | Removed `shrink-0`, allowed wrap |
| Dev state invisible across route-handler/RSC bundles | Process-wide store keyed on `globalThis` |
| Chart palette failed CVD separation | Re-stepped and re-validated |
| Client component pulled `next/headers` into the browser bundle | API key shape moved to contracts |
| Server passed a function prop to a client chart | Format is named data, not a closure |

---

## NEEDS REDESIGN

Nothing from the Stitch prototype was carried forward, so there is no inherited debt. Two
things are worth revisiting when real data arrives:

1. **Estimated monthly earnings.** Currently a simple range from median views × cadence.
   It is labelled an estimate everywhere, but the model is thin. Either ground it in real
   category CPM data or drop it — a weak number with a strong label is still quotable.
2. **The `derived` provenance kind.** It is currently applied per-metric by the repository.
   Once facts are stored individually with their own provenance rows, this should be read
   from the record rather than assigned at read time.
