# Data driver

**Nothing outside `src/server/repositories` may import from this directory.**

## What this is

The storage layer for the development driver, and the record shapes every driver shares.

There is no generator here any more, and no fixtures. The influencer database is built by
ingesting **real channels** through [`src/server/connectors`](../connectors/); this
directory holds what those connectors wrote and hands it to the repository layer.

| File | Role |
| --- | --- |
| `records.ts` | Raw record shapes, plus the read view the repositories consume |
| `ingested-store.ts` | The store itself — real connector output, persisted to `.data/ingested.json` |
| `process-store.ts` | Process-wide anchor for in-memory state (CLAUDE.md D7) |

## What this is deliberately **not**

It contains no analytic, score, band, risk level, confidence figure or percentile. Those
are all computed at read time by [`src/server/analytics`](../analytics/) and
[`src/server/scoring`](../scoring/).

This matters. If the stored rows carried pre-baked scores, the scoring engine would never be
exercised against real input and the UI would render numbers no formula ever produced.
Instead the pipeline runs end to end on every request:

```
raw observations  →  analytics  →  scoring  →  confidence  →  API  →  UI
  (connectors)       (real)       (real)       (real)       (real)  (real)
```

Swapping in PostgreSQL replaces only the leftmost box.

## Filling the database

`.data/` is gitignored: it is a database, not source, and it is rebuildable from the
connectors. A fresh clone starts empty, and every screen renders its empty state rather
than breaking.

To fill it, sign in as a platform operator and either use **Ingestion** in the admin
workspace, or:

```bash
curl -X POST localhost:3000/api/internal/connectors/youtube/harvest \
  -H 'Content-Type: application/json' \
  -d '{"categories":["technology"],"target":40,"videos":50}'
```

Run it a category at a time. `search.list` costs 100 quota units against a 10,000/day
budget while every other endpoint costs 1, so discovery is the only expensive part — a
category costs roughly 280 units and yields up to 40 creators.

## What a harvested creator does and does not carry

Everything an API key can observe: subscriber count, total views, video count, per-video
views/likes/comments/duration, the country and topic categories YouTube itself publishes,
and the language the creator declared.

Nothing it cannot. No audience demographics, no watch time, no bot-risk signal, no comment
quality, no brand-safety classification — those need OAuth or an AI provider. The `signals`,
`audience` and `ai` maps in the read view are the slots they will fill. Until then the
scoring engine renormalises around the missing components and the confidence score falls,
which is the correct visible outcome rather than a gap papered over.

## Determinism

Reads take `now` as a parameter and default to `EPOCH`, so a score computed from the same
stored rows is reproducible rather than dependent on when it ran. The rows themselves change
only when a connector writes new observations.
