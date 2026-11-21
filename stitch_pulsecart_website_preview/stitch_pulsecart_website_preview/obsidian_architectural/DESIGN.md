---
name: Obsidian Architectural
colors:
  surface: '#0f131c'
  surface-dim: '#0f131c'
  surface-bright: '#353943'
  surface-container-lowest: '#0a0e17'
  surface-container-low: '#181b25'
  surface-container: '#1c1f29'
  surface-container-high: '#262a34'
  surface-container-highest: '#31353f'
  on-surface: '#dfe2ef'
  on-surface-variant: '#c2c6d6'
  inverse-surface: '#dfe2ef'
  inverse-on-surface: '#2c303a'
  outline: '#8c909f'
  outline-variant: '#424754'
  surface-tint: '#adc6ff'
  primary: '#adc6ff'
  on-primary: '#002e6a'
  primary-container: '#4d8eff'
  on-primary-container: '#00285d'
  inverse-primary: '#005ac2'
  secondary: '#4edea3'
  on-secondary: '#003824'
  secondary-container: '#00a572'
  on-secondary-container: '#00311f'
  tertiary: '#c0c1ff'
  on-tertiary: '#1000a9'
  tertiary-container: '#8083ff'
  on-tertiary-container: '#0d0096'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#d8e2ff'
  primary-fixed-dim: '#adc6ff'
  on-primary-fixed: '#001a42'
  on-primary-fixed-variant: '#004395'
  secondary-fixed: '#6ffbbe'
  secondary-fixed-dim: '#4edea3'
  on-secondary-fixed: '#002113'
  on-secondary-fixed-variant: '#005236'
  tertiary-fixed: '#e1e0ff'
  tertiary-fixed-dim: '#c0c1ff'
  on-tertiary-fixed: '#07006c'
  on-tertiary-fixed-variant: '#2f2ebe'
  background: '#0f131c'
  on-background: '#dfe2ef'
  surface-variant: '#31353f'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 3.5rem
    fontWeight: '700'
    lineHeight: 4rem
    letterSpacing: -0.03em
  display-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 2.25rem
    fontWeight: '700'
    lineHeight: 2.75rem
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 2rem
    fontWeight: '600'
    lineHeight: 2.5rem
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 1.5rem
    fontWeight: '600'
    lineHeight: 2rem
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 1.25rem
    fontWeight: '600'
    lineHeight: 1.75rem
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 1.125rem
    fontWeight: '400'
    lineHeight: 1.75rem
    letterSpacing: -0.005em
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 0.9375rem
    fontWeight: '400'
    lineHeight: 1.5rem
    letterSpacing: '0'
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 0.8125rem
    fontWeight: '400'
    lineHeight: 1.25rem
    letterSpacing: 0.01em
  label-md:
    fontFamily: JetBrains Mono
    fontSize: 0.8125rem
    fontWeight: '500'
    lineHeight: 1.125rem
    letterSpacing: 0.04em
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 0.6875rem
    fontWeight: '500'
    lineHeight: 1rem
    letterSpacing: 0.06em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-mobile: 1rem
  margin: 3rem
  margin-mobile: 1.25rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system expresses high-precision technical commerce through architectural minimalism. Built for discerning buyers of engineered products, performance hardware, and technical apparel, the interface prioritizes mathematical clarity, visual hierarchy, and absolute structural discipline.

The visual tone merges the depth of dark structural carbon with the clinical rigor of blueprints. The interface removes decorative distractions, using hairline borders, sharp contrast, and typographic rhythm to frame products with museum-grade elevation. The emotional response is focused, cerebral, and authoritative—instilling total confidence in structural fidelity and precision engineering.

## Colors

The palette is anchored on deep carbon and obsidian structural foundations, elevated with crisp chalk typography and surgically restrained spectral indicators.

- **Canvas & Foundations**: Primary canvas utilizes deep carbon `#090d16`, with card layers and elevation stepping up through slate `#0d121f` to structural surface `#141b2d`.
- **Architectural Framing**: Grid separators, dividers, and component bounds rely on hairline slate rules `#1e293b` and prominent state boundaries `#26334d`.
- **Typography & Content**: Maximum legibility is achieved using chalk off-white `#f8fafc` for primary headlines, with technical labels and specifications rendered in muted slate `#94a3b8` and tertiary metadata in `#64748b`.
- **Functional Signals**: Color serves purely communicative functions. Technical cobalt (`#3b82f6`) signals focus, interactions, and primary cart actions. Emerald (`#10b981`) denotes real-time stock, telemetry, and confirmed transaction states. Warning and terminal states employ calibrated amber (`#f59e0b`) and carmine (`#ef4444`).

## Typography

The typographic stack pairs the geometric precision of Plus Jakarta Sans with the technical cadence of JetBrains Mono for inventory metrics, currency data, and structural dimensions.

- **Headlines & Editorial**: Plus Jakarta Sans delivers structural presence through tight tracking and balanced x-heights, ensuring large editorial statements feel modern and controlled rather than bombastic.
- **Body & Continuous Reading**: Standard content maintains open line ratios (1.5–1.6) with pure chalk `#f8fafc` or subdued `#94a3b8` values to eliminate eye fatigue against dark backdrops.
- **Technical & Metric Metadata**: All SKU numbers, currency indicators, stock counters, dimensions, and transactional details are strictly set in JetBrains Mono. Always apply uppercase transformation to `label-sm` for structural markers and status pills.

## Layout & Spacing

Layouts follow a modular, grid-aligned architectural framework built on strict multiples of 4px and 8px.

- **Desktop (12 Columns)**: Max canvas width of 1440px with a 12-column grid, 1.5rem gutters, and 3rem outer margins. Cards snap cleanly into 3, 4, 6, or 12-column modules.
- **Tablet (8 Columns)**: Adapts at 1024px to an 8-column layout with 1.25rem gutters and 2rem margins.
- **Mobile (4 Columns)**: Drops at 640px to a 4-column viewport. Gutters compress to 1rem with 1.25rem outer margins.
- **Horizontal & Vertical Hairlines**: Content groups are separated by physical 1px hairline rules (`#1e293b`), creating structural bays rather than floating cards. Vertical gutters can be accented by hairline dividers for technical catalog layouts.

## Elevation & Depth

This design system avoids soft, blurred, or skeuomorphic dropshadows. Depth is articulated exclusively through tonal layering, crisp borders, and subtle luminous halos.

- **Base Tiers**:
  - `Level 0 (Canvas)`: Base background `#090d16`.
  - `Level 1 (Surface)`: Structural panels and grid cells `#0d121f` bounded by `#1e293b` hairlines.
  - `Level 2 (Active / Raised)`: Hovered modules and interactive overlays `#141b2d` bounded by `#26334d`.
  - `Level 3 (Modal / Flyout Cart)`: Elevated commerce panels `#0d121f` with a 1px border of `#3b82f6` at 40% opacity and an ambient outer bloom: `0 0 40px -10px rgba(15, 23, 42, 0.8)`.
- **Architectural Rules**: Depth is perceived as physical layering of thin sheets of dark metal or treated glass. Backdrop filters are utilized conservatively on floating navigation bars (`backdrop-filter: blur(12px)` over `rgba(9, 13, 22, 0.85)`).

## Shapes

The geometry is disciplined, near-orthogonal, and architectural. The default corner treatment is `0.25rem` (Soft), preserving structural crispness without severe raw edges.

- **Buttons, Inputs, and Badges**: Formed with standard `0.25rem` corners.
- **Cards, Drawers, and Dialogs**: Use `rounded-lg` (`0.5rem`) to maintain precision at macro scale.
- **Pill Exceptions**: Reserved exclusively for dynamic status pings (e.g., live stock indicators) and telemetry chips, using fully circular radii to visually contrast with architectural framing.

## Components

### Buttons
- **Primary (Checkout / Add to Cart)**: Surface `#3b82f6` with text `#ffffff`, height 44px, font `Plus Jakarta Sans` 600 weight, radius `0.25rem`. Hover shifts to `#2563eb` with an instant 150ms ease. Active state depresses 1px visually.
- **Secondary / Ghost**: Background transparent, border 1px solid `#1e293b`, text `#f8fafc`. Hover triggers background `#141b2d` and border `#26334d`.
- **Architectural Icon Buttons**: 40x40px square, centered monochrome SVG icon `#94a3b8`, border 1px solid `#1e293b`.

### Product Cards
- Built as enclosed grid units. Background `#0d121f` surrounded by a 1px solid `#1e293b` rule.
- Product imagery sits on an inner `#090d16` inset background with zero border radius.
- Metadata block contains title in `headline-md`, price in JetBrains Mono `body-md` (`#f8fafc`), and category in `label-sm` (`#64748b`).
- Hover state updates outer border to `#26334d` without changing element dimensions.

### Chips & Badges
- **Status Badges (Stock / Availability)**: JetBrains Mono `label-sm`, padding `0.25rem 0.5rem`, border 1px solid. "In Stock" utilizes emerald `#10b981` at 10% fill with `#10b981` border and text. "Low Inventory" switches to amber `#f59e0b`.
- **Filter Chips**: Dark carbon fill `#0d121f`, border 1px solid `#1e293b`, text `#94a3b8`. Selected state applies border `#3b82f6` and text `#f8fafc`.

### Form Fields & Inputs
- Height 44px, background `#090d16`, border 1px solid `#1e293b`, text `#f8fafc`, placeholder `#475569`.
- Focus state: Border transitions to `#3b82f6` with a hairline 1px box-shadow `0 0 0 1px #3b82f6`. No fuzzy multi-pixel rings.
- Numerical inputs (quantity, price bounds) utilize monospaced glyphs.

### Lists & Tables
- Data cells separated by 1px horizontal borders `#1e293b`.
- Column titles in JetBrains Mono `label-sm` uppercase `#64748b`.
- Hover on list rows shifts background to `#0d121f` across the full row span.

### Slide-Over Cart Drawer
- Docked right, width 440px on desktop, 100% on mobile.
- Background `#0d121f` with a left 1px hairline border `#26334d`.
- Cart summary, shipping calculations, and SKU specs rendered in strict table rows using monospaced figures aligned flush right.