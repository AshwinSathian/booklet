# Booklet — Brand Reference

> The canonical source of truth for Booklet's brand identity. Paste this document into
> Claude before generating any branding materials, marketing copy, social posts, ad creative,
> email campaigns, design briefs, or UI copy decisions.

---

## Positioning (locked July 2026)

Booklet does not compete on "fastest anonymous Markdown link" — that space is
crowded with near-identical tools (JotBird, mdto.page, and others) that ship
the same zero-signup publish flow. Booklet's defensible claim is narrower and
more specific: **it translates an engineer's Markdown into something a
non-technical reader can actually open and understand** — the PM who gets CC'd
on the incident report, the exec who's handed the ADR, the customer who
receives the release notes. Every hero, use-case, and social message should
lead with *who receives the page*, not with publish speed. Speed/zero-account
remain real, true, worth stating — as supporting proof, after the translation
claim, never as the headline itself.

---

## Design Philosophy

**Booklet's design north star: Apple-quality execution, in the Linear/Vercel
precision lane.**

That means:

- **Type is the product.** The UI exists to exemplify beautiful typography — every layout decision should make the content look better, not the chrome louder.
- **Chrome recedes.** Surfaces carry content; they don't call attention to themselves. No gradients on structural elements, no decorative borders, no shadow theatre. Hairline borders are the primary depth cue, not blurred glow shadows.
- **Amber = action/active only.** The single accent colour is reserved for CTAs, links, active states, and brand moments. Never for decoration, category colour, or background fills.
- **Three surfaces.** The visual hierarchy uses exactly three background levels: base → elevated → glass. Don't invent a fourth.
- **Motion has purpose, and it's the differentiator.** Entrances orient. Micro-interactions confirm. A small set of named, deliberate primitives (cursor-spotlight, staggered reveal, command palette, view-transitions) carry the identity's craft — not a visual gimmick layered on top of a generic dark-mode-plus-accent template.
- **Dark-first.** Dark mode is the primary brand expression. Always design dark-first, then verify light. Never invert this.
- **One idea per section.** Every section of a page or screen communicates one thing. If you can't name the section's one idea, it needs to be split or cut.

---

## Brand Personality

**Calm. Precise. Confident. Invisible.**

Booklet mirrors its product: it exists to make other things look good, not to call attention to itself. The brand communicates like a senior engineer who is also a great writer — direct, clear, no noise, no filler.

| Adjective | What it means in practice |
|---|---|
| **Calm** | No urgency theatre, no countdown timers, no exclamation marks in UI |
| **Precise** | Concrete numbers, specific examples, correct technical vocabulary |
| **Confident** | Declarative statements, not hedged claims |
| **Invisible** | The product surfaces the user's content; Booklet's brand gets out of the way |

Booklet is not playful. It is not corporate. It is not aspirational in a Silicon Valley sense. It is quietly excellent.

---

## Colour System — "Precision" (2026-08-01)

### Why this changed

"Ink & Paper" (an oxblood/burgundy ink accent on a near-black-and-warm-cream
palette, relaunched July 2026) and its follow-on motion system "The Reveal"
are both superseded as of 2026-08-01, on explicit product-owner direction: the
warm, paper/editorial identity was evaluated directly against a cooler,
more minimal, monochrome-plus-single-accent lane — the Linear/Vercel family —
and the product owner chose the latter this time. That's a deliberate pivot,
not a reversal of the reasoning behind "Ink & Paper" (which was itself a
reaction to an earlier generic-violet palette): the same "don't look like
every other AI-assisted SaaS product" goal is being solved with a different,
narrower lane — precision and restraint as the differentiator, not a colour
metaphor. The full rationale was captured in a design doc at the time of the
decision (since removed from the repo; the summary above is the durable record).

The accent is now a single amber/gold, chosen deliberately over both the
indigo/violet that's become this product category's default (Linear itself,
and most YC-era dev tools) and the oxblood/burgundy the last two Booklet
systems already used. `--color-paper` is retired entirely — no surface in the
current system references a paper/cream colour anywhere, including the two
places the old system reserved it for (the logo's folded corner, the
landing-page before/after mock).

### Design tokens — Dark mode (primary), from `src/app/globals.css`

| Token | Value | Role |
|---|---|---|
| `--color-bg` | `#0a0a0a` | Base — near-black |
| `--color-bg-soft` | `#0d0d0d` | Nav, input backgrounds, subtle step |
| `--color-bg-elevated` | `#161616` | Cards, dialogs, panels |
| `--color-bg-glass` | `rgba(22, 22, 23, 0.72)` | Backdrop-blur floating surfaces |
| `--color-text-primary` | `#f5f5f7` | Apple primary label |
| `--color-text-secondary` | `#98989f` | Apple secondary label |
| `--color-text-muted` | `#7f7f82` | Apple tertiary label |
| `--color-accent` | `#f5a623` | Action/active only — text/icon directly on `--color-bg` |
| `--color-accent-hover` | `#e0961d` | Accent on hover |
| `--color-accent-soft` | `#f8c368` | Focus rings, lighter tints |
| `--color-accent-contrast` | `#0a0a0a` | Text/icon placed ON an accent-coloured surface (never white — see below) |
| `--color-accent-dim` | `rgba(245, 166, 35, 0.14)` | Icon backgrounds, subtle fills, the `CursorSpotlight` glow |
| `--color-border-strong` | `rgba(255, 255, 255, 0.16)` | Prominent dividers, active borders |
| `--color-border-default` | `rgba(255, 255, 255, 0.09)` | Standard card borders, dividers |
| `--color-border-subtle` | `rgba(255, 255, 255, 0.05)` | Background separators |
| `--color-fill-1` | `rgba(255, 255, 255, 0.04)` | Table row alternates |
| `--color-fill-2` | `rgba(255, 255, 255, 0.08)` | Code headers, inset panels |
| `--color-fill-3` | `rgba(255, 255, 255, 0.13)` | Table head, button hover |
| `--shadow-glass` | `0 8px 48px rgba(0, 0, 0, 0.70)` | Dropdowns, drawers, toasts |
| `--shadow-card` | `0 1px 2px rgba(0, 0, 0, 0.60), 0 4px 24px rgba(0, 0, 0, 0.40)` | Card depth |
| `--shadow-hard` | `0 2px 0 0 rgba(0, 0, 0, 0.9)` | Rare hard-offset emphasis only, not a default card treatment |

### Design tokens — Light mode

| Token | Value | Role |
|---|---|---|
| `--color-bg` | `#fafafa` | Near-white base |
| `--color-bg-soft` | `#f2f2f3` | Subtle step up — nav, input bg |
| `--color-bg-elevated` | `#e8e8ea` | Cards, dialogs, panels |
| `--color-bg-glass` | `rgba(255, 255, 255, 0.90)` | Frosted glass surfaces |
| `--color-text-primary` | `#1d1d1f` | Apple label |
| `--color-text-secondary` | `#6e6e73` | Apple secondaryLabel |
| `--color-text-muted` | `#66666a` | Apple tertiaryLabel |
| `--color-accent` | `#8a5a00` | Deep ochre — amber itself fails contrast on white, see below |
| `--color-accent-hover` | `#6f4700` | |
| `--color-accent-soft` | `#9e680a` | |
| `--color-accent-contrast` | `#fafafa` | Text/icon ON an accent-coloured surface |
| `--color-accent-dim` | `rgba(138, 90, 0, 0.10)` | |
| `--color-border-strong` | `rgba(0, 0, 0, 0.14)` | |
| `--color-border-default` | `rgba(0, 0, 0, 0.09)` | |
| `--color-border-subtle` | `rgba(0, 0, 0, 0.05)` | |
| `--color-fill-1` | `rgba(0, 0, 0, 0.03)` | |
| `--color-fill-2` | `rgba(0, 0, 0, 0.06)` | |
| `--color-fill-3` | `rgba(0, 0, 0, 0.10)` | |
| `--shadow-glass` | `0 4px 24px rgba(0, 0, 0, 0.10)` | |
| `--shadow-card` | `0 1px 2px rgba(0, 0, 0, 0.08), 0 4px 16px rgba(0, 0, 0, 0.06)` | |
| `--shadow-hard` | `0 2px 0 0 rgba(0, 0, 0, 0.12)` | |

### Colour rules

- **Amber (`--color-accent`) is for action and active states only.** Never use it as a category colour, background, or decorative element.
- **`--color-paper` is retired.** Do not reintroduce a paper/cream colour anywhere — no surface in this system references print/paper metaphors.
- **Dark mode is the primary brand expression.** All brand assets, screenshots, and marketing visuals default to dark.
- **Two distinct accent hexes exist per mode for a reason bright colours are genuinely bad at**: a single amber can't simultaneously be "readable as bare text/icon directly on the base background" and "a legible label color painted on top of an amber button fill" — bright, high-luminance colours make white-on-them low-contrast almost by definition. `--color-accent-contrast` is the fix: the text colour to place ON an accent-coloured surface (near-black in dark mode, near-white in light mode), never a hardcoded white. `Button.tsx`'s primary variant uses `text-accent-contrast`, not `text-white`, for exactly this reason.
- **Every accent shade is verified against measured WCAG AA contrast, not eyeballed.** Actual output of `node scripts/check-contrast.mjs` against the current tokens:

  ```
  PASS  dark:  accent text/icon on bg:        9.77:1  (min 4.5:1)
  PASS  dark:  accent-contrast on accent bg:  9.77:1  (min 4.5:1)
  PASS  dark:  accent-soft on bg:            12.25:1  (min 4.5:1)
  PASS  light: accent text/icon on bg:        5.68:1  (min 4.5:1)
  PASS  light: accent-contrast on accent bg:  5.68:1  (min 4.5:1)
  PASS  light: accent-soft on bg:             4.53:1  (min 4.5:1)
  ```

  If any accent hex is ever adjusted, re-run this script and re-verify every role above — a "reasonable-looking" tweak to one shade can silently fail another role's bar.
- `--color-text-muted` was deliberately lifted from an earlier, failing value in both modes (dark: was `#636366`, 3.5:1 on `--color-bg` / 3.0:1 on `--color-bg-elevated`, both under WCAG AA's 4.5:1; light: was `#86868b`, 3.6:1 / 3.0:1). Current values (`#7f7f82` dark, `#66666a` light) hit 5.3:1 / 4.5:1 and 5.7:1 / 4.7:1 respectively against the harder of the two backgrounds. Don't revert to the old muted values.

---

## Typography

**Primary typeface:** Geist Sans (Vercel's open-source variable typeface), self-hosted via `next/font`. Used for all UI chrome, headings, body copy, and — unlike the prior system — published-page long-form reading content too, per product-owner decision: full typographic consistency across the product over a reading-optimized serif.
**Monospace typeface:** Geist Mono, self-hosted via `next/font`. Replaces JetBrains Mono for code blocks, the editor textarea, and everywhere else monospace is used — one type family (two optical variants) system-wide instead of three-plus fonts across UI/code/reading.
**Reading typeface (reader-toggle exception):** Source Serif 4 is still loaded (`--font-reading`, self-hosted via `next/font`) — it is not removed. It backs the per-document "serif" reading-typeface toggle (`DocSettings.typeface` in `src/lib/blocks.ts`, consumed by `BlockRenderer`). Two reasons it survives the otherwise-complete migration:
  1. **Existing published documents.** Any document published before this redesign, or any document with no stored `typeface` value at all, is treated as `"serif"` by `BlockRenderer` (`isSerifMode()` in `src/lib/blocks.ts` — a missing value defaults to serif, not sans) for backward compatibility. Those pages must keep rendering exactly as they did when the author published them.
  2. **Author choice.** The default for *newly created* documents flipped to `"sans"` (Geist Sans) as part of this redesign, but the toggle itself — letting an author opt a specific document into the serif reading treatment — is a real, still-supported feature, not a leftover.
**Font features:** `"kern", "liga", "calt", "cv02", "cv03", "cv04", "cv11", "ss01"` on the body font.
**Base font size:** 17px.

### Type scale (central control tokens, `src/app/globals.css`)

| Role | Weight | Tracking | Line-height |
|---|---|---|---|
| H1 | 200 (extralight) | −0.025em | 1.12 |
| H2 | 300 (light) | −0.018em | 1.25 |
| H3 | 400 (normal) | −0.012em | 1.375 |
| H4/H5/H6 | 500 (medium) | 0em | 1.4 |
| Body | 400 (normal) | — | 1.75 |

These are global element defaults (`h1`/`h2`/`h3`/`h4` in `@layer base`) — override per-instance only with explicit Tailwind weight/tracking utilities where intentionally different, e.g. large marketing display headings use `font-extrabold`/`font-bold` directly (see below), not the global H1/H2 defaults.

Micro-scale utility tokens (`--text-2xs` / `--text-xs` / `--text-sm`): `0.625rem` (10px, eyebrow labels/kbd hints), `0.6875rem` (11px, secondary chrome), `0.8125rem` (13px, body-small/captions) — Tailwind's base/lg/xl/2xl/3xl defaults are unchanged.

Marketing display sizes (as implemented in `Landing.tsx`, fluid via `clamp()` rather than fixed breakpoints):

```
Hero H1:     clamp(38px, 8vw, 80px)   / font-extrabold / leading 1.02 / tracking -0.04em
Section H2:  clamp(28px, 4.5vw, 40px) / font-bold      / leading 1.12–1.14 / tracking -0.025em
Eyebrow:     10px (text-2xs) / font-semibold / tracking 0.24em / uppercase / text-accent
```

### Typography rules

- Headlines use `text-balance` for multi-line wrap; body copy uses `text-pretty`.
- **Never** set a heading below H1 at a size larger than the level above it.
- Monospace content always uses `font-mono` (Geist Mono).
- Eyebrow labels are always `uppercase tracking-[0.24em] text-accent`.
- Don't mix font weights within a single sentence.

---

## Logo & Mark

### The mark

The mark is unchanged in silhouette from the prior "Ink & Paper" relaunch — a
page with its top-right corner folded down, still the clearest available
reference to "a booklet": pages someone chose to bind and hand to someone
else. What changed for Precision is the palette underneath it, and one detail
of construction:

- The page's fold — the mark's signature detail, must always be present — is
  now filled with a **plain black tint** (`rgba(0, 0, 0, 0.18)`) wherever the
  tile it sits on is itself accent-coloured, not the retired paper-cream
  fill. There is no print/paper reference left anywhere in the mark.
- The page tile's background and the two short horizontal "text" bars now
  use `var(--color-accent)` (amber in dark mode, ochre in light mode) instead
  of the old oxblood ink.

Source of truth: `src/components/ui/AppLogo.tsx` (`BookletMark`, used
in-app — nav, footer, UI chrome). Construction, on a 24×24 grid:

- The page: a rounded rectangle (effectively `rx 1.5`) with the top-right
  corner replaced by a straight diagonal cut, folded down into a small
  triangular flap, filled solid white.
- The flap is filled `rgba(0, 0, 0, 0.18)` against the white page.
- Two short horizontal bars inside the page (`fill="var(--color-accent)"`, at
  `0.85` and `0.55` opacity) suggest written lines without adding enough
  detail to blur out at favicon scale.
- Container tile: `rx 5.5` at 24px scale; `rx 112` at 512px app-icon scale.
  Tile background is `var(--color-accent)`.

Two authorised tile treatments — both carried over unchanged in structure
from the pre-Precision mark, just recoloured:

| Treatment | Background | Page | Fold + text bars | Use |
|---|---|---|---|---|
| Amber tile | `var(--color-accent)` | White | Black tint (`rgba(0, 0, 0, 0.18)`) fold; accent-colour text bars | In-product nav, header, footer, UI chrome; OG/Twitter share image |
| Black tile | Pure black `#000000` | `#f5f5f7` off-white | Accent-colour (`#f5a623`) fold and text bars | Favicon, app icon, OS home-screen icon |

The two treatments deliberately fill the fold differently, and this is not
an inconsistency to fix: the black-tint fold is a *shadow* — it only reads
as a fold if it darkens whatever's underneath it. On the amber tile that
works (black tint over amber reads as a shaded corner). On the black tile
it would not — `rgba(0, 0, 0, 0.18)` composited over `#000000` is still
just black, i.e. an invisible fold. The black-tile treatment instead reuses
the accent colour for the fold, exactly as the pre-Precision mark did with
oxblood ink: same colour for fold and text bars, at full opacity for the
fold and `0.85`/`0.55` for the bars.

Source of truth for each treatment: `src/components/ui/AppLogo.tsx`
(`BookletMark`, amber tile, in-app) and `src/app/icon/route.ts` /
`src/app/apple-icon/route.ts` (black tile, standalone favicon/app-icon
routes) — keep the black-tile pair in sync with each other if the mark
changes again. `src/lib/og-image.ts` draws a third, hand-copied instance of
the mark (amber tile, for the OG/Twitter share image) and must be kept in
sync with `AppLogo.tsx`'s amber-tile convention, including the black-tint
fold. As of this redesign, all three implementations agree: the standalone
icon routes were previously flagged as a known gap (hardcoded oxblood from
the "Ink & Paper" relaunch) but that was fixed to the new amber accent in a
follow-up commit, and this document is now the reconciled description of
that fix rather than an open gap.

### The wordmark

"Booklet" set in Geist Sans, light weight (`font-light`), tight tracking, in `--color-text-primary`.

### Lockups

| Lockup | Where to use |
|---|---|
| Mark + wordmark | Navigation, email headers, documents |
| Mark alone | Favicon, app icon, footer icon, social profile images |
| Wordmark alone | Never — always accompany with the mark |

### Usage rules

- Never stretch, squash, recolour, or apply drop shadows to the mark.
- Never omit the folded corner — a plain, unfolded rectangle is not the Booklet mark.
- Minimum mark size: 16px × 16px (favicon context); 24px × 24px (any visible UI context).

---

## Motion & Animation

Motion is Precision's differentiator from every other "dark mode + one
accent" dev-tool look — the craft is in a small, named set of primitives used
consistently, not a visual gimmick layered on top.

### The one easing curve

`cubic-bezier(0.16, 1, 0.3, 1)` — a "snappy decelerate," the same family
Linear uses — is applied to essentially all motion in the product, both
CSS-driven and JS-driven:

- CSS: `--ease-spring` in `src/app/globals.css`, plus the global rule
  `*, *::before, *::after { transition-timing-function: cubic-bezier(0.16, 1, 0.3, 1); }`.
- JS: `EASE_PRECISION = [0.16, 1, 0.3, 1]` in `src/lib/motion.ts`, consumed by every framer-motion variant.

Two secondary curves exist for specific non-entrance cases, not as
alternatives to reach for casually: `--ease-smooth`
(`cubic-bezier(0.4, 0, 0.2, 1)`, layout changes/reorder) and `--ease-bounce`
(`cubic-bezier(0.34, 1.56, 0.64, 1)`, interactive confirms — copy-success states, pill actives).

### Durations

CSS-side named tokens (`src/app/globals.css`): `--duration-fast` 100ms
(colour/opacity micro-interactions), `--duration-normal` 180ms (standard UI —
hover, focus), `--duration-slow` 280ms (entrance animations), `--duration-deliberate`
400ms (full-panel/dialog open). The JS-side equivalent for framer-motion
consumers (`DURATION` in `src/lib/motion.ts`, which can't read CSS custom
properties into a transition config) is a smaller trio: `fast` 0.12s, `normal`
0.18s, `slow` 0.24s. Both share the one easing curve above; treat the CSS and
JS tables as separate but harmonized, not as a literal 1:1 mapping.

### Named primitives

- **`CursorSpotlight`** (`src/components/ui/CursorSpotlight.tsx`) — a
  low-opacity radial-gradient glow (`radial-gradient(600px circle at <pointer>, var(--color-accent-dim), transparent 70%)`)
  that tracks the pointer within its nearest positioned ancestor. Reserved for
  a handful of signature dark hero/marketing moments, not general chrome.
  Skips attaching its listener entirely under `prefers-reduced-motion`
  (renders `null`), rather than rendering a static/reduced version.
- **Command palette** (`⌘K` / `Ctrl+K`, `src/components/app/CommandPalette.tsx`,
  built on `cmdk`, wired in `src/app/app/AppClient.tsx`) — new in-app
  navigation/action surface, not a restyle of anything prior. Surfaces
  navigation and page-creation actions; route changes triggered from it go
  through `navigateWithViewTransition`.
- **The publish sequence** (`PublishReveal` in `src/components/app/TopBar.tsx`)
  — replaces "The Reveal"'s dark→paper crossfade with a terminal-native,
  monochrome sequence: a brief `"Publishing…"` compiling pulse
  (`--color-bg` background, ~160ms) → a success tint (`--color-accent-dim`
  background, `"Published ✓"`, ~160ms) → fade (~220ms), all set in
  `font-mono`. Same trigger and timing shape as its predecessor, entirely
  repainted to fit the monochrome identity instead of a colour-mode
  transformation.
- **View-transitions** — `navigateWithViewTransition()` in `src/lib/motion.ts`
  wraps in-app route pushes in the native `document.startViewTransition`
  API directly (no polyfill, no Next.js experimental flag dependency).
  Falls back to a plain navigation when the browser doesn't support it, or
  when `prefers-reduced-motion` is set.

### Rules

- `prefers-reduced-motion` is respected everywhere motion is added — spotlight, stagger, view-transitions, and the publish sequence all degrade to instant/no-op, not merely reduced.
- Never animate layout properties (`width`, `height`, `padding`). Animate `opacity`, `transform` (y, scale), and `filter` only.
- Entrances orient; micro-interactions confirm. Nothing moves just because it can.
- Use `whileInView` with a `once: true` viewport for scroll-triggered entrances; hero elements use `animate` directly since they're above the fold.

---

## Spacing & Layout

### Grid

- Max content width: `max-w-6xl` (72rem) with `px-5 sm:px-8` horizontal gutter
- Section padding: `py-20 sm:py-28`
- Card internal padding: `p-6`
- Card gap: `gap-4`

### Radius tokens (`src/app/globals.css`)

| Token | Value | Used for |
|---|---|---|
| `--radius-input` (`rounded-input`) | `6px` | Text inputs, code action buttons |
| `--radius-card` (`rounded-card`) | `16px` | Cards, dialogs, floating panels |
| `--radius-pill` (`rounded-pill`) | `9999px` | Pills, badges, segmented controls, pill buttons |

---

## Icon Style

All icons are inline SVG — **no external icon library, no emoji in UI copy**.

- **Stroke weight:** 1.5px–1.75px depending on context.
- **Cap/join:** `strokeLinecap="round" strokeLinejoin="round"` — always.
- **Fill:** `fill="none"` for line icons; `fill="currentColor"` for solid icons.
- **Colour:** `currentColor` — inherits from parent, never hardcoded.
- Icon containers use `bg-accent-dim` (amber tint) with `text-accent` for feature card icons.

---

## Voice & Tone

### Personality summary

The brand voice is a senior engineer who writes as well as they code: direct, concrete, and respectful of the reader's intelligence. No marketing fluff. No hedging. No filler.

This is restated independently for the Precision identity, not just inherited
as a leftover constraint from "Ink & Paper": short, declarative, concrete copy
is what actually reads as "confident and minimal" in a monochrome,
low-ornamentation interface — verbose or hedged copy would visually fight the
new design language.

### Core rules

| Do | Don't |
|---|---|
| Short sentences. One idea at a time. | Multi-clause run-on sentences |
| Confident declarations ("Booklet turns your text into…") | Hedged language ("can help you maybe…") |
| Concrete use cases ("incident reports, ADRs, READMEs") | Vague abstractions ("all kinds of content") |
| Second person, present tense | Third person or passive voice |
| Correct technical vocabulary (Markdown, ADR, GFM, KV) | Dumbing down tech concepts |
| Specific numbers ("under 30 seconds", "30 days", "10-character ID") | Meaningless superlatives ("blazing fast") |
| "Paste. Publish. Share." | "Revolutionize your workflow" |
| Active voice | Passive voice |

### Words to never write

`Revolutionary`, `game-changing`, `disrupting`, `paradigm shift`, `all-in-one`, `end-to-end`, `seamless`, `robust`, `powerful solution`, `leverage`, `synergy`, `we're excited to announce`, `delighted to share`, `game changer`, `next-level`, `best-in-class`.

### Copy hierarchy

1. **Hero headline** — 3–8 words, declarative, names the transformation. *"Written in Markdown. Read by everyone else."*
2. **Sub-headline** — 1–2 sentences, names what the product does and removes the biggest objection.
3. **Trust signals** — removes friction: *"Free · No account · Published in seconds"*
4. **Eyebrow** — ultra-short, 2–3 words, uppercase. Used for section labels only.
5. **Feature headline** — benefit-first, one sentence max. *"Beautiful by default"* not *"Advanced Rendering Engine"*.
6. **Feature description** — what the user experiences, not what the code does.

---

## Key Messages

### Hero headlines (pick any)

- "Written in Markdown. Read by everyone else." ← **primary / canonical**
- "The postmortem your exec will actually read."
- "Markdown your team writes. A page anyone can read."
- "Paste once. Share a page people actually read."
- "Your writing, the way it was meant to be read."
- "The space between writing Markdown and making it readable."

### Sub-headlines / body copy

- "Your incident reports, ADRs, and runbooks are already in Markdown. Booklet turns them into a clean page the PM, exec, or customer on the other end can actually open and read — no account, no formatting step, no raw asterisks." ← **canonical subtitle**
- "Booklet turns your plain text into a beautifully formatted page — with proper headings, code blocks, and tables — shareable with a single link. No setup, no noise." ← prior canonical; still accurate, secondary to the translation-led version above
- "No signup, no onboarding. Paste and you're in the editor."
- "Typography, spacing, and layout — handled so your content lands the way you meant it."
- "When your message gets escalated or CC'd, the structure stays intact."
- "Nothing stored until you deliberately hit publish."
- "Send in Slack, email, or a ticket. They just read."

### CTAs (verb-first, specific)

- "Open the editor — it's free" ← **primary CTA**
- "Try it now"
- "See a live example"
- "Paste your first draft"
- "Open the editor"
- "Make your own →"

### Social / short-form

- "Markdown → beautiful page → link → done."
- "Stop pasting raw Markdown into Slack. There's a better way."
- "Your incident report deserves to look like you wrote it on purpose."
- "ADRs, READMEs, post-mortems, proposals. One link. Anyone can read it."
- "The fastest way to share something that looks like you spent time on it."

---

## Use Cases (with pain and proof)

| Use case | The pain | Booklet's role |
|---|---|---|
| **Incident summaries / post-mortems** | Raw MD pasted to Slack is noise; Google Docs requires an account | A link anyone can open — timeline, severity, root cause all intact |
| **Architecture decision records (ADRs)** | ADRs live in repos — non-engineers can't navigate them | A shareable link that explains the decision without GitHub |
| **README-style docs** | GitHub requires login, repo navigation, mental model overhead | A plain URL that reads like a proper document |
| **Release notes** | Buried in PRs or CHANGELOG.md | A clean page stakeholders can actually read |
| **Onboarding guides** | Google Docs for internal docs requires IT provisioning | A Booklet link pasted in the welcome Slack message |
| **Proposals / briefs** | Writing in Markdown, formatting in another tool wastes time | Publish from the Markdown, skip the formatting step |
| **CI/CD via API** | Manual publishing doesn't scale | The Booklet API publishes pages from pipelines automatically |

---

## Tone in Specific Contexts

### Product announcements

Lead with what changed for the user, not what changed in the code. One sentence of context, one of impact. No changelog-speak.

### Social media (LinkedIn, X/Twitter)

- Open with the pain or the scenario, not the product name
- Use line breaks aggressively — no walls of text
- End with a concrete, specific CTA
- No hashtag spam, no emoji overload, no hollow hype

### Ad copy

- Headline: name the transformation in under 8 words
- Body: remove one specific objection (no account / free / 30 seconds)
- CTA: verb-first, specific ("Try the editor free" not "Learn more")

### Email

- Subject: specific scenario, not product feature
  - ✅ "Stop pasting raw Markdown into Slack"
  - ❌ "Announcing Booklet's new sharing features"
- Body: 3 paragraphs max. Problem → Solution → CTA.
- Signature: *"Built for clarity. — The Booklet team"*

### Developer / technical content

- Use correct terminology (Markdown, GFM, localStorage, Cloudflare KV, API key)
- Show real code examples for API/CLI use cases
- Don't over-explain concepts the audience already knows
- Acknowledge the technical sophistication of the audience

---

## Competitive Positioning

| Tool | Why users reach for it | Why Booklet wins |
|---|---|---|
| Google Docs | Rich formatting, familiar | Requires Google account; not Markdown-native |
| Notion | Beautiful output, flexible | Requires workspace access; heavy onboarding |
| GitHub Gists | Developer-native | Poor sharing-optimised rendering; no clean URL |
| HackMD / StackEdit | Markdown-native | Collaborative overkill; not optimised for sharing |
| Confluence | Enterprise docs | Requires corporate SSO; heavyweight |
| Pasting into Slack/email | Zero friction | Destroys all formatting; no permanent link |

**Booklet's position:** The fastest, most beautiful path from Markdown to a link someone can actually read. Not a full tool — a sharp one.

---

## What Booklet Is Not

Be explicit in all positioning to avoid misleading copy:

- **Not a CMS** — published pages are immutable snapshots, not editable posts
- **Not a collaboration tool** — no comments, no co-editing, no shared cursors
- **Not a note-taking app** — Booklet publishes notes, not stores them
- **Not access-controlled** — published pages are publicly accessible to anyone with the link

---

## Always Include in Marketing Assets

1. **The zero-friction proof point** — "no account", "free", "under 30 seconds", or all three
2. **The transformation** — from (raw Markdown / technical draft) to (beautiful / shareable / readable page)
3. **At least one specific use case** — incident report, ADR, README, or post-mortem
4. **The CTA** — always link to the editor at `/app`, never to a sign-up page

---

## SEO

| Element | Value |
|---|---|
| Root `<title>` | `Booklet — Written in Markdown, Read by Everyone Else` |
| Root `<meta description>` | `Turn incident reports, ADRs, and runbooks into a clean page anyone can open and read — no account, no formatting step. Free, in seconds.` |
| Title pattern | `{Page title} — Booklet` |
| Primary keywords | markdown viewer, share markdown online, markdown to html, markdown preview, shareable markdown link, incident report template, ADR template, postmortem template, runbook template, README viewer, technical writing tool |
| Schema types | `SoftwareApplication + WebSite + WebPage` on home page |
| OG image | `/opengraph-image` — 1200×630 |
| Twitter card | `summary_large_image` |

---

## Print & Media

- Print styles force white background, black text, with code blocks wrapped
- Published pages produce clean, chrome-free PDF via `⌘P` — no ads, no nav, no cookie banners
- Theme-color meta (`src/app/layout.tsx`): Dark `#0a0a0a`; Light `#fafafa` — matches `--color-bg` in each mode, not pure black/white

---

## History

- **2026-08-01 — "Precision"** (this document). Supersedes both **"Ink & Paper"**
  (2026-07-28) and its follow-on motion system **"The Reveal"** (2026-07-28)
  in full: new monochrome-plus-single-amber-accent palette, Geist Sans/Mono
  typography, hairline-border-first geometry, and a named motion system
  (`CursorSpotlight`, command palette, the redesigned publish sequence,
  view-transitions) replacing the paper/serif/dark→paper-reveal identity.
  (Full rationale was captured in a design doc at the time, since removed
  from the repo.)
- **2026-07-28 — "The Reveal"** (superseded). Motion/interaction layer added on
  top of "Ink & Paper" — the dark→paper crossfade publish moment, scroll-driven
  hero reveal, and the `/templates` visual-gallery restyle.
- **2026-07-28 — "Ink & Paper"** (superseded). Replaced an earlier generic
  violet accent with an oxblood/burgundy "ink" accent and a warm cream
  "paper" surface, plus the folded-page-corner logo mark (silhouette carried
  forward into "Precision"; palette did not).

*Contact: Ashwin Sathian — ashwinsathyan19@gmail.com*
