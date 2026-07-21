# DESIGN SYSTEM — Skills Coach

Extracted from the Sudoku app so both products speak **one** visual language.
The aesthetic is **"paper & ink" / journal**: warm paper backgrounds, dark ink
text, a single oxblood accent, hand-pressed "stamp" buttons with soft shadows,
serif display type. Do not introduce a second palette or a second UI framework.

Tokens live in `constants/theme.ts`. This document explains *how to use them*
and maps them onto the v1 component library.

---

## 1. Color

Import `JournalColors` directly in components (the Sudoku convention). Use
`useThemeColor` + `Colors` only for the two semantic slots that flip with
light/dark (`text`, `background`).

| Token | Hex | Use for |
|---|---|---|
| `paperBg` | `#F5F0E8` | screen background |
| `paperDark` | `#EDE6D6` | pressed / disabled surfaces, subtle fills |
| `white` | `#FDFAF3` | card & button surfaces (a warm off-white, never pure #fff) |
| `inkBlack` | `#1A1008` | primary text |
| `inkBrown` | `#3D2B1F` | secondary text, button labels |
| `inkFaint` | `#8B7355` | tertiary text, placeholders, disabled labels |
| `gridLine` | `#C4A882` | hairline dividers |
| `gridLineBold` | `#6B4C2A` | card & button borders |
| `accent` | `#8B1A1A` | the single accent — primary CTA, active states, meter fill |
| `selected` / `selectedBorder` | `#D4E8C2` / `#4A7C3F` | success / "on" toggle |
| `invalid` / `invalidBorder` | `#F5E6E0` / `#A0291E` | error surfaces |
| `buttonPrimary` | `#4A3728` | primary button fill (dark ink) |
| `buttonDanger` | `#8B1A1A` | destructive |
| `buttonDisabled` | `#C4A882` | disabled fill |
| `shadow` | `rgba(61,43,31,0.15)` | all elevation shadows |

**Rule:** one accent only (`accent`). Do not add a blue/purple/gradient — that
reads as generic AI UI and breaks the house style.

---

## 2. Typography

`Fonts` (from `constants/theme.ts`) is a `Platform.select` exposing `serif`,
`sans`, `rounded`, `mono`. **Serif is the display voice** (titles, skill names,
guide headings). Body copy uses the platform default.

Use the `ThemedText` `type` prop for the scale — do not hardcode font sizes:

| `type` | Size / weight | Use for |
|---|---|---|
| `title` | 32 / bold | screen titles, skill name on detail |
| `subtitle` | 20 / bold | section headers, guide H2 |
| `defaultSemiBold` | 16 / 600 | list-row titles, button labels, emphasis |
| `default` | 16 / regular, 24 line-height | body, guide prose, chat text |

For the guide reading experience, wrap serif around headings; keep body at
`default` for legibility.

---

## 3. Spacing, radius, elevation

Use the scales in `constants/theme.ts` — extracted from the Sudoku components,
not invented:

- **Spacing** `{ xs:4, sm:6, md:8, lg:16, xl:24 }`. Screen padding = `lg`.
  Inter-item gaps = `sm`/`md`.
- **Radius** `{ card:6, sheet:12, pill:999 }`. Cards/buttons = `card`. Bottom
  sheets (paywall) = `sheet`. Meter/toggle = `pill`.
- **Elevation.card** — the standard soft shadow (offset 1×2, opacity 0.3,
  radius 2, elevation 2). Reuse it; do not tune shadows per component.

---

## 4. Interaction

Buttons are **"stamp" buttons**: `white` fill, 1.5px `gridLineBold` border,
radius 6, `Elevation.card`, and a Reanimated press-scale (`withSequence(0.85 →
1)` over ~60/80ms). This is the single press feedback across the app. Reference
implementation: Sudoku's `NumberPad.tsx` `StampButton`.

> ⚠️ **Reanimated exit-flow safety (from AGENTS.md):** never gate flow
> progression on an `exiting` callback alone — reduced-motion users may never
> fire it. Always provide a timeout / non-animated fallback (relevant for the
> paywall sheet and onboarding transitions).

---

## 5. v1 component library

Each maps onto the tokens above. Build these in `components/ui/` before screens.

| Component | Build from |
|---|---|
| **Button** | stamp button; variants: primary (`buttonPrimary` fill, `white` label), secondary (`white` fill, ink label), danger (`buttonDanger`). Reuse the press-scale. |
| **Card** | `white` surface, 1.5px `gridLineBold` border, radius `card`, `Elevation.card`, padding `lg`. |
| **ListRow** | Card variant for the skills list: serif title (`defaultSemiBold`), one-line promise (`default`, `inkFaint`), price-tier pill on the right. |
| **TextInput** | `white` fill, `gridLine` border, `inkBlack` text, `inkFaint` placeholder; error state swaps border → `invalidBorder`, fill → `invalid`. |
| **ChatBubble** | user = `selected` fill / `selectedBorder`; coach = `white` card. Serif for the coach name label, `default` for body. |
| **UsageMeter** | pill track (`paperDark`), fill (`accent`), label `inkBrown`. Always visible — see BLUEPRINT. |
| **PaywallSheet** | bottom sheet, radius `sheet`, paper surface, primary Button CTA; reduced-motion-safe dismiss. |
| **EmptyState / Loading / Error** | centered serif line (`subtitle`, `inkFaint`) + optional Button. Error uses `invalid` surface. |

---

## 6. Porting checklist (when starting UI)

1. `constants/theme.ts`, `hooks/use-theme-color.ts`, `hooks/use-color-scheme.ts`,
   `components/themed-text.tsx`, `components/themed-view.tsx` — **already ported**.
2. Build `components/ui/*` from the table above; each file keeps its
   `StyleSheet.create` at the bottom (Sudoku convention).
3. Follow `AGENTS.md` conventions: required props by default, direct hook
   imports, `React.` namespace for types, no ESLint disables.
4. Screens go in `app/` (Expo Router); game logic has no analog — the analog is
   *server calls*, which live behind the API client (`docs/API_CONTRACT.md`),
   never in components.
