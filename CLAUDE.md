# SENSO — Project Instructions

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

**D2 — Frontend-first build order.** *(PostgreSQL landed: see D29.)* All reads and
writes go through `src/server/repositories/*`, which resolve against the record set in
`src/server/data/`. The driver behind it is the JSON file (`development`) or PostgreSQL
(`postgres`); neither is visible to a component or route handler. Social platform
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

**D5 — Typography deviates from the Stitch spec.** *(Superseded by D23. Kept for the
reasoning about tabular figures, which still governs.)* Stitch pairs Geist with Poppins for
numerals. Poppins is a geometric sans with non-tabular figures — columns misalign and
long metric tables become hard to scan, which defeats the stated "financial terminal"
thesis. Use **Geist** for interface text and **Geist Mono** for every numeric value,
metric, score, delta and table figure. This is the DESIGN.md variant-1 direction executed
properly.

**D6 — No dark mode in v1.** The product is a light, dense analytical surface. Adding a
second theme doubles the visual QA surface for no stated requirement. Tokens are defined
so a dark palette can be added by redefining variables only. *(Still true: D23 makes the
chrome graphite on every route, but that is one fixed material, not a user-selectable
theme. There is still exactly one palette to QA.)*


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

**D17 — Type, caps and radius are law, not folklore.** The full type ramp is `@theme`
font-size tokens (`text-2xs` … `text-display`; 14px is the body default and has no token) —
new `text-[Npx]` brackets are allowed only for true one-offs with a comment. Caps micro-labels
are `.label-caps` / `.label-caps-sm` only. Tiles are `rounded-lg`, panels `rounded-xl`; rows
tint on hover, clickable cards lift, static cards don't move. Chart series stop at three
overlaid — comparison renders side-by-side, never a fourth series. Custom size tokens are
registered with tailwind-merge in `src/lib/class-names.ts`; register any future ambiguous
token there or `cn` silently drops it.

**D18 — Composition is the design system, not the components.**
The product's failure mode was never its tokens; it was that every grouping on every
screen was drawn as its own bordered card floating on grey, so nothing could be more
important than anything else. Three composition primitives replace that
(`src/components/ui/panel.tsx`), in increasing weight:

- `Section` — a full-bleed band on the work canvas, separated by a rule. Structure
  without a box. This is the default; most groupings are a band, not an object.
- `Split` — two or three columns sharing one hairline instead of a gutter between
  separate cards.
- `Panel` — a genuine object: a chart, a queue, a dossier block. Bordered but flat.

Inside any container, rows and columns separate with `--color-rule`, which is lighter
than the container's own edge: structure inside a container must never compete with the
container. `Card` is now the same treatment as `Panel` under its older name, so the
forty screens that already import it inherited the change without edits.

**D19 — One hero signal, one strip, then supporting panels.**
Screens open on `HeroSignal` (`src/components/intelligence/signal.tsx`): one oversized
light numeral, the scale it was drawn from, its band, and a plain sentence saying *why*.
Under it, `MetricStrip` — one continuous strip divided by rules, never a tray of
separate tiles. `StatRow`/`StatTile` render as that strip too, which is how the nine
screens still importing them were upgraded in one edit. A strip must divide evenly, and
`React.Children.toArray` is what counts its cells: `Children.count` counts the `false`
that a conditional child leaves behind and silently picked the wrong column count.

Deliberately not built: a "vs previous period" delta on any org-level figure. The real
database holds four snapshot days for 627 of 631 creators, so a period comparison would
be a manufactured number, and manufacturing one on the dashboard of a provenance product
is the single most self-defeating thing this codebase could do. Charts render the
"building history" state instead — DPR §10.2 behaviour, not a placeholder.

**D20 — Provenance is a click-through, not a tooltip.**
`TrackedValue` renders a figure with a dotted rule under it; clicking opens a panel
naming the method, the source tier and its rank, the collection time, the derivation
formula, the model and prompt version where AI was involved, and the field confidence.
A tooltip cannot be reached on touch, cannot be read at leisure and cannot hold a source
link — which is where the product's strongest differentiator had been living. The
profile's metric strip is wired through it; extend it to any figure a user might have to
defend in a meeting.

**D23 — The chrome is the instrument; the work is printed on paper set inside it.**
*(Superseded by D31, which returns the chrome to light and keeps the dark material for one
feature card per screen.)* This replaces D21's tonal scheme and reverses it. The rail, the topbar, the mobile
drawer, the marketing hero and the marketing footer are one graphite housing
(`--color-instrument`); the workspace inside them is warm paper (`--color-canvas`,
#f6f4f1), and white is reserved for panels where measurement happens.

The reason is not taste. The product's strongest idea — a measurement rendered as an
instrument readout — existed on exactly one card, and every other pixel was grey-on-grey
admin chrome. A light rail against a light canvas cannot state an identity no matter how
carefully its greys are tuned; it can only recede politely. Inverting it puts the
identity on every route at zero content cost, and the paper reads brighter for sitting
in a dark bezel.

What follows from it, and is intended:

- **Elevation on graphite is light, not shadow.** A raised surface inside the housing
  takes an inset white hairline (`--shadow-chrome-raised`). A shadow on near-black is
  invisible; a border on near-black reads as a crack.
- **Cobalt gets a second step.** `--color-brand` cannot clear 4.5:1 against #17181c, so
  the chrome uses `--color-brand-lift`. Every semantic hue has the same lifted variant,
  and `BAR_TONE_INSTRUMENT` in `distribution-bars.tsx` is where the mapping lives.
- **Identity and account moved into the rail.** The topbar now carries only what every
  route shares — the palette, the search allowance, help, notifications — which is what
  makes it able to belong to the page instead of being a second row of chrome.
- **`Instrument` is capped at one per screen** (`src/components/ui/panel.tsx`). It
  carries the screen's single headline reading. Two of them and neither is the headline.
- **Brass (`--color-brass`) enters, and is spent only on measurement**: the score dial's
  tick ring and the verification seal. Never a control, never a link, never a fill. Its
  scarcity is the whole mechanism — a gold mark can then only mean "this was read".

**D24 — Two typefaces, split by what a thing *is* rather than by size.**
*(Superseded by D31: Plus Jakarta Sans and Inter now fill the same two roles.)*
Space Grotesk sets every heading and every numeral; Instrument Sans sets interface text.
Montserrat is dropped.

The numeral half is the load-bearing decision. Space Grotesk descends from Space Mono, so
its digits are uniform width by construction — the property D5 chose Montserrat for — but
it also has drawn character, which Montserrat does not: a geometric grotesque that is on
every second SaaS site cannot make a score read as a reading. Instrument Sans takes the
interface text because a display face at 11px in a dense table is a legibility bill paid
on every row.

Consequences: `--font-display` and `--font-num` are the same family by design, and
`.font-num` still carries `tnum` and `zero 0` so a fallback face behaves. Only weights
500/600/700 (display) and 400–700 (text) are loaded — `font-light` and `font-extrabold`
were removed from the codebase rather than left to synthesise. Chart axis labels are set
in the numeric voice too: an axis in the interface face beside a metric strip in the
numeric one is a seam nobody names and everybody feels.

**D25 — Radius rises with the size of the element, and elevation is declared once.**
*(Ladder superseded by D31; the principle stands.)* The ladder is 4 / 6 / 8 / 10 / 14 / 18px — micro-tag, input, button, tile, panel,
housing. A single radius everywhere is the tell of a system that picked a number instead
of making a decision, and a panel that curves less than the chip inside it stops reading
as a container. Pills are for small controls only.

Elevation is a border **or** a shadow, never both: a 1px border under a wide soft shadow
is the ghost card. The shadow tokens therefore carry their own hairline as their first
layer, so an overlay stays defined against white without a second declaration.

**D26 — Motion is one recipe, and scroll is left alone.**
The marketing site has exactly one entrance — rise 14px, unblur 6px, settle over 700ms,
once — driven by an IntersectionObserver in `src/components/marketing/reveal.tsx`. No
Framer Motion, no GSAP, no Lenis. Two reasons, and the second is the real one:

- A scroll-animation dependency would be the largest thing on a page whose entire
  argument is that the product is measured rather than decorated.
- Smooth-scroll hijacking on an enterprise page is an accessibility liability, not a
  flourish. The browser's own scrolling is already smooth, already interruptible, already
  correct with a keyboard and a screen reader, and already respects the platform's
  reduced-motion setting.

Inside the application, motion stays where it was: one authored moment per screen (the
score arc drawing itself), plus press, lift and the dialog entrance. `prefers-reduced-motion`
neutralises all of it, and `.reveal` resolves to its *shown* state under that query — a
reveal that hides content when its transition is disabled is a broken page, not a quiet one.

**D27 — A kicker above a heading is wayfinding or it is nothing.**
`PageHeader`'s `eyebrow` prop still exists and still names the section, but it renders as
the leading step of the breadcrumb trail rather than as a caps label stacked over the
title. Same words, same information, no decorative row — and with the section already
visible in the rail's active item, a second copy of it above the title was pure
duplication. Caps micro-labels remain correct where they name a *group of data*
("Content themes", "Audience risk"); they are wrong as a label on a heading.

**D31 — The product is soft, light and green; the dark card is the feature, not the frame.**
*(Supersedes D23, D24 and D25. D21's grouping rule and D18/D19's composition rules
still stand.)* The chrome was inverted back to light: the rail is white, the topbar is
transparent on the canvas with a white pill search, and the work sits on a pale
green-grey ground (`--color-canvas`, #f2f5f3) as white, borderless, generously rounded
cards. Depth is tonal; a card carries a whisper of shadow (`.card-shadow`), never a
hairline under a shadow.

The reason: the graphite housing made the product read as an instrument for engineers,
and the people who buy it are marketing teams. The reference direction — soft ground,
white rounded cards, one green, prominent avatars, pill controls — is the visual language
those buyers already trust, and the product's actual differentiators (provenance,
deterministic scores, honest empty states) survive the re-skin untouched.

What follows from it, and is intended:

- **One green.** `--color-brand` (#17804a, 4.97:1 with white) marks actions, the active
  route, focus and the score arc, *and* is the hue of a measured positive. On this
  product "good" and "go" are the same reading. Verified provenance stays blue so it is
  never confused with a positive.
- **The instrument tokens kept their names and changed material.** `--color-instrument`
  is now deep forest (#173a2f) and `Instrument` renders as a rounded feature card inside
  the page gutter rather than a full-bleed band. Twenty files that used the graphite
  inherited the new material with no edit. It is still capped at one per screen.
- **Radius rose.** 6 / 10 / 12 / 16 / 20 / 28px — chip, input, control, tile, card,
  feature card. Buttons, tabs and segmented controls are pills. The primary button is
  green with a soft green glow (`--shadow-brand`); ink is not a button colour.
- **Two voices, still.** Plus Jakarta Sans sets headings and every numeral (it ships
  `tnum`, so D5's tabular-figure reasoning is satisfied); Inter carries interface text.
  Weights 500–800 and 400–700 respectively; `font-extrabold` is now legitimate on titles.
- **Metric tiles may carry an icon coin.** `Metric` takes `icon` and `iconTone`, drawn
  as a soft tinted circle-square beside the figure — the reference KPI tile. Still one
  card divided by rules, never a tray of separate boxes.
- **The application is one rounded object on the page.** `AppShell` draws a
  `rounded-3xl` frame (`--color-canvas`) on a darker ground (`--color-ground`), and
  everything lives inside it: a white pill topbar (wordmark, the first five
  destinations as a centred tab strip, search / alerts / avatar as round controls),
  an icon-only rail (`IconRail`, active icon a filled green circle, sign-out at the
  foot) and the page. Below `lg` the rail and tabs give way to the labelled drawer.
  Cards are flat white — `--shadow-card` is transparent — because a white card on
  the frame's grey needs no edge.
- **The creator profile uses the dashboard's composition**
  (`src/components/profile/profile-bento.tsx`, helpers in
  `intelligence/bento-card.tsx`). Name heavy and handle light in the header, a
  refreshed-at pill and the actions beside it; then the same three columns: the
  score on the green card over a small engagement card, the column chart with a
  Components / Uploads toggle (uploads plot views as a share of the best one, and
  the bubble prints the real figure), similar creators as the table, and on the
  right the follower figure over the history curve — drawn only when the series is
  sufficient, otherwise the building-history state — then data confidence with the
  source mix. The tabs sit below for depth. The graphite `HealthPanel` is no
  longer rendered on this page.
- **The dashboard follows the reference composition.** Three columns: the score
  printed on a green "card" (the roster's median health) over a small engagement
  card; the column chart with a Health / Confidence pill toggle (`ColumnsToggle`,
  hatched context, solid top bar with a value bubble, dotted axis); the roster as
  a table spanning both; and a right column with combined audience over an
  `AreaCurve` (cumulative reach, smallest creator first — not a time series, and
  labelled so) with Discover / Compare buttons, then data confidence with a
  shortlist avatar stack. Signals and campaigns sit on the second screen. Chart
  shapes are hand-rolled SVG in `src/components/charts/bento.tsx` — a dashboard
  card never imports Recharts. The area fill is the product's one gradient, and it
  belongs to a chart, not a surface.
- **Discovery browses as cards, and filters sit beside the search.** `ResultCards`
  is the default result view — avatar, name, category chips, health, and the three
  first-pass figures — with a row of quick-sort pills over it and a Cards/Table
  toggle for the comparison pass. The table is unchanged and still the mobile stack
  below `lg`. There is no filter rail: a Filters popover (columns, stays open while
  facets are toggled) from `lg`, a sheet below it, at every width.
- **Floating layers never live inside a clipping ancestor.** Tooltips render into
  `document.body` with fixed coordinates from the anchor's viewport rect (closed on
  scroll rather than repositioned); menus and popovers use the platform top layer.
  The navigation rail scrolls internally and the profile table scrolls horizontally,
  and neither may cut off what a control opens.
- **The rail is fixed, the topbar is a sticky band.** `IconRail` is
  `position: fixed`, its left edge following the centred frame, its height the
  window below the topbar; a flow spacer holds its column. The topbar sits in a
  canvas-coloured sticky band carrying the frame's top padding, so scrolled content
  passes behind it rather than through the gap above the pill.
- **Metric labels are sentence case.** Caps micro-labels stay for section eyebrows;
  a KPI tile beside an icon coin reads as the references do, in a small regular label.
- **The marketing site inherited the palette and was not redesigned.** Its hero and
  footer are now deep forest rather than graphite. A light marketing redesign is a
  separate piece of work.

**D47 — Sentiment is counted from labelled comments; listening is over the creators SENSO indexed, and says so.**
The requirement asked for sentiment analysis and consumer intelligence. One
is buildable as asked, the other is half buildable, and the naming says which
is which rather than shipping the second under the first's name.

Sentiment (`sentiment-service.ts`): the connector supplies real comments (1
quota unit a video, no OAuth), the model labels each one it is shown, and
this file counts the labels. No percentage is ever asked of the model, and a
label for a comment that was not shown is dropped rather than attached to the
wrong text. Spam and neutral leave the denominator — a comment with no
opinion is not a lukewarm endorsement, and counting it as one flatters every
creator whose comments are mostly emoji. The record carries its sample size
beside the share, because a positive share over forty comments and one over
four hundred are different claims. With no key, or with comments disabled,
there is no record rather than a neutral score: "we did not measure this" and
"the audience feels nothing" are different statements.

Listening (`listening-service.ts`): 434k indexed posts with their titles,
captions, hashtags and figures are a corpus you can track a brand or a theme
through — who is talking about it, how often, with what reach, which tags
travel with it, week by week. That is *creator* listening, and an influencer
platform is uniquely placed to do it. Consumer listening is not built, because
SENSO holds no consumer posts, reviews or forum threads and no public API
offers them. So every read prints what it searched — creators indexed, posts
in the window — and the page says in as many words that this is not a share
of the platform. A share of voice without its denominator is the single most
quotable wrong number a listening tool can produce.

Also here: `handler` now maps an upstream failure (AI or connector) to 503
with the reason, instead of "something went wrong" — the person reading it is
usually the one who can fix it — and a *credential* rejection is logged in
full but reported in outline, because the upstream's own message quotes part
of the key back.

**D46 — The assistant translates and narrates; it never produces a figure, and search finds meaning in the corpus rather than in a substring.**
Two halves of the same requirement, built so neither needs a model to be
useful.

The assistant (`assistant-service.ts`) splits the work by what each side is
good for. The deterministic grammar (D-era `ask-service`) runs first and wins
wherever it read something, so a sentence the product already understands
never becomes a model call. The model is asked only about the words the
grammar left behind, and its schema holds filter values only — there is no
field a follower count could arrive in. It then narrates rows it was handed,
under a schema of prose and creator ids, and the narration is checked against
those rows before it is shown: a figure in the sentence that is not in the
data drops the whole answer (`isGrounded`), and a highlight pointing at a
creator who is not on screen is discarded as a hallucinated citation. Every
number a person reads is rendered by this application from the search result.
With no key, or with the provider down, the answer is the matches plus a note
saying which part is missing — the search itself never depended on AI.

Semantic search (`analytics/semantic-index.ts`) is TF-IDF with cosine over
the creators' own text — bios, upload titles, captions — built from the
corpus in process and rebuilt when the store revision changes. Deliberately
not embeddings: it needs no provider, so it works on a deployment with no AI
key; it cannot invent a creator into a result; and its ranking reports the
terms that earned it, which on a product whose pitch is checkable numbers
matters more than the last few points of recall. It is additive — the
existing exact-match filter is untouched — and the assistant falls back to it
when the filters match nothing, labelled as "closest by meaning" rather than
passed off as a filter match. "Telugu cooking in Hyderabad" returned nothing
before and now returns Telugu cooks in Hyderabad.

**D45 — An agency's clients are books of work inside one org, and a session's authority is re-read on every request.**
Two things the tenancy model was missing, and one that was quietly wrong.

A brand (`src/lib/contracts/agency.ts`, `agency-service.ts`) is a client *of*
a client: a row inside the agency's own organisation that a campaign, a
shortlist and a report may be filed under. Giving each brand its own org was
the obvious move and the wrong one — the agency would lose the only view it
needs (everything it runs, across clients), its seats would multiply, and its
team would sign in somewhere different per account. So tenant isolation is
untouched and brand scoping sits *inside* it: `assertTenantAccess` still runs
first everywhere. A member limited to some clients sees only those clients'
work, and that includes work filed under no client, because an unfiled
shortlist is the agency's own. A report shared for a brand goes out under the
brand's name and mark (D43 extended past the org), falling back to the
agency's rather than going out unbranded.

Plan management is self-serve (`billing-service.ts`), and stops exactly where
honesty requires. A downgrade is the customer's to make: it is scheduled for
the end of the period they already paid for, refused if more accounts are
active than the smaller plan seats, and re-checked when it comes due — an org
that grew in the meantime has its downgrade held rather than its people cut
off. An upgrade is recorded and applied by SENSO once the commercial side is
agreed, because there is no payment processor and a checkout that charges
nothing is a worse lie than saying so. `applyChange` is the seam when one is
added. Statements state what was used, not what is owed; closed periods are
archived on rollover so a statement can describe more than today.

Entitlements are now enforced where they are spent rather than where a button
is drawn: seats at `createUser` (counted from live rows — a `seatsUsed`
counter that drifts is a limit that has stopped being one), campaigns and
exports through `assertFeature`, exports and reports metered like API calls.

The quiet wrong thing: every one of those decisions read the *session cookie*,
which is signed at sign-in and lives a week. An approved upgrade would not
have taken effect for seven days, and a revoked client access would not
either — which makes it an access control in name only. `getSession` now
overlays the organisation's own fields (plan, name, mark, role, brand access)
from the store on every read, synchronously, because both are already in
memory (D29). Identity stays whatever was signed; only authority is refreshed.

**D44 — Campaign performance is attributed from indexed posts, not modelled.**
*(Closes the "live hashtag attribution is not wired" limitation.)* The old
`participantPerformance` invented a campaign: it credited a delivered participant
with three posts at their own median views, split engagements 86/9/5 and drew reach
at 1.08 x views, then `getCampaign` synthesised one object per invented post with an
`example.invalid` URL and a written caption. On the one screen a client opens to
check what they paid for, every figure and every row was manufactured — the exact
failure the rest of the product exists to prevent.

`attribution-service.ts` replaces it. A campaign post is a row in the same `content`
table every profile is scored from: it belongs to a participant, carries the tracking
hashtag, sits inside the campaign window and is on one of the campaign's platforms.
190k of the 434k indexed posts carry hashtags, so this finds real posts with their
real URLs, captions, publish times and figures. Detection is exact-token over both
the structured hashtags and the title/caption (`#launch` must not match
`#launchday`), because Instagram returns one caption string and YouTube creators
often tag in the title.

What follows, and is intended:

- **Absent stays absent.** A metric no platform reported sums to null, not zero:
  Instagram publishes no view count, so a campaign's views are the sum of what was
  observed or nothing at all. `reach` is now always null and the column says
  **Views** — these APIs publish views, and restating them under a word that
  promises unique people was the quieter half of the same lie.
- **No posts means no score.** `campaignScore` is null until something is attributed,
  and it scores only the components that were observed, renormalising like the health
  score does (`campaign-2.0.0`).
- **Deliverables are the denominator.** A campaign defines what each participant owes
  (platform, format, quantity, due date) and fulfilment is counted from attributed
  posts — never from a status somebody set by hand. States: not started, in progress,
  fulfilled, overdue.
- **Manual correction is evidence too.** Detection misses posts and over-matches, so
  an operator can include or exclude a post by id; the override is stored separately
  from the rule, counted on the performance record (`manualIncludes` /
  `manualExcludes`) and each attributed row says whether it was matched by hashtag or
  by hand.
- **The seeded campaigns adopt a tag their participants really used**, over the
  eight-week window holding the most of those posts, so the demonstration campaign
  demonstrates real attribution. The seeds also prefer real creators over the four
  demonstration records, which sorted first on id and had quietly made every seeded
  shortlist and campaign fictional. A database with no match falls back to the written
  tag and shows the honest "no posts matched yet" state.

**D43 — A client organisation may carry its own mark; the product keeps its name.**
`Org.logoUrl` (set at creation from the New account dialog, or `PATCH
/api/internal/admin/orgs`) travels on the session as `orgLogoUrl`, and inside that
organisation's workspace the topbar, the drawer and the org block show the client's
logo and name (`OrgMark`) where the SENSO wordmark would be — and nowhere else. The
marketing site, the sign-in page and every other organisation are untouched, and the
product's own terms (SENSO Health, SENSO Verified, the provenance labels) do not
change, because they name the measurement, not the customer. Logos live under
`public/brand/clients/` as trimmed PNGs; a `/brand/…` path or an https URL is
accepted. First client: Kolors Health Care, 2026-09-21.

**D42 — One process with a measured ceiling, a staging twin, and CI on a slice of the database.**
*(Amends D29's "~10k creators".)* Measured on the VPS on 2026-09-20: 8,678 creators,
425k content rows and 33k snapshots resident cost `next-server` 947 MB RSS — about
110 MB per thousand creators — and Node's default heap on that box is 2 GB, so the
real limit was ~18k, three weeks away at the ~600 creators a day the crons add.
`ecosystem.config.cjs` now runs production with a 4 GB heap (the box has 8), which
moves the wall to ~35k; `/api/internal/health` reports `memoryMb` and the cron
healthcheck posts a capacity warning to Slack once a day past 3 GB or 25k creators.
That warning is the trigger for the SQL read path D29 deferred — not before, because
every read today is a synchronous function over rows already in memory, and
rewriting that for a ceiling three months out would be the wrong order. The process
refuses to start as any PM2 cluster worker but the first: sessions' rate limits, the
workspace read model and the scheduler are all in-process, and a second instance
would answer from a copy that never sees the first one's writes. Redis is the
precondition for scaling out, and it is not needed yet.

Staging is the same VPS: `staging.srv1082984.hstgr.cloud` (Hostinger resolves the
hostname's subdomains, so no DNS work), its own `senso_staging` database restored
from the newest backup, no daily jobs, no outbound mail, port 3015, deployed with
`SENSO_TARGET=staging scripts/deploy-vps.sh <ref>`. `scripts/vps/create-staging.sh`
made it and can be re-run. CI (`.github/workflows/ci.yml`) runs types, lint, unit
tests, a production build and the full Playwright suite on every push, against the
development driver over `e2e/fixtures/ingested.json.gz` — 150 creators spread across
the follower range, cut from the real database by `scripts/e2e-fixture.mjs` (a slice
of only the largest made every audience-size filter narrow nothing). CI never
deploys; a person runs the deploy script against a tag.

Also here: alerts are derived (`alert-service.ts`) and the daily digest
(`digest-service.ts`, a third job on the scheduler, which no longer needs a YouTube
key to arm) emails each client user only the alerts that were not in their previous
digest — alerts are state, not events, so a plain daily mail would repeat forever.
Reports: campaign CSV beside the shortlist one, and "Save as PDF" is the browser's
print dialog over a print stylesheet that drops the chrome; no rendering service.

**D41 — Accounts are invited, links are emailed, and the server watches itself.**
Production readiness for the first clients (2026-09-20). Accounts: the public
registration form is an enquiry emailed to `EMAIL_REPORT_TO`; a super admin creates
the organisation and its owner on `/admin/users` and the person receives an invite
link (7 days) to choose their own password — no password ever passes through an
admin. Password reset issues the same kind of link (30 minutes). Only the token's
SHA-256 is stored, on the user record, and issuing again replaces it; redemption
spends it. `reset-request` fires its work without awaiting so a known address takes
no longer than an unknown one. Mail goes through the existing `sendEmail` (Resend by
`fetch`, no SDK). Headers: CSP (inline scripts allowed — Next's hydration payload is
one, and there is no third-party script), HSTS, `frame-ancestors 'none'`; no
`upgrade-insecure-requests` because it rewrote every redirect on a plain-http dev
server. Ops: `/api/internal/health` says the process answers and the database is
loaded; `onRequestError` posts unhandled server errors to Slack, one per distinct
error per ten minutes; on the VPS, `scripts/vps/install.sh` (run by every deploy)
installs a nightly `pg_dump` (30 kept locally, copied off-box when an rclone remote
`senso-backups` exists), a five-minute healthcheck that restarts PM2 after two
failures and posts to Slack, and PM2 log rotation. Deploys ship a git ref through
`git archive`, refuse a dirty tree, and record `DEPLOY_SHA` on the server. The
preflight's margin reset had left every `<dialog>` in the top-left corner; base
`dialog { margin: auto }` restores the centring once.

**D40 — The landing page is one grid on one ground, and its reveal is once, timed and scripted.**
*(Amends D38 and D39.)* The page mixed three container widths and two heading
alignments, alternated white and canvas bands with a rule between each, and let
two surfaces overlap — and the gutter jumping from band to band was most of what
made it read as assembled rather than designed. Now: one container (`WRAP`,
`max-w-6xl`), every heading on its left edge through `SectionHeader`, the canvas
throughout with white surfaces on it, nothing overlapping anything. The provenance
example is one framed surface (figure beside its opened panel) rather than two
floating cards; the pipeline is a numbered list, not five cramped columns.

Motion reversed D38's scroll-driven reveal. `animation-timeline: view()` scrubbed
opacity *and blur* against the scrollbar: a slow scroll left every band
half-shown, scrolling back re-hid it, and blurring a full-width table per frame
was the most expensive thing on the page. `Reveal` is again an IntersectionObserver
that marks a block `is-in` once, over 700ms, with no blur; `stagger` sequences a
strip's children. D38's crawler concern is kept by hiding the un-revealed state
only under `@media (scripting: enabled)`. Instrument entrances inside a revealed
block are `animation-play-state: paused` until it is in view, so the arc and bars
play as the reader arrives. The hero keeps its pure-CSS load entrance so it starts
on first paint rather than after hydration. Removed outright: the pointer tilt and
glow on the hero card, per-row reveals inside tables, and `CountUp` counting the
digits of a compact string ("2.4K" passed through "0.6K") — it now counts the raw
value through `formatCompact`.

**D39 — The landing page shows real creators, and its instruments play on scroll.**
*(Amends D22's "every fabricated value lives in specimen.ts".)* With seven thousand
creators indexed, the surfaces that show *a creator* show a real one:
`src/components/marketing/live.ts` picks the highest-health creators with a photo, a
country, a real audience and a showcase category (Indian creators first, one per
country after), and the hero, dossier, search rows, facet counts, provenance figures
and the quality scatter are the application's own readings — including withheld
components drawn as absent and a benchmark only where the cohort publishes one. The
specimen module remains the fallback for an empty database and the source of the two
examples that must stay illustrative: the campaign (SENSO holds no client's campaign)
and the AI extract (enrichment has not run on these creators). The disclosure line
says which is which. Motion: live figures count up once on entry (`CountUp`, server
renders the final string), the dossier's bars and arc and the search rows play as
they scroll into view (`.mk-surface`, `.mk-rows` — scroll-driven, no script), and
the hero surface leans a few degrees toward the pointer (`PointerGlow tilt`). All of
it is off under `prefers-reduced-motion`.

**D38 — The landing page is the product's own material, and its reveal needs no script.**
*(Closes D31's "a light marketing redesign is a separate piece of work".)* The dark
hero is gone: the page opens on the application's canvas with the creator surface set
in it as a white card, the five-stop journey follows as one divided strip, and every
band after it carries its step number as a kicker (wayfinding, per D27). The one dark
surface is the closing feature card; the footer went light so the page does not end
between two of them. `Reveal` no longer hides content until an IntersectionObserver
marks it shown — that blanked the page for crawlers, screenshots and slow hydrations.
It is a scroll-driven CSS animation (`animation-timeline: view()`) behind `@supports`,
so content is visible by default and a browser without the feature simply shows it.
D22's rules stand: real surfaces, specimen values in `specimen.ts`, live coverage.

**D37 — Every workspace route has a loading boundary, and navigation is cached for a minute.**
Without a `loading.tsx`, Next prefetches a dynamic route *in full*: each link on screen
is a complete server render, the rail alone carries a dozen, and a click waited behind
thirty renders queued by the page it was leaving. Each route group now has one
(`src/components/shell/page-loading.tsx`), so a prefetch stops at the shell, the click
paints a skeleton at once, and only the chosen page renders. `staleTimes.dynamic = 60`
serves a page visited in the last minute from the client router cache — the store
changes on a daily cadence, so nothing a person could notice is stale. Lists of
creators carry `prefetch={false}` on their profile links. The scoring pass (D36) runs
in 40 ms slices and is not restarted within two minutes of the last; `derive` is
memoised on the row, so a pass calls it once per creator rather than twice.

**D36 — Scoring the database is a background pass; a request reads the last one.**
`allSummaries` used to rescore every creator whenever the store changed or a minute
passed — inside whichever request came next. With a harvest writing every couple of
minutes that was nearly every request, and at 5.8K creators on the two-core VPS it
was 10–15 seconds with the event loop frozen for everyone else. The pass (cohort
medians, then every creator) now runs in the background in chunks of 100 that yield
between them — at boot (`warmSummaries` from `instrumentation.ts`), when the store
revision changes, or when the list is five minutes old — and every collection read
returns whatever pass finished last. Cohorts are served from the last pass too, so a
single profile read after a write is normalised against medians a few writes old,
which is a rounding error. A cold process with nothing warmed still scores
synchronously once. Landing page went from 13s to 0.1s; profile pages ~0.6s.

**D35 — Instagram is read through Business Discovery, as SENSO's own account.**
`src/server/connectors/instagram/`. Instagram publishes no public read of an arbitrary
account and no search; what it publishes is Business Discovery — a professional
account SENSO owns may ask, by username, for the public figures and recent media of
any other Business or Creator account. So the connector needs `META_IG_USER_ID` and
a long-lived Page token `META_IG_TOKEN` (`scripts/meta-token.mjs` derives both from a
Graph API Explorer token) beyond the app keys, needs no App Review for these reads,
and is rate-limited at 200 calls an hour × the app's daily active users — with one
user, 200 an hour, ~4,800 creators a day; the limit is per *app*, so the credential
pool (`META_IG_POOL`, 37 linked Pages) shares it rather than multiplying it, and the
way up is more people using the app's login or a licensed provider. Creators
are added by handle (`/api/internal/connectors/instagram/ingest`, the admin ingest
card, or `refreshInfluencer`) and re-read daily by `refreshInstagramStale` inside the
snapshot job. What comes back is followers, media count, bio, and posts with likes
and comments; no views, no country, no language, no history — recorded as absent,
never zero. The YouTube sweeps (`refreshableAccounts`) now filter to their own
platform, which they never had to before.

**D34 — Production is one Hostinger VPS, not Vercel.**
`srv1082984.hstgr.cloud` (168.231.120.57), Ubuntu 24.04 with CloudPanel. The app runs
as the `senso` site user under PM2 on port 3005 (`pm2-senso` systemd unit), behind
CloudPanel's nginx with a Let's Encrypt certificate; PostgreSQL 16 is native
(`senso` database, restored from the local dump on 2026-09-16 with 4,138 creators).
Secrets live only in `/home/senso/htdocs/srv1082984.hstgr.cloud/.env.production.local`
and are never synced. `scripts/deploy-vps.sh` rsyncs the working tree, builds on the
server and restarts. The in-process scheduler (D30) runs there, so `vercel.json`'s
crons are dormant until a Vercel deployment exists again. Move to the real domain by
adding a CloudPanel site for it and updating `APP_URL` and the OAuth redirect URIs.

**D33 — The palette is the mark's: violet for intent, the tile for the feature card.**
*(Amends D31's "one green".)* `--color-brand` is now the logo's purple (#5b2cf0,
6.86:1 with white), `--color-instrument` its tile (#1a0a2e), and the ground, canvas,
lines and ink are violet-tinted greys rather than green-grey. Two consequences are
deliberate. First, "go" and "good" are no longer the same hue: a measured positive
stays green, so the "Strong" health band and the "Good" confidence band moved from
`brand` to `positive`, and a control can never be mistaken for a reading. Second,
`inferred` moved from violet to teal (#0e7490) — an AI-derived badge sharing the
action colour would have looked like something to click. `verified` gained soft /
line / lift steps and a `Badge` and bar tone of its own, so the SENSO Verified chip
is blue as §8 always intended rather than borrowed from the brand. Chart series are
violet, deep teal, warm orange — the mark's three families. Semantic hues, brass and
the shape and type systems are untouched.

**D32 — The product is SENSO; the codebase's internals still say socialorbit.**
Renamed 2026-09-16, five days before launch. Everything a person can see says SENSO:
copy, metadata, the wordmark, the `SENSO Verified` / `SENSO Health` labels, the seed
accounts (`admin@senso360.com`), the public API headers (`x-senso-api-version`,
`X-SENSO-Signature`), the API base URL and the mailto addresses. The mark is
`SensoMark` in `src/components/shell/logo.tsx` — an SVG tracing of the supplied
logo, so it is crisp at rail size and is also the favicon (`src/app/icon.svg`,
`apple-icon.png`). The original raster belongs at `public/brand/senso-mark.png`.

Deliberately *not* renamed, because each is a deploy-time identifier whose only
audience is this codebase and renaming it risks the launch for no visible gain:
the `SOCIALORBIT_*` env vars, the `so_session` cookie, the `socialorbit-postgres`
container and its volume, the `socialorbit.dev.store` registry symbol, the
`docs/` blueprints and the product-rule tables in this file. Rename them after
launch, together, or never. The working folder and the GitHub repository were renamed to
`senso` on 2026-09-21. The domain is `senso360.com` (Hostinger, registered 2026-09-16); the public
API is served from it at `/api/v1` rather than from an `api.` subdomain.

**D30 — The database feeds itself: two daily jobs, one clock, one bookkeeping row each.**
`src/server/services/daily-jobs.ts`. `snapshot` re-reads every account not read today
(`refreshStale`, staleness-ordered) — the only way a growth history is built. `discover`
runs the next slice of a fixed rotation (`ROTATION`: the 32 category queries, then the
place plans in `discovery-plan.ts`), the slice derived from the date rather than a stored
cursor so two runners pick the same queries. Each job records the UTC day it ran in
`job_runs`, so a timer and a cron cannot double-spend; a snapshot pass cut short by time
or by its channel cap is *not* recorded, so the next tick continues it.

The clock is in-process — `startScheduler()` from `instrumentation.ts`, a quarter-hour
tick that runs whatever today still owes once the hour has passed — because a
long-lived server needs no second piece of infrastructure to have a schedule, and a
laptop asleep at 09:00 catches up on waking. It is opt-in (`SOCIALORBIT_DAILY_JOBS=true`)
and needs a YouTube key: nothing spends quota by surprise. Vercel has no long-lived
process, so `vercel.json` calls the same two functions through the cron routes instead.
Discovery is capped per day (`SOCIALORBIT_DISCOVERY_SEARCHES_PER_DAY`, default 10 ≈ 1,500
units) so the snapshot pass (~2 units per account) and operators always have quota left.

**D29 — Postgres is the durable copy; the process still reads from memory.**
Every read path scores raw rows synchronously on request, and D2 promised the database
would slot in without touching a component or route handler. So the Postgres driver
(`src/server/data/postgres.ts`) does exactly that and no more: the record set is loaded
once per server start (`src/instrumentation.ts` → `warmIngestedStore`) and every store
mutation is written through in order, in one transaction, as the delta it made. The
store's write functions now return promises and their callers await them, so a route
does not answer before the row exists.

Rows are `jsonb` beside the two columns writes are addressed by — the row key and the
owner a set is replaced under — one mapping for nine kinds. Promote a field to a column
the first time a query needs an index on it; move reads to queries when the working set
stops fitting (~10k creators). A Postgres with no creators imports `.data/ingested.json`
on first boot, so switching drivers is a one-line env change. Workspace state —
users, orgs, shortlists, campaigns, API keys, usage counters — followed on 2026-09-16
through `src/server/data/app-store.ts`: one `app_state (kind, id, data jsonb)` table,
loaded into the process at boot after the creators, each mutation queued through as
the row it changed (memory stays the read model; a crash inside the queue loses one
write). A kind with no rows is primed from its seed once, so the seed function stops
being the source from the second boot. Accounts are created by a super admin through
`POST /api/internal/admin/users` (with an org, or into one) — public registration is
still an enquiry, not an account.

**D28 — A city is a mention, not a field.**
No public platform API exposes a location finer than country, so "creators in
Hyderabad" cannot be observed — but the creator's own text can be read. `placeMentions`
(`src/server/analytics/place-mentions.ts`) is derived at read time from the channel
title, description and upload titles: a bio mention counts on its own, uploads need two,
and a Pakistani channel's "Hyderabad" is not tagged as the Indian one. It is rendered as
*Mentions*, never as a location, and free-text search matches it. Derived rather than
stored so the creators ingested before it existed are covered without a backfill.

Place sweeps use the harvest's `queries` mode (`scripts/harvest-places.mjs`): searches
phrased as a local would write them, ranked by relevance rather than views, restricted
to India and to channels active in the last eighteen months, in the local script where
that is what local creators write in. A query surfacing a channel is *not* evidence of
where it is from — only the text rule above tags a place.

**D21 — The chrome is the ground, the work is the figure.** *(Superseded by D23, which
keeps this conclusion and reverses its materials: navigation still recedes behind the
analysis, but it does so by being graphite rather than by being a lighter grey. The
grouping rule below still stands.)*

Navigation is grouped by user intent (`Discover` / `Activate` / `Intelligence` /
`Trust & data` / `Administration`), not by which backend module owns the route, and every
`PageHeader` carries the section name as an eyebrow so a screen states where it stands.

**D22 — The marketing site renders the product, and says which numbers are chosen.**
`src/components/marketing/product-surfaces.tsx` composes the application's own
components — the score instrument, the confidence track, the provenance panel, the
risk vocabulary — so the landing page shows the product rather than a picture of it
and cannot drift when the product changes. Two rules follow:

- **Every fabricated value lives in `specimen.ts`.** One module, so a reader can
  check in one place exactly which figures on the marketing site were chosen rather
  than measured. Coverage figures come from `databaseStats()` and are live. The page
  carries one disclosure under the hero and one in the footer — not a stamp on each
  of eight surfaces, which reads as defensiveness rather than candour.
- **Nothing there imports Recharts.** `distribution.tsx` was split: the token-only
  bars moved to `distribution-bars.tsx`, the plots stayed. Importing a labelled bar
  row used to ship a charting library with it, which two admin screens were paying
  for while rendering no chart at all. The landing page's one plot is hand-rolled SVG.

The page is ordered by the buyer's journey — discover, evaluate, verify, activate,
measure — not by the system's architecture, and no two of its eleven bands share a
composition. The Developer API lives on `/pricing`, beside the plan that grants it:
a terminal on a page written for a marketing director is an audience mismatch.

Capabilities that do not exist are not depicted. There is no natural-language query,
no ROI model and almost no audience-demographic data, so none of the three appear —
on a product whose entire pitch is that its numbers are checkable, a homepage
promising features it does not have is the most expensive possible lie.

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
| Persistence | PostgreSQL via `pg`, behind the same in-memory read model (D29) | `docker compose up -d` locally; Drizzle deferred until a second migration exists |
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
| `manager` (labelled *Admin*) | Platform org. The deputy seat: everything the analyst has, influencer CRUD and publishing, verification review, users, client orgs, connectors, ingestion, AI runs, audit, system health, read-only API keys and billing. **Not** scoring weights or billing changes — those stay with the one accountable seat |
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

- Depth is tonal: white cards on the green-grey canvas, with a whisper of shadow. No
  hairline under a shadow (D31).
- Compose with bands and splits before objects (D18). A screen that is a grid of
  identical bordered cards has no hierarchy, and adding a hierarchy afterwards by
  changing type sizes does not create one.
- The brand green is for intent — actions, active state, focus — and for measured
  growth. Never decoration.
- Colour on data means something: emerald = growth, amber = caution, rose = risk. A chart
  series that carries no meaning gets a neutral.
- Every numeric uses the display face with tabular figures (`.font-num`) so columns align.
- Density is compact by default. 8px table row padding. Whitespace separates groups, not
  rows.
- No gradient fills, no glassmorphism, no decorative charts. One feature card per screen.
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
