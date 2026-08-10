---
name: Beer Machine
description: SV ADA Drink Management System — dark glass point-of-sale
colors:
  night-black: "#101211"
  coal: "#222222"
  charcoal: "#343434"
  gunmetal: "#444947"
  accent-teal: "#055E68"
  teal-deep: "#044D56"
  forest-green: "#152C1F"
  bottle-green: "#2B6848"
  deep-green: "#327C55"
  signal-green: "#30A46C"
  mint-bright: "#63D196"
  mint-pale: "#B2F1CB"
  slate-soft: "#F8F9FA"
  slate-dim: "#6C757D"
  mist: "#B9D2D2"
  success-green: "#28A745"
  error-red: "#DC3545"
  signal-red: "#E5484D"
  warning-amber: "#F76B15"
  info-sky: "#00A2C7"
typography:
  display:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 600
    lineHeight: 1.25
  headline:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: 1.25
  title:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.25
  body:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.5
rounded:
  sm: "4px"
  md: "8px"
  lg: "12px"
  xl: "16px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  xxl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.deep-green}"
    textColor: "{colors.slate-soft}"
    rounded: "{rounded.md}"
    padding: "8px 24px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.signal-green}"
  button-secondary:
    backgroundColor: "{colors.gunmetal}"
    textColor: "{colors.slate-soft}"
    rounded: "{rounded.md}"
    padding: "8px 24px"
    height: "40px"
  button-danger:
    backgroundColor: "{colors.error-red}"
    textColor: "{colors.slate-soft}"
    rounded: "{rounded.md}"
    padding: "8px 24px"
    height: "40px"
  input-field:
    backgroundColor: "rgba(34, 34, 34, 0.5)"
    textColor: "{colors.slate-soft}"
    rounded: "{rounded.md}"
    padding: "16px 24px"
  card-glass:
    backgroundColor: "rgba(52, 52, 52, 0.5)"
    textColor: "{colors.slate-soft}"
    rounded: "{rounded.lg}"
    padding: "32px"
  nav-link-active:
    backgroundColor: "{colors.forest-green}"
    textColor: "{colors.slate-soft}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
---

# Design System: Beer Machine

## Overview

**Creative North Star: "The Bottle Glow"**

Beer Machine lives in a dark cellar bar lit by backlit bottles. The canvas is near-black — `#101211`, the color of a bar after closing — and the green-and-teal accent family enters as light: bleeding through frosted glass panels, edging every surface, glowing where it means something. The signature of the system is that its background is alive: three huge blurred orbs in the green scale drift slowly behind translucent panels, and a fine noise texture keeps the dark from ever going flat.

The mood is steady and warm: a serious tool with a late-night soul. The glass keeps it calm, the glow keeps it alive. Content sits in soft slate text on frosted surfaces; interactivity is signaled by green light. This is an Operate-first system — the sales terminal is used at a busy bar by volunteers — so hierarchy is quiet until the moment an action matters, and then the glow is unambiguous. Confirmed anti-references: no club-night neon, no sterile enterprise SaaS.

**Key Characteristics:**
- Dark glass panels floating over a living background (drifting blurred orbs + noise texture)
- A single accent family of beer-glass greens and teals on near-black
- Frosted and tactile: translucent surfaces, solid pressable controls
- Numbers move (CountUp stat animation); transactions, credits, and stock are the stars
- Green 1px edges on every surface, catching the backlight like a bottle rim

## Colors

A palette of beer-glass greens and teals glowing over near-black — light is the accent, dark is the canvas.

### Primary

- **Signal Green** (#30A46C): the brightest interactive green — hover states, success notifications, link hovers, badge accents. Used sparingly; its rarity is the signal.
- **Deep Green** (#327C55): the rest-state green — links, card hover borders, and the **primary action button fill** (at 80% opacity resting, full at hover, per the Buttons spec). One ruling: primary actions are always Deep Green.
- **Forest Green** (#152C1F): the "filled glass" green — embedded panel actions (e.g. Add Credits), table header, active nav pill. A dark fill, not a glow. Never the primary action.
- **Bottle Green** (#2B6848): the edge color — the 1px border that rims glass panels, table underlines, and dividers. The bottle rim catching the light.
- **Mint Bright** (#63D196): reserved for money — credit balances, prices, sale amounts. In the terminal, mint is currency.
- **Mint Pale** (#B2F1CB): card titles and the lightest green text accents.

### Secondary

- **Accent Teal** (#055E68): the heritage accent — hero gradient start, stat-card edges, focus ring (as `rgba(5, 94, 104, 0.2)`). A colder counterpoint to the greens.
- **Teal Deep** (#044D56): the hero gradient end; teal at its quietest.

### Neutral

- **Night Black** (#101211): the page background — black with a green undertone, never pure black.
- **Charcoal** (#343434): the base of every glass fill (`rgba(52, 52, 52, 0.5)`); opaque card fallback on legacy surfaces.
- **Coal** (#222222): input and field fills (`rgba(34, 34, 34, 0.5)`).
- **Gunmetal** (#444947): secondary buttons and quiet controls.
- **Slate Soft** (#F8F9FA): the primary text color — headings and strong content.
- **Slate Dim** (#6C757D): secondary text, placeholders, muted labels.
- **Mist** (#B9D2D2): inactive navigation links and quiet meta text.

### Status

- **Success Green** (#28A745): positive states.
- **Error Red** (#DC3545) and **Signal Red** (#E5484D): errors and destructive actions — Signal Red is the brighter hover/banner variant.
- **Warning Amber** (#F76B15): warnings, low-stock alerts.
- **Info Sky** (#00A2C7): informational notifications.

### Named Rules

**The Bottle-Glow Rule.** Accent color is light, not paint: greens and teals appear as glows, edges, and fills on glass — never as large solid walls of color on inner pages. The hero gradient on the landing page is the one sanctioned exception.

**The Night-Bar Rule.** The canvas stays near-black. Pure white is reserved for the brightest text emphasis and is never a background.

**The Mint-Is-Money Rule.** Credit figures — balances, prices, totals — use Mint Bright (#63D196). If a number represents credits, it is mint.

## Typography

**Display Font:** Inter (with system fallback — -apple-system, Segoe UI, Roboto)

**Character:** Engineering-clean sans. Inter is declared as the family but is not shipped as a webfont (index.html loads no font files), so the UI renders in the OS fallback — Segoe UI on Windows, SF Pro on macOS, Roboto on Android. Headings are a confident 600; body text is roomy at 1.6 line-height. The type is legible at bar distance: big titles, high contrast, subtle depth on headings.

### Hierarchy

- **Display** (600, 2.25rem, 1.25): page titles — "Dashboard", "Sales Terminal". Set in Slate Soft with a subtle text shadow (0 2px 4px rgba(0,0,0,0.2)).
- **Headline** (600, 1.875rem, 1.25): default h1; section-level statements.
- **Title** (600, 1.25rem, 1.25): card titles, panel headings. Card titles are Mint Pale — the only green text role.
- **Body** (400, 1rem, 1.6): paragraphs, descriptions, table cells. Slate Soft on glass.
- **Label** (500, 0.875rem, 1.5): form labels, meta text, timestamps, button text is 600 at 1rem.
- **Stat** (900, 2.5rem, 1): dashboard stat numbers — the heaviest weight in the system, reserved for CountUp figures.

### Named Rules

**The Read-Across-The-Room Rule.** Page titles are 600 weight at 2.25rem in Slate Soft with a 2px black text shadow — legible at bar distance without shouting.

## Layout

The app shell is a full-viewport column: sticky glass navigation on top, content in a centered container (max-width 1200px), footer below. Content sits at `z-index: 1` above the fixed orb layer; decorative orbs and the noise texture are `position: fixed`, `pointer-events: none`, and never intercept interaction.

- **Grids:** sales terminal is a 3-column workflow (customer → drinks → cart) collapsing to 1 column below 1024px; dashboards use 2-column grids collapsing to 1 at 768px; stat grids auto-fit with a 250px minimum.
- **Spacing rhythm:** a 4px base scale doubling up — xs 4px, sm 8px, md 16px, lg 24px, xl 32px, xxl 48px. Cards pad at xl (32px), collapsing to md (16px) on mobile.
- **Breakpoints:** 640px (sm), 768px (md), 1024px (lg), 1280px (xl). Navigation swaps to a mobile variant below 768px; buttons go full-width below 768px.
- **Density:** the terminal is the densest surface (list rows at lg padding); admin tables are roomy (lg cell padding).

## Elevation & Depth

Depth is **light plus shadow**, and the two always travel together. There are exactly two depth sources: cast shadows from the shadow scale, and transmitted light from the orbs behind translucent panels. A panel without its shadow, or a shadow without glass beneath it, reads wrong.

### Shadow Vocabulary

- **shadow-sm** (`0 1px 2px 0 rgba(0,0,0,0.05)`): hairline depth.
- **shadow-md** (`0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)`): resting elevation — nav bar, buttons.
- **shadow-lg** (`0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)`): hover lift — buttons raise on hover, notifications.
- **shadow-xl** (`0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)`): deepest utility shadow.
- **shadow-glass** (`0 8px 32px 0 rgba(0,0,0,0.37)`): the signature panel shadow — every glass card, table, and modal.

### The Orb Layer

Three blurred circles (600px, 500px, 350px; `blur(80px)`; opacity 0.55) in the green scale sit fixed behind everything, drifting on 18–26s eased loops. The noise texture (`feTurbulence` SVG, opacity 0.07) repeats over the whole canvas. These two are the system's heartbeat — surfaces stay translucent so the glow shows through.

### Named Rules

**The Never-Opaque Rule.** Surfaces are translucent glass (`rgba(52,52,52,0.5)` + `blur(10px)`, modals at 0.7 + `blur(16px)`) — the orb layer must always show through. Opaque fills are only allowed on legacy landing elements.

## Shapes

Softly rounded rectangles throughout; nothing sharp, nothing pill-shaped. Radius scale: sm 4px (chips, small controls), md 8px (buttons, inputs, nav pills), lg 12px (cards, tables), xl 16px (modals, hero). Every glass surface is rimmed with a 1px border — Bottle Green (#2B6848) on panels, translucent white (`rgba(255,255,255,0.18)`) inside panels — so the backlight catches an edge everywhere.

### Named Rules

**The Edge-Glow Rule.** Every glass surface carries a 1px green-tinted border. A panel with no visible edge is not part of the system.

## Components

### Buttons
- **Shape:** rounded corners (8px), min-height 40px, padding 8px 24px, gap 8px, 600-weight text. Solid, pressable, glassy — `backdrop-filter: blur(8px)` on the fill.
- **Primary:** Deep Green fill (at 80% opacity resting, full at hover) with a Bottle Green border; hover raises to Signal Green border + shadow-lg.
- **Secondary:** Gunmetal fill, quiet by design; hover lightens to #63706B.
- **Danger:** Error Red at 80% resting, Signal Red on hover with a −2px lift.
- **Sizes:** sm (min-height 32px) for table actions; lg (48px) for primary flows. Mobile: full-width, stacked.
- **Disabled:** opacity 0.6, `not-allowed`.

### Cards / Containers
- **Corner Style:** 12px radius.
- **Background:** Charcoal glass (`rgba(52,52,52,0.5)`), blur 10px.
- **Border:** 1px Bottle Green; header rule same color underneath the title.
- **Shadow:** shadow-glass, deepening to `0 12px 40px rgba(0,0,0,0.45)` on hover.
- **Internal Padding:** 32px (16px mobile).

### Inputs / Fields
- **Style:** Coal glass fill (`rgba(34,34,34,0.5)`), 1px translucent-white border, 8px radius, inset top shadow, padding 16px 24px.
- **Focus:** Bottle Green border, brighter fill, a teal glow ring (`0 0 0 3px rgba(5,94,104,0.2)`), and a 1px lift — the field rises to meet you.
- **Error:** Error Red border with red error text beneath.

### Tables
- **Container:** glass panel (light tint 0.3, blur 10px, 12px radius, shadow-glass).
- **Header:** Forest Green glass fill with a 2px Bottle Green underline; 600-weight Slate Soft text.
- **Rows:** roomy padding (24px), hairline translucent-white dividers, hover tint of teal (`rgba(5,94,104,0.15)`).

### Navigation
- **Style:** sticky glass bar (Charcoal at 0.4, blur 12px), 1px Bottle Green bottom edge, shadow-md.
- **Brand:** 700-weight at 1.25rem, Slate Soft.
- **Links:** 500-weight Mist text; on hover the text whitens and a 2px Forest Green underline sweeps to 80% width. The active link is a Forest Green pill with a Bottle Green border.
- **User section:** right side, separated by a Bottle Green divider; logout is a small button.

### Modals
- **Overlay:** black at 0.6, blur 4px, fade-in 0.2s.
- **Panel:** dark glass (0.7, blur 16px), Bottle Green border, 16px radius, shadow-glass, slide-up 0.3s. Max-width 500px, scrolls past 90vh.

### Notifications
- Toast top-right, 8px radius, shadow-lg, slide-in 0.3s. Success is Signal Green, error Signal Red, warning Amber, info Sky — the status family in its loudest form.

### Signature Component: The Stat Card
Dashboard figures — Total Sales, Revenue, Items Sold, Credits Added — sit in teal-edged cards with 900-weight numbers animated by CountUp (1s, direction-aware). The number is the loudest thing on the page; the CountUp motion is the only movement in the content layer.

## Do's and Don'ts

### Do:
- **Do** keep surfaces translucent — the orb layer must show through every panel.
- **Do** rim every glass surface with a 1px Bottle Green (#2B6848) or translucent-white border.
- **Do** use Signal Green (#30A46C) for interactive signals only (hover, success) — its rarity is the signal.
- **Do** set credit figures — balances, prices, totals — in Mint Bright (#63D196).
- **Do** use 600-weight titles at 2.25rem with the subtle text shadow for page heroes.
- **Do** pair every glass panel with its shadow-glass; shadows and glass travel together.

### Don't:
- **Don't** use bright accents as large flat fills — no solid teal or green walls on inner pages (the hero gradient is the one exception).
- **Don't** use pure white backgrounds or light mode; the night bar is the system.
- **Don't** introduce new hues — the world is greens and teals on near-black, status colors excepted.
- **Don't** let panels go edgeless or shadows appear without glass beneath.
- **Don't** animate anything in the content layer except CountUp numbers and state transitions; the orbs are the motion.
