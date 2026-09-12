---
name: premium-ui-system
description: Design system and process for building premium, world-class mobile/web UI in React artifacts and HTML. Use when building app prototypes, product screens, interactive demos, or any UI that should feel designed rather than generated. Applies specific typography, color philosophy, spacing tokens, and micro-interaction patterns that consistently produce high-end output. Pairs well with frontend-design and design-theme-generation skills.
---

# Premium UI System

A reusable design system and decision framework for producing high-end UI that looks intentionally designed, not AI-generated. This skill codifies the exact tokens, patterns, and process behind premium app interfaces.

## When to Use

**Always use when:**
- Building app prototypes or product screens
- Creating interactive demos or walkthroughs
- User wants something that "looks professional" or "doesn't look like AI"
- Building consumer-facing mobile UI (health, wellness, fintech, social)
- Dark mode or light mode app interfaces

**Pair with:**
- `frontend-design` for general aesthetic philosophy
- `design-theme-generation` when user has moodboard/references
- `flow-state-ux` when designing daily-use habit apps

**Skip when:**
- Quick wireframe or throwaway prototype explicitly requested
- Internal admin tools where aesthetics don't matter
- User provides their own complete design system

---

## Process: Design Before Code

**Never start coding until you've made these 3 decisions:**

### 1. Aesthetic Position (one sentence)
Write: "This should feel like [Brand A] meets [Brand B]."

Examples:
- Health/wellness app: "Headspace meets a high-end vet clinic"
- Fintech: "Linear meets a Swiss private bank"
- Creative tool: "Notion meets an architecture studio"
- Social: "Arc browser meets a photography gallery"

This single sentence eliminates 90% of bad decisions downstream.

### 2. Typography Pairing
Pick ONE serif/display + ONE sans-serif. Never use the defaults.

**Proven pairings (Google Fonts, free):**

| Mood | Display (headers) | Body (text) | Feels like |
|------|-------------------|-------------|------------|
| Warm premium | Instrument Serif | Plus Jakarta Sans | Aesop, Headspace |
| Editorial authority | Fraunces | Outfit | NYT, Monocle |
| Modern elegance | Playfair Display | DM Sans | Luxury brand |
| Technical craft | Space Mono | General Sans | Linear, terminal |
| Friendly premium | Recoleta | Satoshi | Calm, Figma |
| Sharp minimalism | Syne | Switzer | Architecture studio |

**Hard anti-patterns -- NEVER use these for premium work:**
- Inter, Roboto, Arial, system-ui alone
- Open Sans, Lato, Montserrat (overused, invisible)
- Any single font for both display and body

**How to load in React artifacts:**
```html
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
```

**CSS variables:**
```css
:root {
  --serif: 'Instrument Serif', Georgia, serif;
  --sans: 'Plus Jakarta Sans', system-ui, sans-serif;
}
```

### 3. Color Constraint
Pick ONE accent color. Everything else is shades of your background.

---

## Design Tokens

### Color System

**Dark mode palette (default for premium apps):**
```
Background:        #0a0a0a
Surface:           rgba(255, 255, 255, 0.04)
Surface hover:     rgba(255, 255, 255, 0.06)
Border:            rgba(255, 255, 255, 0.06)
Border active:     rgba(255, 255, 255, 0.10)
Text primary:      #ffffff
Text secondary:    rgba(255, 255, 255, 0.65)
Text tertiary:     rgba(255, 255, 255, 0.4)
Text quaternary:   rgba(255, 255, 255, 0.25)
Text muted:        rgba(255, 255, 255, 0.15)
Label/overline:    rgba(255, 255, 255, 0.2), letter-spacing: 1.5-2px
```

**Light mode palette (for secondary/reference screens):**
```
Background:        #faf7f1  (warm cream, NOT pure white)
Surface:           #ffffff
Border:            #e8e1d6
Text primary:      #1a1a1a
Text secondary:    #444444
Text tertiary:     #999999
Text muted:        #bbbbbb
```

**Accent colors (pick ONE as primary):**
```
Green (health/success):   #5cb87a   shadow: rgba(92, 184, 122, 0.25)
Amber (warning/attention): #e0a84a  shadow: rgba(224, 168, 74, 0.25)
Red (danger/urgent):      #d45a4a   shadow: rgba(212, 90, 74, 0.25)
Blue (calm/info):         #5a8fd4   shadow: rgba(90, 143, 212, 0.25)
```

**Using accent at different intensities:**
```
Full:       #5cb87a                       (CTAs, active states)
Muted:      rgba(92, 184, 122, 0.4)      (completed indicators)
Background: rgba(92, 184, 122, 0.12)     (badges, tags)
Surface:    rgba(92, 184, 122, 0.06)     (success cards, celebration)
Border:     rgba(92, 184, 122, 0.1)      (active card borders)
Glow:       0 8px 28px rgba(92,184,122,0.25)  (CTA shadow)
```

### Spacing Scale
```
4px   -- micro gaps (icon-to-text inline)
8px   -- tight gaps (list items, related elements)
10px  -- small gaps (card internal sections)
12px  -- default element gap
14px  -- comfortable card gap
16px  -- section padding (internal)
20px  -- generous padding
22px  -- page horizontal padding
24px  -- section vertical padding
28px  -- large section breaks
32px  -- major section breaks
36px  -- page top padding (with status bar)
48px  -- hero spacing
```

### Border Radius Scale
```
5-6px   -- small badges, tags, inline pills
8px     -- buttons (secondary), small inputs
10px    -- progress bars, inline cards
12px    -- icon containers, week badges
14px    -- medium cards, action items
16px    -- buttons (primary, CTA)
18px    -- content cards, lesson cards
20px    -- large cards, phase cards
24px    -- hero cards, action card stack
32px    -- rounded section headers, bottom sheets
```

**Rule of thumb:** Larger elements get larger radius. CTAs: 16px. Cards: 18-24px. Never use the same radius for everything.

### Typography Scale
```
Display/hero:    28-30px  weight: 400  font: var(--serif)  line-height: 1.2
Card title:      22-24px  weight: 400  font: var(--serif)  line-height: 1.3
Section title:   16px     weight: 600  font: var(--sans)   line-height: 1.4
Body:            14-15px  weight: 400  font: var(--sans)   line-height: 1.65
Small body:      13px     weight: 400  font: var(--sans)   line-height: 1.5
Caption:         12px     weight: 400  font: var(--sans)   line-height: 1.4
Overline/label:  10-11px  weight: 600-700  font: var(--sans) letter-spacing: 1.5-2px
Score/number:    32-36px  weight: 800  font: var(--serif)  line-height: 1
```

**Key insight:** Serif at weight 400 for display text creates warmth without heaviness. Sans-serif at 600-700 for functional text. Never use serif for body text.

---

## Patterns

### Noise Texture Overlay
Adds organic, physical depth to flat dark backgrounds. Use on hero sections, headers, gradient areas.

```jsx
<div style={{ position: "absolute", inset: 0, opacity: 0.035,
  background: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")"
}} />
```

### Time-Contextual Gradients
For daily-use apps, change the header gradient based on time of day:

```
Morning:  linear-gradient(155deg, #1b3022 0%, #2a4d33 45%, #1b3022 100%)  -- forest green
Midday:   linear-gradient(155deg, #2d1f0e 0%, #4a3520 45%, #2d1f0e 100%)  -- warm brown
Evening:  linear-gradient(155deg, #0f1528 0%, #1a2540 45%, #0f1528 100%)  -- deep blue
```

### Score Ring Component
Animated circular progress. Use for health scores, completion percentages, any single metric.

```jsx
function ScoreRing({ value, size = 140, stroke = 8 }) {
  const r = (size - stroke * 2) / 2;
  const circ = 2 * Math.PI * r;
  const offset = ((100 - value) / 100) * circ;
  const color = value >= 80 ? "#5cb87a" : value >= 60 ? "#e0a84a" : "#d45a4a";
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none"
          stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} />
        <circle cx={size/2} cy={size/2} r={r} fill="none"
          stroke={color} strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 2s cubic-bezier(0.22, 1, 0.36, 1)" }} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex",
        flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: size * 0.32, fontWeight: 800, color: "#fff",
          fontFamily: "var(--serif)", lineHeight: 1 }}>{value}</span>
        <span style={{ fontSize: size * 0.08, color: "rgba(255,255,255,0.35)",
          letterSpacing: "1px", marginTop: 3, fontWeight: 600 }}>OUT OF 100</span>
      </div>
    </div>
  );
}
```

### Card Stack (one-at-a-time actions)
For daily-use apps. Show ONE action card at a time instead of flat checklists. Includes progress dots and flip-to-explain interaction.

**Progress dots pattern:**
```jsx
{actions.map(a => (
  <div key={a.id} style={{
    width: a.id === current.id ? 22 : 7,
    height: 7, borderRadius: 4,
    background: done[a.id] ? "#5cb87a"
      : a.id === current.id ? "rgba(255,255,255,0.8)"
      : "rgba(255,255,255,0.1)",
    transition: "all 0.3s ease",
  }} />
))}
```

### CTA Button
```jsx
<button style={{
  width: "100%", padding: "17px", borderRadius: 16,
  border: "none", background: "#5cb87a",
  color: "#fff", fontSize: 16, fontWeight: 600,
  fontFamily: "var(--sans)", cursor: "pointer",
  boxShadow: "0 8px 28px rgba(92,184,122,0.25)",
}}>Label</button>
```

### Expandable Accordion Card (light mode)
```jsx
<div style={{
  background: "#fff", borderRadius: 18, overflow: "hidden",
  border: "1px solid #e8e1d6",
  boxShadow: isOpen ? "0 8px 30px rgba(0,0,0,0.05)" : "none",
}}>
  {/* header: clickable, icon + title + chevron */}
  {/* body: shown when open, with "do this now" callout */}
</div>
```

### "Do This Now" Callout
```jsx
<div style={{
  background: "#faf6ef", borderRadius: 14,
  padding: "16px 18px", borderLeft: "3px solid #d4940a",
}}>
  <p style={{ fontSize: 13, color: "#8a6d2f" }}>
    <strong style={{ color: "#6b5420" }}>Do this now:</strong> {action}
  </p>
</div>
```

### Bottom Navigation
```jsx
<div style={{
  position: "fixed", bottom: 0, left: "50%",
  transform: "translateX(-50%)",
  width: "100%", maxWidth: 430, zIndex: 100,
  background: "rgba(10,10,10,0.92)",
  backdropFilter: "blur(24px)",
  padding: "10px 0 30px",
  borderTop: "1px solid rgba(255,255,255,0.04)",
  display: "flex", justifyContent: "space-around",
}}>
```

### Trust/Credibility Footer
```jsx
<p style={{
  textAlign: "center", fontSize: 12,
  color: "rgba(255,255,255,0.2)", marginTop: 12,
}}>Built with experienced [domain] experts & [specialists]</p>
```

---

## Anti-Patterns (NEVER do these)

### Visual
- Pure white (#fff) as page background -- use #faf7f1 or similar warm tone
- Purple-to-blue gradients (screams "AI generated")
- More than 2 accent colors on one screen
- Box shadows on dark mode (use border + background opacity instead)
- Equal border-radius everywhere (vary by element importance)
- Emojis as primary icons in production (fine for prototypes)

### Typography
- Inter, Roboto, system-ui as the only font
- Bold everything (reserve bold for hierarchy, not emphasis)
- Serif for body text (only for display/headlines)
- ALL CAPS for anything longer than 3 words
- Font sizes below 11px or above 36px in mobile

### Layout
- Flat checklists for daily actions (use card stack)
- Equal-weight tabs (prioritize one screen as "home")
- Showing everything at once (progressive disclosure)
- Horizontal scrolling carousels for primary content
- More than 3-4 bottom nav items

### Behavioral
- Gamification language ("streak", "level up!") for serious products
- Generic celebration ("Great job!") instead of contextual ("Coco's taken care of")
- Guilt-inducing patterns (red missed days, lost streaks)
- Data dumps on first screen (save depth for "learn" screens)

---

## Boilerplate

### React Artifact Starter
```jsx
export default function App() {
  return (
    <div style={{ maxWidth: 430, margin: "0 auto" }}>
      <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap" rel="stylesheet" />
      <style>{`
        :root {
          --serif: 'Instrument Serif', Georgia, serif;
          --sans: 'Plus Jakarta Sans', system-ui, sans-serif;
        }
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; margin: 0; }
        body { font-family: var(--sans); }
        ::-webkit-scrollbar { display: none; }
      `}</style>

      {/* Your screens here */}
    </div>
  );
}
```

### Adapting to Different Products

The tokens above default to "warm premium" (health/wellness). To adapt:

**For fintech/serious:**
- Swap Instrument Serif -> Space Grotesk or Syne
- Swap Plus Jakarta Sans -> General Sans or Switzer
- Use #fafafa instead of #faf7f1 for light mode (cooler)
- Accent: blue (#5a8fd4) or teal (#4a9e8e)

**For creative/playful:**
- Swap Instrument Serif -> Recoleta or Fraunces
- Keep Plus Jakarta Sans or use Outfit
- Use warmer backgrounds, more saturated accents
- Larger border-radius (24-32px)

**For editorial/authority:**
- Swap Instrument Serif -> Playfair Display
- Swap Plus Jakarta Sans -> DM Sans
- More restrained spacing, tighter line-heights
- Minimal color, rely on typography hierarchy

---

## Decision Checklist

Before shipping any screen, verify:

- [ ] One aesthetic position sentence defined
- [ ] Exactly 2 fonts loaded (1 display, 1 body)
- [ ] Single accent color with 5 intensity levels
- [ ] No pure white backgrounds
- [ ] No Inter/Roboto/Arial
- [ ] Border radius varies by element size
- [ ] Noise texture on dark gradient areas
- [ ] Labels use overline style (small, spaced, uppercase, muted)
- [ ] Primary CTA has colored box-shadow
- [ ] Progressive disclosure (not everything visible at once)
- [ ] Mobile-first (max-width: 430px)
- [ ] Bottom nav has backdrop-filter blur
- [ ] Trust signal visible somewhere on screen
