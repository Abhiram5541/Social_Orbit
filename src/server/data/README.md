# Development dataset

**Nothing in this directory is production data, and nothing outside `src/server/repositories`
may import from it.**

## What this is

A deterministic generator for *raw platform-shaped observations* — the kind of records a
connector would write after calling the YouTube Data API or the Instagram Graph API:
account rows, weekly snapshots, and content items with view/like/comment counts.

## What this is deliberately **not**

It does not contain a single analytic, score, band, risk level, confidence figure or
percentile. Those are all computed at read time by
[`src/server/analytics`](../analytics/) and [`src/server/scoring`](../scoring/) — the same
production code that will run over real connector output.

This matters. If the fixtures carried pre-baked scores, the scoring engine would be
untested against realistic input and the UI would be rendering numbers no formula ever
produced. Instead, the pipeline is exercised end to end on every request:

```
raw observations  →  analytics  →  scoring  →  confidence  →  API  →  UI
     (fixture)        (real)       (real)       (real)      (real) (real)
```

Swapping in PostgreSQL replaces only the leftmost box.

## Determinism

Generation is seeded (`mulberry32`) and derives every timestamp from a fixed epoch, so the
same profile renders identically across processes and across test runs. E2E assertions can
therefore reference concrete values without becoming flaky.

## Removal

The repository layer selects its driver from `SOCIALORBIT_DATA_DRIVER`. When the Postgres
driver lands, set it to `postgres`, delete this directory, and no component, route handler
or service changes.
