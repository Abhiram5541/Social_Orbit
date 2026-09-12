# SocialOrbit — Cost and Budget Report

**Prepared for** Management review
**Date** 7 September 2026 · **Version** 2.0
**Exchange rate used throughout** ₹88 = $1. Every figure is shown in both currencies.

---

## 1. What this report answers

SocialOrbit builds and maintains a database of social media influencers, and sells
intelligence about them — how good a creator is, how safe they are for a brand,
and how they performed on a campaign.

To do that, we buy data from social media platforms and pay AI providers to
classify it. This report answers six questions:

1. What do we pay each platform, and why do we need them?
2. What does one influencer cost us?
3. What does it cost to build a database of 1 lakh, 10 lakh, and 65 lakh influencers?
4. What do the servers cost?
5. What security do we need in place?
6. What is the total project budget?

**Every number in this report is either measured from our own working system, or
taken from the vendor's published price list in September 2026.** Where a figure
is an estimate, it says so. Three items — LinkedIn access, licensed Instagram
data, and X Enterprise — have no public price and must be quoted before the
budget is signed off.

---

## 2. The bottom line

| | **1 lakh influencers** | **10 lakh influencers** | **65 lakh influencers** |
| --- | --- | --- | --- |
| **Year 1 total cost** | **$20,000 – $28,000**<br>**₹18 – 25 lakh** | **$57,000 – $68,000**<br>**₹50 – 60 lakh** | **$205,000 – $352,000**<br>**₹1.8 – 3.1 crore** |
| Cost per influencer per year | $0.105 · ₹9.24 | $0.040 · ₹3.54 | **$0.026 · ₹2.30** |
| Time to build the database | ~45 days | ~11 months | 6 months\* |

\* *Six months only if Google approves our request for higher data limits. Without
that approval, 65 lakh takes 5.4 years. See §7.*

### Three things management should take away

**1. The AI is not the expensive part.**
Everyone assumes AI is the big cost. It is not. Classifying all 65 lakh
influencers with AI costs **$29,900 (₹26.3 lakh)**. Running the servers that hold
them costs **$72,000 (₹63.4 lakh)** in the same year. Our real cost is storage,
search and data access rights — not AI.

**2. Bigger is cheaper per influencer.**
At 1 lakh influencers we spend ₹9.24 per influencer per year. At 65 lakh we spend
₹2.30 — a 4× improvement. The fixed cost of running the platform is the same
either way, so a small database is expensive per record. This is the commercial
argument for scale.

**3. One approval decides whether 65 lakh is possible at all.**
YouTube gives every company a free daily data allowance. Ours is enough for about
3,300 new influencers a day. At that rate, 65 lakh takes **5.4 years**. Google
grants larger allowances free of charge, but only after reviewing our compliance.
**This application must be filed on day one of the project.** It cannot be bought,
and it can be refused.

---

## 3. Cost per influencer

This is the number that scales. Everything in §5 is this figure multiplied.

| What we pay for | Cost per influencer | |
| --- | --- | --- |
| YouTube data (profile, videos, comments) | **$0.00** | **₹0.00** |
| AI classification (OpenAI + Google Gemini) | **$0.0046** | **₹0.40** |
| X / Twitter data | **$0.00625** | **₹0.55** |
| Instagram, Facebook, Snapchat (creator-consented) | **$0.00** | **₹0.00** |
| **Total data cost per influencer** | **$0.011** | **₹0.95** |
| Server and operations cost, spread across 65 lakh records | $0.013 | ₹1.14 |
| Security and compliance, spread the same way | $0.002 | ₹0.21 |
| **Fully loaded cost per influencer per year** | **$0.026** | **₹2.30** |

**In plain terms: it costs us about two and a half rupees a year to keep one
influencer in the database, fully classified and kept up to date.**

---

## 4. What each platform costs, and why we need it

| Platform | What we pay | Can we collect at scale? | Verdict |
| --- | --- | --- | --- |
| **YouTube** | **$0 · ₹0** | Yes, but only with Google's approval for a higher daily limit | **Our core source.** Free, rich, and the foundation of the whole database. |
| **OpenAI** | $0.0035 · ₹0.31 per influencer | Yes | **Essential.** Does the classification work no formula can do. |
| **Google Gemini** | $0.001 · ₹0.09 per influencer | Yes | **Essential.** Second opinion that lets us claim a fact was checked. |
| **X (Twitter)** | $0.00625 · ₹0.55 per influencer | Yes, if collected carefully | **Manageable.** Becomes very expensive if collected carelessly — see §4.4. |
| **Instagram / Facebook** | **$0 · ₹0** | **No** | **Blocked.** Free, but Meta provides no way to collect in bulk. |
| **Snapchat** | **$0 · ₹0** | Not applicable | **Free, but small.** Only a few tens of thousands of profiles exist. |
| **LinkedIn** | Quote only, est. $699+/mo · ₹61,500+/mo | **No** | **Skip for now.** Expensive, opaque, and cannot supply bulk data. |

### 4.1 OpenAI — why we pay for it

OpenAI reads what we have already collected and turns it into things a buyer can
search on. It does three jobs no calculation can do:

- **It works out what a creator actually makes.** YouTube's own labels put 458 of
  our 627 harvested creators in one bucket called "lifestyle", and never once say
  beauty, finance or parenting. Without AI re-classification, those creators are
  invisible to anyone searching our platform. This alone justifies the spend.
- **It grades brand safety across 13 categories** — profanity, hate speech,
  violence, drugs, gambling, political content, and so on — with a note saying
  what was actually seen, so a client can argue with the rating rather than just
  trust it.
- **It judges comment quality** from real comments we read from YouTube.

**What it is not allowed to do:** invent a follower count, a view count, an
engagement rate, or an audience demographic. Our system is built so that the AI
physically cannot return those fields. This is the difference between our product
and the tools that guess.

**Cost:** $0.0035 (₹0.31) per influencer on our recommended settings.
Worst case, if we use the most expensive model with no optimisation: $0.0406
(₹3.57) — **eleven times more.** §9 explains how we avoid that.

### 4.2 Google Gemini — why we pay for a second AI

Gemini checks OpenAI's work on a 10% sample. Where the two disagree on something
important, our system raises a review task instead of quietly picking one.

**This is a product feature, not an engineering luxury.** It is what lets us tell a
client a fact was checked rather than merely generated — which is the thing
competitors cannot say.

**Cost:** $0.001 (₹0.09) per influencer, spread across the whole database.

### 4.3 YouTube — free, but rationed

**We pay YouTube nothing. There is no paid tier. Extra capacity cannot be bought
at any price.**

What Google gives us instead is a **daily allowance**. Ours is enough to add about
**3,300 new influencers per day** and refresh statistics on those we already have.

Google will grant a larger allowance through a free compliance review. That review
is the single most important dependency in the whole plan:

| Database size | Time on the free allowance | Time with approval |
| --- | --- | --- |
| 1 lakh | ~45 days | ~45 days (no approval needed) |
| 10 lakh | ~11 months | ~2 months |
| **65 lakh** | **5.4 years** | **6 months** |

We would need roughly **25× our current allowance** for the 65 lakh target. That is
a large ask, it takes weeks, and it can be refused.

**Note:** running several Google accounts to multiply the allowance is a direct
violation of Google's developer rules and risks losing access altogether. It is
not an option we will use.

### 4.4 X (Twitter) — the one that can go badly wrong

X changed its pricing in February 2026 to **pay-per-use: $0.005 (₹0.44) per post
read**, capped at 2 million reads a month. Above that cap, the only option is an
Enterprise contract starting at **$50,000/month (₹44 lakh/month)**.

The cost swings enormously depending on how we collect:

| Approach | 65 lakh influencers | |
| --- | --- | --- |
| Read 25 posts for every influencer | $845,000 | ₹7.43 crore |
| **Read the profile for everyone, plus 25 posts only for the 1% a client actually shortlists** | **$40,625** | **₹35.7 lakh** |

**This one decision is worth ₹7 crore.** The second approach loses no product
value — nobody looks at post-level analytics for a creator they have not
shortlisted — and it is what we have designed for.

### 4.5 Instagram and Facebook — free, and blocked

**Meta charges nothing.** There is no per-call fee and no subscription. But three
things stop us collecting in bulk:

1. **There is no way to search or discover creators.** Meta's system will tell us
   about an Instagram account only if we already know its exact username. We
   cannot build a database from Meta — we can only add detail to handles we found
   somewhere else.
2. **Access requires a chain of approvals** — a linked business account, a Facebook
   Page, an app review, and business verification. Weeks of process, and refusable.
3. **Our daily call limit is tied to our own account's reach.** Meta's published
   formula grants us 4,800 calls for every one "impression" our own Instagram
   content earns. A new business account with little reach gets almost no
   allowance. This is the constraint most people in this industry miss.

**Two honest routes forward, and we should take both:**

- **Creators connect their own accounts.** When a creator logs in and connects
  Instagram, we get their real numbers — reach, impressions, audience demographics
  — at the highest quality tier we define, and we earn the right to mark them
  **verified**. This costs ₹0. It is a growth problem, not a technology problem.
- **Buy the discovery data from a licensed provider.** Estimated
  **$2,000–10,000 per month (₹1.76–8.8 lakh per month)**, or
  **$60,000–240,000 per year (₹52.8 lakh – ₹2.11 crore per year)** at 65 lakh scale.
  *This is a market estimate, not a quote — it must be tendered.*

**This is the single largest open question in the budget.** It can double the
Year 1 total on its own.

### 4.6 Snapchat — free, and small

Snapchat's Public Profile system is free and open to all developers, though it
requires a written access request that a human reviews.

**But the scale question does not apply.** Snapchat only exposes "Public Profiles"
— Snap Stars and business accounts — which number in the tens of thousands
worldwide, not millions. Normal Snapchat accounts are not reachable by anyone at
any price.

**Recommendation:** integrate it because it is free and adds coverage on
shortlisted creators. File the access request early because the review timing is
unpredictable. **Do not treat Snapchat as a volume source.**

### 4.7 LinkedIn — skip it for now

LinkedIn is the hardest access in the set.

- Basic sign-in is free, and returns name, headline and photo. **No follower count,
  no engagement data, no analytics.**
- Anything useful requires partner approval, decided case by case, typically
  several weeks, **not guaranteed**.
- Their Sales Navigator partner programme is **closed to new applicants**.
- **LinkedIn publishes no price list at all.** Reported figures: around
  **$699+/month (₹61,500+/month)** for approved partners, and
  **$50,000–300,000/year (₹44 lakh – ₹2.64 crore/year)** for enterprise agreements.
  Both are market estimates, not published rates.
- LinkedIn does not license bulk member data to anyone.

**Recommendation: do not build LinkedIn into version 1.** It cannot supply bulk
data, we cannot budget for it honestly, and B2B creator intelligence is a
different product from the one we are building. Revisit when a named customer is
paying for it specifically.

Scraping LinkedIn is not an alternative. It is a direct violation of their terms
with an active history of legal enforcement.

---

## 5. Total cost by database size

### 5.1 One lakh (100,000) influencers

| Line item | USD | INR |
| --- | --- | --- |
| YouTube data | $0 | ₹0 |
| AI classification | $460 | ₹40,000 |
| X / Twitter data | $625 | ₹55,000 |
| Instagram, Facebook, Snapchat | $0 | ₹0 |
| Servers and hosting (12 months) | $4,200 | ₹3.70 lakh |
| Monitoring, backups, email, domains | $1,200 | ₹1.06 lakh |
| Security audit (one-off) | $4,000 | ₹3.52 lakh |
| **Sub-total, running costs** | **$10,485** | **₹9.23 lakh** |
| Engineering to get to production (~6 person-months) | $10,000 – $17,000 | ₹9 – 15 lakh |
| **YEAR 1 TOTAL** | **$20,000 – $28,000** | **₹18 – 25 lakh** |

**Per influencer per year: $0.105 · ₹9.24**
**Time to build: about 45 days.** No special approvals needed.

At this size, servers cost nine times more than AI. This is the cheapest way to
prove the product commercially.

### 5.2 Ten lakh (1,000,000) influencers

| Line item | USD | INR |
| --- | --- | --- |
| YouTube data (needs Google approval — still free) | $0 | ₹0 |
| AI classification | $4,600 | ₹4.05 lakh |
| X / Twitter data | $6,250 | ₹5.50 lakh |
| Servers and hosting (12 months) | $19,800 | ₹17.4 lakh |
| Monitoring, backups, content delivery | $3,600 | ₹3.17 lakh |
| Security audit and fixes | $6,000 | ₹5.28 lakh |
| **Sub-total, running costs** | **$40,250** | **₹35.4 lakh** |
| Engineering (~10 person-months) | $17,000 – $28,000 | ₹15 – 25 lakh |
| **YEAR 1 TOTAL (YouTube + X only)** | **$57,000 – $68,000** | **₹50 – 60 lakh** |
| *Optional:* licensed Instagram data | *$24,000 – 120,000* | *₹21 lakh – ₹1.06 crore* |
| **YEAR 1 TOTAL with Instagram coverage** | **$97,000 – $159,000** | **₹85 lakh – ₹1.4 crore** |

**Per influencer per year: $0.040 · ₹3.54**
**Time to build: 11 months on the free allowance, 2 months with approval.**

### 5.3 Sixty-five lakh (6,500,000) influencers

| Line item | USD | INR |
| --- | --- | --- |
| YouTube data (**25× approval mandatory** — still free) | $0 | ₹0 |
| AI classification, recommended settings | $29,900 | ₹26.3 lakh |
| *AI classification if we do not optimise* | *$131,950* | *₹1.16 crore* |
| X / Twitter data | $40,625 | ₹35.7 lakh |
| Servers and hosting (12 months) | $72,000 | ₹63.4 lakh |
| Monitoring, content delivery, bandwidth, disaster recovery | $12,000 | ₹10.6 lakh |
| Security audit + data protection compliance | $15,000 | ₹13.2 lakh |
| **Sub-total, running costs (YouTube + X only)** | **$169,525** | **₹1.49 crore** |
| Licensed Instagram data (**estimate — must be tendered**) | $60,000 – 240,000 | ₹52.8 lakh – ₹2.11 crore |
| Engineering (~18 person-months, 3–4 people) | $34,000 – $57,000 | ₹30 – 50 lakh |
| **YEAR 1 TOTAL** | **$205,000 – $352,000** | **₹1.8 – 3.1 crore** |

**Per influencer per year: $0.026 · ₹2.30**
**Time to build: 6 months with Google's approval. 5.4 years without it.**

### 5.4 Where the money actually goes

| | 1 lakh | 10 lakh | 65 lakh |
| --- | --- | --- | --- |
| AI (OpenAI + Gemini) | $460 · ₹40,000 | $4,600 · ₹4.05 lakh | $29,900 · ₹26.3 lakh |
| X / Twitter | $625 · ₹55,000 | $6,250 · ₹5.50 lakh | $40,625 · ₹35.7 lakh |
| YouTube, Meta, Snapchat | **$0 · ₹0** | **$0 · ₹0** | **$0 · ₹0** |
| Servers and operations | $5,400 · ₹4.76 lakh | $23,400 · ₹20.6 lakh | $84,000 · ₹74.0 lakh |
| Security | $4,000 · ₹3.52 lakh | $6,000 · ₹5.28 lakh | $15,000 · ₹13.2 lakh |
| Engineering | $10–17k · ₹9–15 lakh | $17–28k · ₹15–25 lakh | $34–57k · ₹30–50 lakh |
| **TOTAL** | **₹18–25 lakh** | **₹50–60 lakh** | **₹1.8–3.1 crore** |

At full scale, **servers are 43% of the budget** and AI is **15%**. The instinct
that AI drives the cost is wrong, and planning around it would send us optimising
the wrong line.

---

## 6. Servers and infrastructure

### 6.1 How much storage we need

Measured from our own working database of 631 real influencers: each influencer
occupies about **25–30 KB** once stored properly.

| Database size | Storage to provision |
| --- | --- |
| 1 lakh | 100 GB |
| 10 lakh | 500 GB |
| 65 lakh | 1 TB |

One policy decision matters more than the hardware. Recording a daily history
snapshot for all 65 lakh influencers generates **285 GB a year**. Recording daily
for the top 1 lakh and weekly for the rest generates **44 GB a year** — an 85%
reduction with no meaningful loss for the long tail. We will do the second.

### 6.2 What we run, by phase

**Phase 1 — up to 1 lakh influencers — $350/month · ₹30,800/month**

Two small application servers, one background worker, a managed database, and a
small cache. Search runs inside the database — no separate search system needed.

**Phase 2 — up to 10 lakh influencers — $1,650/month · ₹1.45 lakh/month**

Three application servers, three background workers, a larger database with a
read-only copy for reporting, and a bigger cache. A dedicated search system gets
added only when search response time starts to slip.

**Phase 3 — up to 65 lakh influencers — $6,000/month · ₹5.28 lakh/month**

Four to six application servers, eight to twelve background workers that scale up
and down with the workload, a large database with two read-only copies and
point-in-time recovery, a clustered cache, and a **dedicated search cluster**.

**Why the search cluster becomes unavoidable:** searching 65 lakh influencers by
category, country, language, follower band, score band, brand safety and risk all
at once is a problem an ordinary database handles well to about 10 lakh records
and badly beyond that. Search is the main thing our customers do. It cannot get
slow.

### 6.3 Managed versus self-managed

For Phases 1 and most of 2, managed cloud services are cheaper and faster to run.
At Phase 3 the economics reverse — a 1 TB database on a managed service costs
materially more than the same capacity on reserved servers. Switching at that
point saves roughly **$23,000/year (₹20 lakh/year)**.

---

## 7. Security

### 7.1 What is already built

| Protection | Status |
| --- | --- |
| Passwords and sessions secured; system refuses to start in production without proper keys | **Built** |
| Creator social media access tokens encrypted; never sent to a browser | **Built** |
| Customer API keys stored scrambled; the real key is shown once, at creation, and never again | **Built** |
| Permission checks run on the server for every action — hiding a button is never treated as security | **Built** |
| Each customer's data is walled off from every other customer's, enforced at the database layer | **Built** |
| Every input validated before it reaches our system | **Built** |
| Login attempts rate-limited; free-plan search limits enforced on the server | **Built** |
| Full audit trail of logins, permission changes, verification decisions and API key activity | **Built** |
| AI physically prevented from returning invented follower or engagement numbers | **Built** |

### 7.2 Required before we go live

| Protection | Cost |
| --- | --- |
| Encrypted connections only, with strict transport security | Included |
| Secrets held in a managed vault, not in files on servers; rotated quarterly | ~$500/yr · ₹44,000/yr |
| Database and cache on a private network with no public address | Included |
| Firewall and denial-of-service protection in front of the application | $2,400/yr · ₹2.11 lakh/yr |
| Backups with point-in-time recovery, 30-day retention, **and a restore drill every quarter** — an untested backup is not a backup | Included in hosting |
| Automated scanning of code and dependencies for known vulnerabilities | ~$1,200/yr · ₹1.06 lakh/yr |
| **Independent penetration test, annually** | $4,000 – 15,000 · ₹3.5 – 13.2 lakh |
| Written incident response plan with an on-call rota and a 72-hour breach notification path | Staff time |

### 7.3 Legal and data protection obligations

| Obligation | What it means for us |
| --- | --- |
| **India's DPDP Act 2023** | Public influencer statistics are largely business data. But once a creator connects their own account, we hold personal data — we need consent records and the ability to delete on request. |
| **GDPR** | Applies to any European creator in our database. Deletion must reach the historical records, not just the profile. |
| **Platform terms of service** | YouTube, Meta and LinkedIn all restrict what we may store and how we refresh it. Compliance is a precondition of Google's higher allowance, so this is commercial as well as legal. |
| **AI vendor terms** | We must obtain written confirmation from OpenAI that our data is not retained and not used for training. Google's paid tier already confirms this; **their free tier does not**, which is a second reason not to use it in production. |
| **Supplier agreements** | Signed data processing agreements needed with OpenAI, Google, our hosting provider, and any data provider we license from. |
| **Creator corrections** | Already built — creators can request corrections through their portal. This doubles as our legal compliance mechanism. |

---

## 8. Project budget and phasing

### 8.1 Recommended phased plan

We recommend building in three phases, with a decision gate at each boundary
rather than committing the full budget up front.

| Phase | Target | Duration | Budget | Must be true before moving on |
| --- | --- | --- | --- | --- |
| **Phase 1** | 1 lakh influencers, YouTube + X | 3 months | **$20–28k**<br>**₹18–25 lakh** | Google application filed · first paying customers signed · search speed proven |
| **Phase 2** | 10 lakh influencers, + Instagram via creator sign-up | 6 months | **$57–68k**<br>**₹50–60 lakh** | Google approval **granted** · Instagram data tender closed · cost per influencer confirmed in practice |
| **Phase 3** | 65 lakh influencers, all platforms | 12 months | **$205–352k**<br>**₹1.8–3.1 crore** | — |
| **CUMULATIVE** | | **21 months** | **$284k – $455k**<br>**₹2.5 – 4 crore** | |

### 8.2 What the engineering money buys

The product itself is already built and working — the interface, the scoring
system, the YouTube and X connections, the AI layer, the permission system and
the customer API all exist today. The engineering budget covers what is needed to
take it from working to production-grade at scale:

| Work | Effort |
| --- | --- |
| Move to a production database | 4 weeks |
| Background processing system that scales with the workload | 3 weeks |
| Instagram connection, plus Meta's app review and business verification | 5 weeks |
| Snapchat connection and access request | 2 weeks |
| Search system for 65 lakh records | 3 weeks |
| Security hardening (§7.2) | 3 weeks |
| Load testing and quality assurance | 3 weeks |
| Monitoring, alerting and operational documentation | 2 weeks |
| **Total** | **~6 person-months for Phase 1** |

Costed at **₹1.5–2.5 lakh ($1,700–2,840) per engineer-month.**

### 8.3 Annual running cost once built (65 lakh, steady state)

This is what the business pays every year after the build is done.

| Line item | USD | INR |
| --- | --- | --- |
| Servers and hosting | $72,000 | ₹63 lakh |
| Monitoring, bandwidth, backups, disaster recovery | $12,500 | ₹11 lakh |
| AI (re-checking a quarter of the database plus all new influencers) | $9,100 | ₹8 lakh |
| X / Twitter data | $40,900 | ₹36 lakh |
| YouTube, Instagram, Facebook, Snapchat | **$0** | **₹0** |
| Security, compliance and audit | $14,800 | ₹13 lakh |
| **ANNUAL RUN RATE, without Instagram licensing** | **$149,000** | **₹1.31 crore** |
| **ANNUAL RUN RATE, with Instagram licensing** | **$209,000 – $389,000** | **₹1.84 – 3.42 crore** |

**At ₹1.31 crore a year across 65 lakh influencers, keeping the database current
costs ₹2.02 ($0.023) per influencer per year.**

---

## 9. Risks

| # | Risk | What it costs us | What we do about it |
| --- | --- | --- | --- |
| 1 | **Google refuses or delays the higher data allowance** | 65 lakh becomes a 5.4-year project. Phase 3 does not happen. | **File on day one.** Do not spend Phase 2 money until it is granted. Never use multiple accounts to work around it — that risks losing access entirely. |
| 2 | **X data collected the wrong way** | $845,000 · ₹7.43 crore instead of $40,625 · ₹35.7 lakh | Profile data for everyone, detailed data only for the 1% a customer shortlists. Already designed in. |
| 3 | **Instagram cannot be collected in bulk** | The biggest influencer platform is the one we cannot harvest | Two tracks in parallel: get creators to connect their own accounts (free), and tender for licensed data. Budget the tender as a separate, decidable line. |
| 4 | **AI settings left unoptimised** | $131,950 · ₹1.16 crore instead of $29,900 · ₹26.3 lakh | Use the efficient model for bulk work, the premium model only for high-value cases. Decide this on a 1,000-influencer accuracy test, not on assumption. |
| 5 | **We change how the AI classifies things** | Re-running everything costs $29,900 · ₹26.3 lakh | Treat classification changes as funded decisions. Budget one re-run per year. |
| 6 | **Servers are 43% of the budget** | Overspend is easy and invisible | Weekly rather than daily history for the long tail, and reserved rather than on-demand servers, cut this by 30–40%. |
| 7 | **Storage estimate drifts at scale** | Hardware under-provisioned at Phase 3 | Re-measure at 1 lakh and again at 10 lakh before buying Phase 3 capacity. |

---

## 10. Decisions we need from management

**1. Do we pursue Instagram coverage in Year 1?**
This is the single largest swing in the budget — **$60,000 to $240,000
(₹52.8 lakh to ₹2.11 crore)** — and the only line item that can double the total
on its own. It needs a tender, and the tender needs authorisation.

**2. Which AI configuration do we run?**
The difference between the efficient and premium settings is **$102,000
(₹90 lakh)** at 65 lakh scale. We recommend settling it with a 1,000-influencer
accuracy comparison rather than by assumption. That test costs under $50 (₹4,400).

**3. Managed or self-managed hosting at Phase 3?**
Worth about **$23,000/year (₹20 lakh/year)**.

**4. What size database are we actually building?**
65 lakh is a choice, not a requirement. The unit economics favour scale — ₹2.30
per influencer at 65 lakh versus ₹9.24 at 1 lakh. The cash flow favours restraint.
**A 10 lakh database with excellent coverage may beat a 65 lakh database with thin
coverage commercially**, and it costs a quarter as much. This should be a
commercial decision, not a technical one.

**5. Approve the Google application immediately.**
It is free, it takes weeks, it can be refused, and nothing above Phase 1 is
possible without it. This needs no budget — only a decision to start.

---

## Annexure A — How we arrived at the AI cost

For readers who want the working.

Every influencer we classify sends about **8,000 units of text** ("tokens") to the
AI provider — roughly 4,500 in and 3,500 back. This was measured directly from our
working system across 551 real classified influencers, not estimated.

| Provider and setting | Cost per influencer | |
| --- | --- | --- |
| OpenAI, current default model, standard rate | $0.0406 | ₹3.57 |
| OpenAI, same model, bulk processing (50% discount) | $0.0203 | ₹1.79 |
| **OpenAI, efficient model, bulk processing** | **$0.00255** | **₹0.22** |
| Google Gemini, checking a 10% sample | $0.001 | ₹0.09 |
| **Recommended combination** | **$0.0046** | **₹0.40** |

Two discounts are available to us today and are not being used:

- **Bulk processing — 50% off.** Our classification already runs as an overnight
  batch job, which is exactly the workload this discount is priced for.
- **Repeat-content caching — 90% off the repeated portion.** About a third of every
  request is identical instruction text sent again and again. Caching it saves
  roughly **$0.003 (₹0.26) per influencer** — **$19,500 (₹17 lakh)** across
  65 lakh influencers.

---

## Annexure B — Where each figure came from

| Category | Source |
| --- | --- |
| Tokens per influencer, storage per influencer, YouTube usage per influencer | **Measured** from our own working system and its live database of 631 real influencers |
| OpenAI and Google Gemini prices | **Published** vendor price lists, retrieved September 2026 |
| YouTube daily allowances | **Published** Google developer documentation |
| X pay-per-use rate and monthly cap | **Published**, verified against multiple independent industry sources, September 2026 |
| Meta's call-limit formula | **Published** Meta developer documentation |
| Snapchat access model | **Published** Snap developer documentation |
| Server costs | **Estimated** from standard cloud provider list pricing for the specifications in §6.2 |
| Engineering effort and rates | **Estimated** |
| LinkedIn partner pricing | **Estimated** — LinkedIn publishes nothing. Market-reported figures only. **Must be quoted.** |
| Licensed Instagram data pricing | **Estimated** — market range only. **Must be tendered.** |
| Exchange rate | ₹88 = $1 |
