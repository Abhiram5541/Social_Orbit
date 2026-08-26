# SocialOrbit

Influencer intelligence, verification, analytics and API platform.

SocialOrbit maintains a proprietary influencer database and turns it into decision support:
*"should I work with this creator?"* and *"how did this creator perform for my campaign?"*

What separates it from a directory is that **every number says where it came from**. A
follower count read from the YouTube Data API and a category a model inferred from a bio are
different kinds of claim, and the product never renders them the same way.

---

## Quick start

```bash
npm install
cp .env.example .env.local        # then fill in AUTH_SECRET at minimum
npm run dev                       # http://localhost:3000
```

No database or Redis is needed to run the app today — see
[Data driver](#data-driver) below.

Generate the secrets the app needs:

```bash
openssl rand -base64 48    # AUTH_SECRET
openssl rand -base64 32    # TOKEN_ENCRYPTION_KEY
openssl rand -base64 32    # API_KEY_PEPPER
```

### Development sign-ins

All seed accounts share `DEV_SEED_PASSWORD` (default `SocialOrbit-Dev-2026`). The sign-in
page lists them outside production.

| Email | Role | What it shows |
| --- | --- | --- |
| `admin@socialorbit.io` | Super Admin | Full platform operations |
| `manager@socialorbit.io` | Manager | Influencer CRUD, verification review |
| `analyst@socialorbit.io` | Analytics Manager | Analytics and queues, no user administration |
| `owner@northwind.example` | Client Owner | Growth plan, API keys, billing |
| `member@northwind.example` | Client Member | Same workspace, no billing or keys |
| `hello@lumen.example` | Client Owner | **Free plan — exercises the 5-search limit** |
| `creator@socialorbit.io` | Influencer | Creator portal and own analytics |

---

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run typecheck` | TypeScript, strict, whole project |
| `npm run lint` | ESLint |
| `npm test` | Unit and service tests (Vitest) |
| `npm run e2e` | End-to-end tests (Playwright, desktop + mobile) |

`npm run e2e` reuses a running dev server if there is one, and starts its own otherwise.

---

## Architecture

```
src/
  app/
    (public)/      landing, pricing, sign-in, registration, password reset
    (client)/      discovery, profiles, compare, shortlists, campaigns, reports, API, usage
    (admin)/       platform operations — connectors, ingestion, queues, users, audit
    (creator)/     creator portal — connections, verification, own analytics
    (shared)/      routes every signed-in role reaches
    api/v1/        external, API-key authenticated, versioned
    api/internal/  session authenticated, consumed by this app only
  components/      ui/ primitives · charts/ · intelligence/ · feature folders
  lib/contracts/   Zod schemas — the shared language between UI, API and database
  server/
    auth/          sessions, password hashing, RBAC, API-key authentication
    repositories/  data access — the only layer that touches a driver
    services/      business logic
    scoring/       deterministic, versioned formula engine
    analytics/     deterministic metric calculation
    data/          DEVELOPMENT DATASET ONLY — see its README
```

Rules that hold throughout:

- Route handlers validate, call a service, and serialise. No business logic.
- Business logic lives in services; data access lives in repositories; nothing skips a layer.
- Anything crossing a process boundary has a Zod schema in `lib/contracts`.
- Client components never import from `src/server`.

### Data driver

`SOCIALORBIT_DATA_DRIVER` selects where repositories read from. Today it resolves against a
deterministic in-repo dataset that emits **raw platform-shaped observations only** — account
rows, weekly snapshots, content items. Every analytic, score, band, risk level and
confidence figure is computed at read time by the production engines:

```
raw observations → analytics → scoring → confidence → API → UI
    (fixture)       (real)      (real)     (real)     (real) (real)
```

Switching to PostgreSQL replaces the leftmost box. See
[`src/server/data/README.md`](src/server/data/README.md).

---

## The rules the product is built on

These are not style preferences. They come from the source documents and the code enforces
them.

**Scores are computed in backend code, never by a model.** Nine weighted components,
published weights, stored inputs, a formula version on every result. Given the same inputs,
the same score — today and in three years. A model can classify a comment or explain a
result in plain language; it cannot move the number.

**Confidence is a separate axis from quality.** A creator can score 91 on health with 40%
confidence. The product shows both, separately, because folding them together hides exactly
the case where a buyer should be most careful.

**AI never invents a measurement.** It may classify, extract, summarise and explain. It may
not produce followers, engagement, views, demographics or bot percentages. Every AI output
stores its provider, model, prompt version, schema version and evidence.

**Unmeasured is not zero.** A metric the platform has not exposed renders as an em dash, is
excluded from filters with a minimum threshold, and causes its score component to be dropped
with the remaining weights renormalised.

**Verified means verified.** The badge is issued only after OAuth consent and a successful
identity match — never from public data collection.

**Authorization is server-side.** Every protected route asks for a permission. Hiding a
button is a courtesy; the check in `src/server/auth/rbac.ts` is the control.

---

## Testing

```bash
npm test          # 37 unit tests — scoring, analytics, quota, formatters
npm run e2e       # 102 E2E tests — auth, RBAC, discovery, profile, workflows, responsive
```

The E2E suite asserts security properties against the API directly rather than through the
UI: an unauthenticated request, a creator reaching for client data, one tenant reading
another's shortlists, and a session cookie attempting to authenticate the public API all
have explicit tests.

---

## Environment

`.env.example` lists every variable. The app runs with only `AUTH_SECRET` set; everything
else degrades honestly — the connector page reports exactly which variables each platform is
missing, and unconfigured AI providers leave classification fields empty rather than guessed.

Never commit `.env.local`. The app refuses to start in production without `AUTH_SECRET`.

---

## Documentation

| Document | Contents |
| --- | --- |
| [CLAUDE.md](CLAUDE.md) | Project instructions, decisions, deviations, assumptions |
| [docs/STATUS.md](docs/STATUS.md) | What is implemented, partial, missing, and why |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Milestones, dependencies, what unblocks what |
| `docs/*.docx` | The source Architecture and DPR documents |
