---
name: SocialOrbit
description: An instrument that publishes measurements — graphite housing, warm paper, one cobalt accent, brass reserved for what was measured.
colors:
  canvas: "#f6f4f1"
  surface: "#ffffff"
  sunken: "#f0ede8"
  sunken-strong: "#e4e0d9"
  line: "#e2ded7"
  line-strong: "#c8c3ba"
  rule: "#edeae5"
  ink: "#17171a"
  ink-muted: "#4d4e57"
  ink-subtle: "#63646d"
  ink-inverse: "#f7f6f4"
  instrument: "#17181c"
  instrument-deep: "#101115"
  instrument-raised: "#23252c"
  instrument-line: "#2c2f37"
  instrument-line-strong: "#3a3d47"
  instrument-ink: "#f4f4f6"
  instrument-muted: "#9a9daa"
  instrument-subtle: "#71747f"
  brand: "#2743d4"
  brand-active: "#1a2f9e"
  brand-soft: "#e8ecfc"
  brand-line: "#c3ccf5"
  brand-lift: "#8fa4ff"
  brass: "#a97a25"
  brass-lift: "#e0b165"
  positive: "#0f6f52"
  caution: "#9c5606"
  critical: "#b0233a"
  inferred: "#6435c8"
  series-1: "#2743d4"
  series-2: "#c25c10"
  series-3: "#0d7570"
typography:
  display:
    fontFamily: "Space Grotesk, ui-sans-serif, sans-serif"
    fontSize: "clamp(2.25rem, 1.4rem + 3.6vw, 4.25rem)"
    fontWeight: 700
    lineHeight: 1.04
    letterSpacing: "-0.028em"
  title:
    fontFamily: "Space Grotesk, ui-sans-serif, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: "2.125rem"
    letterSpacing: "-0.018em"
  body:
    fontFamily: "Instrument Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: "1.375rem"
    letterSpacing: "normal"
  numeric:
    fontFamily: "Space Grotesk, ui-monospace, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 500
    lineHeight: "2.125rem"
    letterSpacing: "-0.015em"
  label-caps:
    fontFamily: "Instrument Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 650
    lineHeight: "1rem"
    letterSpacing: "0.075em"
rounded:
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "14px"
  "2xl": "18px"
spacing:
  sidebar: "248px"
  sidebar-rail: "68px"
  topbar: "56px"
  measure: "68ch"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.ink-inverse}"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "0 14px"
  button-primary-hover:
    backgroundColor: "{colors.instrument-raised}"
  button-accent:
    backgroundColor: "{colors.brand}"
    textColor: "#ffffff"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "0 14px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    height: "36px"
    padding: "0 14px"
  panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.xl}"
    padding: "16px"
  instrument-band:
    backgroundColor: "{colors.instrument}"
    textColor: "{colors.instrument-ink}"
    padding: "28px 24px"
  nav-item-active:
    backgroundColor: "{colors.instrument-raised}"
    textColor: "{colors.instrument-ink}"
    rounded: "{rounded.md}"
    padding: "8px 10px"
  badge:
    backgroundColor: "{colors.sunken}"
    textColor: "{colors.ink-muted}"
    rounded: "9999px"
    padding: "2px 8px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    height: "36px"
    padding: "0 12px"
---

# Design System: SocialOrbit

## Overview

SocialOrbit is an instrument for deciding whether a number can be trusted before money
is spent on it. The design has one thesis and everything follows from it:

> **The chrome is the instrument. The work is printed on paper set inside it.**

The rail, the topbar, the marketing hero and the marketing footer are one continuous
graphite housing. The workspace inside them is warm paper, and white is reserved for the
panels where measurement actually happens. Before this, the housing existed on exactly
one card — the score readout — while everything else was grey-on-grey admin chrome, so
the product's strongest idea was quarantined inside a component. Now the frame states
the identity on every route, and the paper reads brighter for sitting in a dark bezel.

Aesthetic position: **a Bloomberg terminal built by a Swiss watchmaker.** Dense and
legible like a trading surface; engraved, restrained and unhurried like a certificate.
It is not a consumer dashboard and it is not a brochure.

Three rules decide almost every open question:

1. **Scarcity is the accent's meaning.** Cobalt marks intent — interaction, active
   state, focus, verified provenance. Brass marks measurement — the dial, its ticks, the
   verification seal — and appears nowhere else, so a gold mark always means "this was
   read, not asserted".
2. **Absence is drawn, never filled.** A component nobody could measure gets a hatched
   track, not an empty bar; a risk with no signal reads `unknown`, not `low`; a chart
   without history renders a building-history state. Manufacturing a figure to avoid an
   empty state is the one unrecoverable failure in this product.
3. **Composition before ornament.** Bands and splits before objects. A screen that is a
   grid of identical bordered cards has no hierarchy, and no amount of type-size
   adjustment adds one afterwards.

## Colors

**The housing.** `instrument` #17181c is the rail, topbar, mobile drawer, marketing hero
and footer, and the score readout. `instrument-raised` #23252c is the only lifted surface
inside it — the active nav item, the org block, the search trigger. Elevation on graphite
is *light*, not shadow: a raised surface takes `inset 0 1px 0 rgb(255 255 255 / 0.07)`,
the way a machined panel catches a highlight. A shadow on near-black is invisible and a
border on near-black reads as a crack.

**The paper.** `canvas` #f6f4f1 is the page ground — warm, never pure white and never
cool grey. `surface` #ffffff is a panel holding analysis. `sunken` #f0ede8 is apparatus:
footers, filter rails, disabled fields. A screen reads correctly when the white areas
are exactly the places measurement is happening.

**Text.** Three steps, all measured against all three light grounds: `ink` #17171a
(16.4:1 worst case), `ink-muted` #4d4e57 (7.4:1), `ink-subtle` #63646d (5.3:1). On
graphite: `instrument-ink`, `instrument-muted` (6.6:1) for anything that must be read,
and `instrument-subtle` only for decorative or duplicated text — it does not clear 4.5:1.

**Accent.** `brand` #2743d4 on paper, `brand-lift` #8fa4ff on graphite — deep cobalt does
not clear contrast against near-black, so the chrome gets its own step rather than a
lower-contrast compromise. Primary buttons are **ink, not cobalt**: a blue primary button
on a blue-accented product spends the accent on every screen until it means nothing. The
one cobalt button in the product is the marketing call to action.

**Brass.** #a97a25 on paper, #e0b165 on graphite. Dial ticks and the verification seal
only. Never a control, never a link, never a fill.

**Measurement colour.** Emerald = growth, amber = caution, rose = risk, violet =
AI-inferred. These apply to data and never to chrome. The three chart series are disjoint
from all of them so a series is never mistaken for a warning; three overlaid series is the
ceiling, and comparison renders side by side rather than adding a fourth.

## Typography

Two voices with non-overlapping jobs, and the split is the point.

**Space Grotesk** — every heading and **every numeral**. It descends from Space Mono, so
its digits are uniform width by construction: a metric column aligns without a companion
monospace and without a feature flag, and its engineered figures make a score read as a
reading rather than as a label. Weights 500/600/700 only.

**Instrument Sans** — interface text, where the job is to disappear. A humanist grotesque
that holds at 11px in a dense table and never competes with the display voice. Weights
400/500/600/700.

The interface ramp is fixed — a dashboard must not reflow its type as the window moves —
and runs `text-2xs` 11px through `text-title-lg` 36px, with 14px body set on `body` and
carrying no token. Only the two marketing display sizes are fluid `clamp()`, because a
landing page is read at every width there is.

Metrics have their own ramp above the text ramp: `text-metric` 30px, `text-metric-lg`
44px, `text-hero` clamped 56–80px. A figure and a heading at the same pixel size do not
carry the same weight — a number is read as a quantity first and glyphs second, so it can
go larger before it starts shouting.

Caps appear in exactly one recipe: `.label-caps` / `.label-caps-sm`, in the interface
voice, with tracking that keeps a geometric face from colliding at 10px. Body measure is
capped at 68ch by the `.measure` utility.

## Layout

Rail 248px, collapsing to a 68px icon rail (remembered per user), becoming a graphite
drawer below `lg`. Topbar 56px, sticky, graphite, and carrying only what every route
shares — the command palette, remaining search allowance, help, notifications. Identity
and account live in the rail, which is what frees the topbar from being a second row of
chrome.

Page structure, in increasing weight:

- `PageHeader` — sits directly on the canvas, no slab. Breadcrumb, title in the display
  voice, optional lead figure in the numeric voice, description at `measure`.
- `Instrument` — the graphite band carrying the screen's single headline reading. **At
  most one per screen**; two and neither is the headline.
- `Section` / `PageBand` — a full-bleed white band separated by a rule. Structure without
  a box, and the default for most groupings.
- `Split` — two or three columns sharing one hairline instead of a gutter between cards.
- `Panel` — a genuine object: a chart, a queue, a dossier block.

Inside any container, rows and columns separate with `rule` #edeae5, which is lighter than
the container's own edge: structure inside a container must never compete with the
container.

Responsive means a different hierarchy, not a shrunk desktop. Tables become cards or gain
their own horizontal scroll container — the page body never scrolls sideways. Filters
become a sheet. The rail becomes a drawer that is the rail, in the same material.

## Elevation & Depth

**Declared once per element: a border or a shadow, never both.** A 1px border under a wide
soft shadow is the ghost card. The shadow tokens therefore carry their own hairline as
their first layer, so an overlay stays defined against white without a second declaration.

- `raised` — a hair off the page. Table chips, small controls.
- `lifted` — hover state for a clickable card.
- `popover` / `overlay` — things that genuinely float: menus, dialogs, sheets.
- `instrument` — the score readout, floated off the canvas.
- `chrome-raised` — the inset top highlight that lifts a surface *inside* the graphite.

Rows tint on hover. Clickable cards lift 2px. Static cards do not move at all.

## Shapes

Radius rises with the size of the thing: 4px micro-tag, 6px input and small button, 8px
button and nav item, 10px tile, 14px panel, 18px instrument housing and overlay. One
radius everywhere is the tell of a system that picked a number instead of making a
decision; a panel that curves more than the chip inside it reads as an object holding
contents. Pills (`rounded-full`) are for small controls only — badges, filter chips,
progress tracks, dots.

The recurring geometric device is the **orbit**: the arc the mark is built from, drawn at
page scale behind the marketing hero and the sign-in panel, and drawn as graduations
around the score dial. It is geometry the session can specify exactly — never an
illustration, never a texture.

## Components

**Score dial** (`ScoreRing`). The product's signature artifact. A brass tick ring engraved
around a cobalt arc, the value set in the numeric voice at 33% of the dial's diameter, the
unit below in caps. The arc sweeps from empty once on mount and never again; under
reduced motion the inline dash offset is what renders, so the value is never lost. The
tick ring is suppressed below 80px, where it would collapse into a grey smudge.

**Instrument band** (`Instrument`). Full-bleed graphite carrying the screen's one headline
reading — the roster's median health, a campaign's performance score. Top edge lit by a
hairline of white at 8%.

**Metric strip** (`MetricStrip` / `Metric`). One continuous strip divided by rules, never
a tray of separate tiles. The strip must divide evenly: `React.Children.toArray` is what
counts its cells, because `Children.count` counts the `false` a conditional child leaves
behind and silently picks the wrong column count.

**Score bar** (`ScoreBar`). A measured zero gets a visible sliver; an unmeasured component
gets a hatched track. Empty reads as "a bar that failed to render"; hatched reads as
"there is nothing to draw here", and those mean opposite things.

**Provenance** (`TrackedValue`). A figure with a dotted rule under it; clicking opens a
panel naming the method, source tier, collection time, derivation formula, model and
prompt version where AI was involved, and field confidence. A click-through, not a
tooltip: a tooltip cannot be reached on touch, cannot be read at leisure and cannot hold
a source link.

**Buttons.** Ink primary, cobalt accent (marketing only), outlined secondary, ghost,
rose danger, link. Heights 32/36/44. `loading` shows a spinner, disables the control and
holds its width.

**Table.** A real `<table>`, 12px horizontal and 10px vertical cell padding, caps headers,
rules between rows, hover tint, `brand-softer` for the selected row. The wrapper is the
horizontal scroll container and is keyboard focusable.

**Reveal** (`Reveal`). One entrance recipe for the whole marketing site: rise 14px, unblur
6px, settle over 700ms on an exponential ease-out, once. Built on IntersectionObserver
plus one CSS class — a scroll-animation library would be the largest thing on a page whose
argument is that the product is measured rather than decorated. Scroll itself is left
alone for the same reason.

## Do's and Don'ts

**Do**

- Put the screen's one headline reading on the instrument band, and let everything else
  be quiet.
- Set every figure in the numeric voice, including chart axis labels.
- Show the range a number was drawn from, not just the number.
- Render absence explicitly: hatched tracks, `unknown` bands, building-history states,
  withheld percentiles below a cohort of eight.
- Theme the browser's own surfaces — selection, caret, scrollbars, focus rings,
  underline offset. It is the cheapest signal that a page was built rather than assembled.
- Give every screen its loading, empty, error and partial-data states.

**Don't**

- Don't put a caps kicker above a heading. Wayfinding belongs in the breadcrumb; the
  heading carries its own weight.
- Don't spend cobalt on a large fill, a decorative surface, or an ordinary toolbar button.
- Don't put brass on anything that is not a measurement.
- Don't nest cards, and don't use a row of same-size icon-heading-text cards as a page
  structure.
- Don't declare a border and a shadow on the same element.
- Don't add a second instrument band to a screen.
- Don't animate more than one authored moment per screen, and never re-animate a reveal
  on the way back up.
- Don't use a gradient for text, glass as decoration, a coloured `border-left` above 1px,
  or a `feTurbulence` grain overlay.
- Don't show a period-over-period delta on an org-level figure. The database holds four
  snapshot days for 627 of 631 creators; manufacturing a comparison on the dashboard of a
  provenance product is the most self-defeating thing this codebase could do.
