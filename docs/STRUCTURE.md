# Project structure

Where things live and, more usefully, **why a file would go there**. The rules in
[CLAUDE.md §4](../CLAUDE.md) are the contract; this page is the map.

The layering is the load-bearing part. Nothing skips a layer:

```
route handler / page   validate → call a service → serialise. No business logic.
    ↓
services/              business logic. The only place it lives.
    ↓
repositories/          data access. The only place that touches the driver.
    ↓
data/                  the driver — record shapes and storage
```

Two engines sit beside that path and are called by repositories, never by routes:
`analytics/` computes metrics, `scoring/` computes scores. Both are pure and versioned.

---

## `src/app` — routes

Next App Router. **`page.tsx`, `layout.tsx` and `route.ts` are names Next requires**; the
folder is what identifies them, so read the path, not the filename.

| Path | What lives here |
| --- | --- |
| `(public)/` | Landing, pricing, login, register, reset, legal. No session required |
| `(client)/` | The client workspace — discovery, campaigns, shortlists, reports, billing |
| `(creator)/` | The creator portal — own profile, connections, verification, own analytics |
| `(admin)/` | Platform operations — connectors, ingestion, queues, users, audit |
| `(shared)/` | Routes several roles reach: influencer profiles, compare, notifications, help |
| `api/internal/` | Session-authenticated. Consumed by this app only |
| `api/v1/` | External, API-key authenticated, versioned, documented |

The parenthesised folders are route *groups*: they set which shell wraps the page without
appearing in the URL. `(client)/dashboard` serves `/dashboard`.

A form or panel that only one route uses sits next to that route (`login/login-form.tsx`).
Anything reused moves to `src/components`.

## `src/components` — UI

| Folder | Rule |
| --- | --- |
| `ui/` | Design-system primitives. **No domain knowledge** — a `Button` must not know what an influencer is |
| `charts/` | Chart primitives |
| `intelligence/` | The pieces that make provenance and scoring visible: score bars, stat tiles, provenance marks |
| `shell/` | App chrome — sidebar, topbar, command palette, page shells |
| `<domain>/` | Feature components: `discovery/`, `profile/`, `campaign/`, `shortlist/`, `admin/`, `api/` |

Client components (`"use client"`) **never import from `src/server`** — it drags
`next/headers` into the browser bundle and breaks the build (CLAUDE.md D8). Shapes they need
live in `src/lib/contracts`.

## `src/lib` — shared, framework-free

| File | Purpose |
| --- | --- |
| `contracts/` | Zod schemas and their inferred types — the shared language between UI, API and database. Anything crossing a network or process boundary is described here |
| `format.ts` | Number, date and duration formatting |
| `class-names.ts` | `cn()` — merges Tailwind classes |
| `navigation.ts` | Route tables and per-role navigation |

`contracts/common.ts` holds provenance, confidence, platforms and taxonomy — the vocabulary
every other contract builds on.

## `src/server` — everything that never reaches the browser

| Folder | Purpose |
| --- | --- |
| `auth/` | Sessions, password hashing, RBAC, API-key auth. `rbac.ts` is called by every protected route |
| `repositories/` | Data access, one file per aggregate. The only modules that touch `data/` |
| `services/` | Business logic — search and quota, ingestion, harvesting, rate limiting |
| `scoring/` | `formulas.ts` — health, risk, confidence and campaign fit. Pure, deterministic, versioned |
| `analytics/` | `metrics.ts` — medians, engagement, consistency, anomalies. Pure, deterministic |
| `connectors/` | One folder per platform. Real API shapes; returns `ConnectorUnavailable` without credentials |
| `data/` | The driver: record shapes, the read view, and storage |
| `ai/` | Provider abstraction *(no credential yet — the folder is the seam)* |

### `src/server/data` in detail

There is no fixture generator. The influencer database is built by ingesting **real
channels** through the connectors.

| File | Purpose |
| --- | --- |
| `records.ts` | Raw record shapes (`RawInfluencer`, `RawAccount`, `RawContent`, `RawSnapshot`) and `readRecords()`, the read view repositories consume |
| `ingested-store.ts` | The store — real connector output, persisted to `.data/ingested.json` |
| `process-store.ts` | Process-wide anchor for in-memory state (CLAUDE.md D7) |

See [`src/server/data/README.md`](../src/server/data/README.md) for how to fill the
database and what a harvested creator does and does not carry.

## `e2e` — Playwright

| File | Purpose |
| --- | --- |
| `test-helpers.ts` | Sign-in helpers, seed accounts, and `creatorIds()` — creator ids are resolved live because the database is harvested, not fixtured |
| `auth · rbac · discovery · profile · workflows · layout · responsive · operator-search` | One spec per area |
| `audit/route-inventory.ts` | Every route paired with the role allowed to see it. A route missing here is a route nobody checks |
| `audit/audit.spec.ts` | Accessibility sweep across that inventory |
| `audit/controls.spec.ts` | Clicks every interactive control on every screen |

Unit and service tests live beside their subject as `*.test.ts` and run under Vitest.

## Root

| Path | Purpose |
| --- | --- |
| `.vscode/` | Editor settings, recommended extensions, debug configs, tasks |
| `.data/` | The ingested database. Gitignored — rebuildable from the connectors, and large |
| `docs/` | The DPR and architecture documents, `ROADMAP.md`, `STATUS.md`, this file |
| `CLAUDE.md` | Orientation, decisions and their reasons. Read before changing anything |

---

## Naming

- Repositories: `<aggregate>-repository.ts`
- Services: `<capability>-service.ts`
- Components: `<thing>.tsx`, kebab-case, named for what it renders
- Tests: `<subject>.test.ts` beside the subject; `<area>.spec.ts` in `e2e/`
- Contracts: `<domain>.ts`, exporting a Zod schema and its inferred type under the same name

A file's name should say what it *is*. If it stops being true — as `dev-dataset.ts` did once
the fixtures were deleted — rename it rather than leaving the name to mislead.
