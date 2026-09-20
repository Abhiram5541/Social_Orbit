# SENSO — Data coverage statement

For client agreements. States what the platform measures today, what it infers, what
it does not hold, and how each is labelled. Figures are from the production database
on 20 September 2026 and move daily; the queries to refresh them are at the end.

## 1. What the index holds

| | Figure |
| --- | --- |
| Creators indexed | 8,678 |
| YouTube channels | 7,472 |
| Instagram business / creator accounts | 1,206 |
| Content items read (uploads, posts) | 425,074 |
| Daily snapshots | 33,217 across 30 distinct days, since 3 June 2026 |
| Creators with a country on record | 6,227 (84 countries; 2,812 in India) |
| Creators with a platform-observed category | 7,363 |
| Creators with an AI classification | 551 (see §3) |

The index is built only from official platform APIs (YouTube Data API v3, Instagram
Graph API — Business Discovery). No scraping, no purchased lists. It grows by roughly
600 creators a day through scheduled discovery and is re-read daily for snapshots.

## 2. What is measured, and how it is labelled

Every figure in the product carries one of five labels. They are enforced in the
data model, not added in the interface.

| Label | Meaning | Present today |
| --- | --- | --- |
| **Verified** | Confirmed through the creator's own authorised platform connection (OAuth) | **No creator is verified.** The connection flow exists; no creator has connected. |
| **Observed** | Read directly from an official platform API | Followers / subscribers, media counts, upload titles, views, likes, comments, publish dates, YouTube's own topic categories, country (YouTube only) |
| **Derived** | Computed from observed values by a published, versioned formula | Engagement rate, upload cadence and consistency, view consistency, growth pattern, dormancy, SENSO Health (nine weighted components), data confidence, campaign performance |
| **Estimated** | A model estimate, shown as a range | Monthly earnings range (from median views × cadence). Labelled an estimate everywhere. |
| **AI inferred** | Classified by a language model from source material, with the evidence stored | Creator type, content themes, commercial intent, brand-safety and comment-quality ratings, inferred categories where the platform publishes none |

SENSO Health and every other score is computed by a deterministic formula, never by
a model. A model explains scores; it cannot change them. Every score stores its
components, inputs and formula version, so a figure quoted in a report can be
recomputed later.

## 3. What is inferred, and its limits

AI classification has run on 551 of 8,678 creators. It is run in batches by an
operator and costs roughly 2,900 model tokens and three comment reads per creator;
coverage extends on request or on a schedule. Where it has not run, the profile says
"no model has classified this creator" — it does not fill the gap.

A model is never permitted to produce follower counts, engagement figures, view
counts, demographics, bot percentages or historical metrics. This is enforced by the
output schema: there is no field for them.

## 4. What is not held

- **Audience demographics** (age, gender, location of the audience): not available
  from any public API. Held only for creators who authorise access — currently none.
- **Audience-quality signals** (bot share, inactive audience): not measurable from
  public data. Risk is shown as *not assessed*, never as *low*, until a creator
  connects.
- **Instagram history**: Business Discovery returns current figures only. Instagram
  creators accumulate history from the day they are indexed; no views, country or
  language are available for them.
- **Percentile benchmarks** are published only where a peer cohort (category ×
  audience band) holds at least eight creators; otherwise the rank is withheld.
- **Growth trends** are drawn only once a creator has enough daily snapshots
  (4,161 accounts have three or more); until then the profile shows "history
  building" with the count.
- **Creator rates, contracts, payments, CRM**: out of scope.

## 5. Demonstration records

Four creators (`Northlight Studio`, `Saffron & Salt`, `Atlas Grain`, `Vera Bloom`)
are fictional. They exist to exercise the parts of the interface that public data
cannot fill, are badged **Demo record** wherever they appear, are excluded from every
benchmark, and can be removed from the index in one operation. They are not real
people or accounts.

## 6. Refresh and retention

- Every indexed account is re-read once a day; a creator's figures state their
  collection time.
- Snapshots are appended, never overwritten; nothing observed is deleted.
- The database is backed up nightly with 30-day retention.
- YouTube API data is displayed under the YouTube API Services Terms; data is
  refreshed daily and not resold.

## Refreshing the figures

```sql
select count(*) from influencers;
select data->>'platform', count(*) from accounts group by 1;
select count(*) from content;
select count(*), count(distinct data->>'date'), min(data->>'date') from snapshots;
select count(*) from influencers where coalesce(data->>'countryCode','') <> '';
select count(*) from influencers where jsonb_array_length(coalesce(data->'categories','[]')) > 0;
select count(*) from ai_outputs;
select count(*) from oauth_grants;                      -- verified creators
select count(*) from (select data->>'accountId', count(*) from snapshots group by 1 having count(*) >= 3) t;
```
