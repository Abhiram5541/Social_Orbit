# SocialOrbit — implementation status

Last updated: 28 August 2026.

Scope note: the build was directed **frontend-first**, with PostgreSQL and live platform
credentials deferred to a later phase. Everything below is written against that decision
(CLAUDE.md D2). "Implemented" means the code path is real and exercised end to end; it does
not mean a production database is attached yet.

---

## Verification performed

| Check | Result |
| --- | --- |
| TypeScript, `strict`, whole project | clean |
| Unit tests (Vitest) | 66 passed |
| E2E (Playwright, desktop + mobile) | 140 passed, 10 skipped |
| Accessibility + control audit | 0 findings |
| Influencer database | 627 real YouTube channels, 30,759 indexed uploads |
| Live YouTube ingestion | 10 real channels read, scored and rendered end to end |
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
| Connectors — YouTube | **Live.** Real YouTube Data API v3 calls: channel resolution by id/@handle/URL, channel statistics, recent uploads with per-video statistics, YouTube's own topic categories. Zod-validated responses, quota- and credential-aware failures, an operator probe at `/admin/connectors` | OAuth round trip, so no `oauth_authorized` tier data (watch time, impressions, demographics) |
| Ingestion — YouTube | **Live.** `/admin/ingestion` ingests real channels into the influencer database. They are searchable, comparable, shortlistable and scored through the same engines as the seeded fixtures, carrying observed statistics only | A scheduler: ingestion is an explicit operator action, since each channel spends shared daily quota. Snapshots accumulate only as often as someone re-ingests, so trend lines need repeat passes |
| Connectors — Instagram, TikTok | Adapter boundary, per-platform requirements, honest status reporting, degradation | The HTTP calls themselves; blocked on credentials |
| AI enrichment | **Live.** OpenAI structured-output classification: category, creator type, commercial intent, brand safety and comment quality, the last judged from comments actually read from the platform. Every output stores provider, model, prompt and schema version, and its evidence. Operator control on `/admin/ai` | Gemini as the second opinion, and therefore the DPR UC-12 conflict queue, which has nothing to compare yet. No worker, so enrichment is a batched operator action |
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
| Unmeasured bot risk published as `0/100` — a clean bill of health for something never measured | `RiskSignals` figures are nullable; `RiskLevel` gained `unknown`; test asserts an unmeasurable creator is not "low" |
| Campaign fit scored an unmeasurable component as 0 instead of dropping it | Nullable fit inputs; `computeCampaignFit` already renormalised, so only the coercion had to go |
| Provenance mix claimed 14% AI-inferred for a creator no model had touched | Mix reads the profile's actual AI presence |
| A video with likes hidden and comments disabled published a confident 0.0% engagement rate | Absent interactions are excluded; the rate is null when none were observed |
| Hashtags de-duplicated before lowercasing, so `#Tag` and `#tag` both survived, and a `#` mid-word counted as a tag | Lowercase then de-duplicate, with a preceding-character boundary |
| `daysSinceLastPublication` went negative when a connector returned a video newer than `now` | Clamped at zero |
| Every creator avatar rendered broken — Google's CDN refuses hotlinked requests carrying a referrer, reported as `ERR_BLOCKED_BY_ORB` rather than a 403 | `referrerPolicy="no-referrer"` on the one `Avatar` primitive every surface uses; the audit went from 126 findings to 0 |
| `assemble()` scanned the whole content table per creator. Invisible at 84 creators and 4,400 rows; 19M operations per request at 627 and 30,759 | Rows grouped by owner once per revision — search API 500ms → 120ms |
| The seven development sign-ins, including a `super_admin`, were seeded in production with a password printed in the public README | Production requires `DEV_SEED_PASSWORD` to be set explicitly; without it no accounts exist at all |
| Content ids split on the last `_` to recover a video id — but YouTube video ids contain underscores (`v-_d2e7x4KA`), which 500'd every enrichment run | The known `accountId` prefix is stripped instead of a delimiter guessed at |
| A missing `OPENAI_API_KEY` surfaced as `upstream_error` "OpenAI unreachable", sending the reader after a network fault instead of an unset variable | Credential resolved before the try block; test asserts the reason |
| Two E2E tests asserted the seeded `inf_` id prefix on whatever a search returned, so an ingested creator in first place failed them | Both match any profile id; the heading assertion that follows was always the real check |
| `cohortCache` was computed once per process and never invalidated. Written against a frozen fixture set, it went stale the moment anything was ingested — so benchmarks stayed null and every creator in a band was normalised against an out-of-date median | Keyed on a revision counter the ingested store bumps on write |
| `devDataset()` merged the ingested overlay on *every* call. Reads call it once per influencer and a cohort pass once per influencer in the database, so it copied every content row tens of thousands of times per request — the search API went from 24ms to ~2s and timed out five discovery E2E tests | Merge memoised on the same revision counter; 22–49ms with 11 ingested creators |
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
