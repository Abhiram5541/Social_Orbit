# SocialOrbit — implementation roadmap

Milestones map to DPR §27, reordered for the frontend-first sequence agreed in
CLAUDE.md D2. Dependencies are stated because several later milestones are blocked on
credentials rather than on effort.

Status: ✅ done · 🟡 partial · ⬜ not started

---

## Phase 1 — Foundation and the intelligence core *(complete)*

| # | Milestone | Status | Notes |
| --- | --- | --- | --- |
| M01 | Repository, toolchain, CI-ready scripts | ✅ | Next 16, TS strict, Vitest, Playwright |
| M02 | Design system and three workspace shells | ✅ | Tokenised, responsive, validated palette |
| M03 | Authentication | ✅ | Sessions, scrypt, rate limiting, timing equalisation |
| M04 | RBAC and tenant isolation | ✅ | Permission-based; enforced in the repository layer |
| M09 | Normalisation and historical snapshots | ✅ | Append-only; drives the building-history state |
| M10 | Analytics engine | ✅ | Pure, deterministic, unit-tested |
| M11 | Deterministic scoring | ✅ | Versioned, component-storing, reproducible |
| M13 | Search and discovery | ✅ | URL-as-state, facets, server-enforced quota |
| M14 | Influencer profile | ✅ | Six tabs, provenance throughout |
| M15 | Comparison | ✅ | Flags incomparable metrics rather than averaging them |
| M16 | Shortlists | ✅ | Create, annotate, compare, hand off to a campaign |
| M17 | Campaign management | ✅ | Required unique hashtag; separate campaign scoring |
| M19 | API portal and v1 API | ✅ | Hashed keys, scopes, rotation, quotas, docs |
| M20 | Admin workspace | ✅ | Stats, connectors, four review queues, audit |
| M23 | Automated testing | ✅ | 37 unit, 102 E2E |
| M24 | Playwright E2E validation | ✅ | Desktop and mobile projects |

---

## Phase 2 — Persistence *(next; unblocks everything else)*

| # | Milestone | Status | Depends on |
| --- | --- | --- | --- |
| M05 | PostgreSQL schema and migrations | ⬜ | A database URL |
| M05a | Drizzle models for the entities in DPR §16 | ⬜ | M05 |
| M05b | Swap the repository driver; delete `src/server/data` | ⬜ | M05a |
| M05c | Indexes per DPR §23 — platform id, username, country, language, category, follower bands, score, verification | ⬜ | M05a |
| M05d | Provenance rows: `profile_facts` with source, collected_at, confidence, model version | ⬜ | M05a |

**Why this is next:** every repository already returns the exact shapes the UI consumes, so
this milestone changes one layer and nothing above it. Doing it before the connectors means
ingested data has somewhere to land.

---

## Phase 3 — Live data *(blocked on credentials)*

| # | Milestone | Status | Depends on |
| --- | --- | --- | --- |
| M06 | YouTube connector — channel resolution, statistics, videos | ⬜ | `YOUTUBE_API_KEY`, OAuth client |
| M07 | OAuth flows and encrypted token storage | ⬜ | `TOKEN_ENCRYPTION_KEY`, Meta app review |
| M07a | Meta/Instagram professional-account insights | ⬜ | M07, approved permissions |
| M08 | Scheduled ingestion, retries, dead-letter queue | ⬜ | Redis, M06 |
| M08a | Redis + BullMQ workers | ⬜ | A Redis URL |
| M10a | Verification: identity matching and badge issuance | ⬜ | M07 |
| M12 | AI enrichment against live providers | ⬜ | `OPENAI_API_KEY`, `GEMINI_API_KEY` |
| M12a | Two-provider cross-check and the conflict queue | ⬜ | M12 |

The connector status page already reports exactly which variables are missing per platform,
so this phase's entry condition is visible in the product.

---

## Phase 4 — Completion and hardening

| # | Milestone | Status | Notes |
| --- | --- | --- | --- |
| M18 | Reports — async generation, PDF/CSV, object storage | 🟡 | Types and provenance rules defined |
| M15a | Benchmarks from live cohorts | 🟡 | Engine done; needs population |
| M21 | Security hardening — CSP, security headers, audit writes, secret rotation | 🟡 | Auth, RBAC, hashing, limits done |
| M22 | Performance — query plans, caching, virtualised tables past ~500 rows | ⬜ | Pagination already in place |
| M25 | Production readiness — Docker, CI, backups, monitoring, runbook | ⬜ | |

---

## Deferred by decision

| Item | Reason |
| --- | --- |
| Consumer Intelligence | Neither document defines a data source; building it would mean inventing one |
| TikTok connector | DPR §29 roadmap; the adapter slot exists |
| AI rate negotiation | SocialOrbit does not hold creator rates and must not infer them |
| Semantic search | DPR §24: add only when scale or ranking demands it |
| CRM, contracts, payments, white-label | DPR §29 |

---

## The one-line version

The intelligence layer — the part that is hard to get right and easy to get subtly wrong —
is built, tested and honest about what it does not know. What remains is plumbing it to a
real database and real credentials, which the architecture was shaped to make a
single-layer change.
