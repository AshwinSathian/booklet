# Booklet Precision Redesign — replacing "Ink & Paper" / "The Reveal"

*Design spec — 2026-08-01*

## Why

Booklet shipped a full "Ink & Paper" rebrand on 2026-07-28 (`72b7bde`) and then a
follow-on visual system, "The Reveal" (`docs/superpowers/specs/2026-07-28-visual-
elevation-design.md`), completed as of the current `HEAD` (`0682c52`). That work is
real, deliberate, and well-documented — not neglected legacy code. This spec
**supersedes it entirely**, on explicit product-owner direction (2026-08-01): the
warm paper/serif/editorial identity is the wrong lane going forward. The new
direction is a precision, monochrome, motion-led identity in the Linear/Vercel
family — the exact lane "Ink & Paper" was originally created to move *away* from.
That's a legitimate pivot, not a contradiction: the product owner has evaluated
both lanes directly and wants the cooler, more minimal one this time, executed
with enough craft (a real motion/interaction identity, not just a palette swap)
to avoid landing as generic template SaaS.

This is a **full-surface revamp**: every route in the app (~34 pages), the design
tokens, the component primitives, the copy/voice rules, and the two docs-of-record
(`BRAND.md`, `docs/BOOKLET_TEXTBOOK.md`) that describe the brand. Nothing from
"Ink & Paper" or "The Reveal" is preserved as a constraint — logo mark, palette,
Fraunces typography, the dark→paper reveal motif, and the existing `BRAND.md` voice
section are all explicitly up for replacement where this spec calls for it.

## Core identity: "Precision"

Booklet's new identity is not built around a metaphor the way "Ink & Paper" (a
physical booklet) or "The Reveal" (write becomes read) were. It's built around an
execution standard: exact spacing, exact type scale, exact motion timing, one
accent used with total discipline, monochrome everywhere else. The differentiation
from every other "dark mode + one accent" dev tool is **motion craft**, not a
visual gimmick — a small set of signature interactions used consistently:

- A cursor-aware spotlight/glow that follows the pointer on dark hero/marketing
  surfaces (subtle, low-opacity radial gradient tracking cursor position).
- Tight, staggered reveal animations for content entering the viewport (short
  delay-per-child, not a uniform fade-in-everything).
- A command palette (`⌘K`) in the app — surfaces navigation, publish, templates,
  and settings actions. New capability, not a restyle.
- A redesigned publish moment: replaces "The Reveal"'s dark→paper crossfade with a
  terminal-native sequence (cursor blink → compact progress state → link
  materializes) that fits the monochrome identity instead of fighting it.
- View-transitions (native `View Transitions API`, progressively enhanced — no
  polyfill, no motion at all where unsupported) for in-app route changes.
- One consistent custom easing curve (`cubic-bezier(0.16, 1, 0.3, 1)` — a "snappy
  decelerate," the same family Linear uses) applied everywhere instead of default
  eases, so motion feels like one system rather than per-component guesses.

## Foundations

### Color

- **Base**: near-black `#0a0a0a` (dark, primary) / near-white `#fafafa` (light,
  verified secondary — dark-first, light mode derived from it, matching the
  existing project convention of dark being primary).
- **Neutral scale**: a 12-step gray ramp (following Tailwind's own gray-scale
  cadence) for text, borders, and surface elevation — base → raised → overlay,
  three levels only, matching the existing project rule of a small fixed number of
  elevation levels (this is a rule worth keeping regardless of which visual
  identity is on top, since it's about restraint, not about "Ink & Paper"
  specifically).
- **Accent**: a single signal amber/gold (`~#f5a623` range, exact hex tuned at
  implementation time against measured WCAG AA contrast on both base colors,
  using the existing `scripts/check-contrast.mjs`). Chosen deliberately over the
  indigo/violet that's become this product category's default (Linear itself,
  and most YC-era dev tools) and over the oxblood/burgundy the last two systems
  already used. Accent means action only — links, primary buttons, focus rings,
  active states — never decoration or category color, carrying forward the one
  rule from the old `BRAND.md` that's independently correct.
- Paper (`--color-paper` family) is retired entirely — no surface in the new
  system references a paper/cream color anywhere, including the two places the
  old system reserved it for (logo, landing-page mock).

### Typography

- **Geist Sans** (Vercel's open-source typeface) for all UI chrome, headings, and
  body copy everywhere, including published-page long-form reading content —
  full consistency over reading-comfort-optimized serif, per product-owner
  decision. Variable font, self-hosted via `next/font`.
- **Geist Mono** replaces JetBrains Mono for code blocks, the editor textarea, and
  anywhere monospace is used — keeping one type family (two optical variants)
  system-wide instead of three-plus fonts across UI/code/reading.
- Fraunces, Source Serif 4, and Inter are removed from the active token/font-face
  set once migration is complete (see Rollout).
- Type scale: a modular scale with fewer, more deliberate steps than the current
  system — display, heading, body, small, micro. Tight, confident line-heights;
  no oversized "kinetic" display type — Precision reads as controlled, not loud.

### Geometry

- 1px hairline borders as the primary depth cue (this survives from "The
  Reveal" — it's a genuinely good, identity-agnostic pattern already validated in
  this codebase). Hard, no-blur offset shadows for rare emphasis only (e.g. a
  focused card), not as a default card treatment.
- No print/paper motifs anywhere (registration marks, folded corners, rotated
  tabs) — those were specific to the old metaphors and have no place here.
- Logo mark: a new mark is needed (the folded-page-corner mark was "Ink & Paper"-
  specific). Recommend a simple geometric monogram/wordmark treatment consistent
  with the Linear/Vercel reference lane — final mark is an implementation-time
  design task using Geist as the base letterform logic, not fixed by this spec.

### Motion — implementation primitives

- A shared `motion` token module (durations: 120ms/180ms/240ms; one easing curve)
  consumed by every animated component, replacing ad hoc per-component timings.
- `prefers-reduced-motion` respected everywhere motion is added — spotlight,
  stagger, and view-transitions all degrade to instant/no-op, not just reduced.
- Framer Motion (already a dependency) remains the implementation library for
  stagger/spotlight; native View Transitions API for route-level transitions.

## Per-surface plan

### Marketing / landing (`/`, `/about`, `/pricing`, `/changelog`, `/integrations`,
`/templates` + `[slug]`, `/explore`, `/tags` + `[tag]`, `/api-docs`, `/mcp`,
`/mcp-setup`, `/cli-auth`, `/privacy`, `/terms`)

- Full token migration off Ink & Paper/Reveal values.
- Hero: replace `RevealHero.tsx`'s scroll-driven dark→paper animation with a
  monochrome hero using the cursor-spotlight effect and staggered headline/
  subhead/CTA entrance — same "signature moment" role, new mechanic.
- `SiteHeader`/`SiteFooter`: restyle onto new tokens; audit for any Fraunces/
  paper-specific styling.
- `/templates`: keep the visual-gallery structure from "The Reveal" (a genuine UX
  improvement over the prior plain link list, unrelated to color/type identity)
  but restyle previews onto Precision tokens.
- `/explore`, `/integrations`, `/tags`: not touched by "The Reveal" — full restyle
  from whatever their current (pre-Reveal, likely stale) styling is.

### Editor / app (`/app`)

- `TopBar`, `PasteInput`/`SyntaxOverlay`, `ActionDrawer`, `TemplatesDialog`,
  `DraftsDialog`: full token migration.
- Add command palette (`⌘K`) as new in-app navigation/action surface.
- Publish flow: replace the compressed dark→paper reveal with the terminal-
  native publish sequence described above.
- Fix the two known duplicate/orphaned editor components flagged in the
  textbook's "known rough edges" (`TemplatesDialog.tsx` unused, drafts UI
  implemented twice) while this surface is being touched — real bugs found
  during exploration, in scope to fix alongside the restyle, not a separate
  unrelated cleanup.

### Published page (`/p/[id]`, `/p/[id]/embed`, `/c/[id]`, `/u/[id]`, `/t/[slug]`
+ `/admin`/`/join`)

- Full restyle onto Precision tokens and Geist Sans body type (see Typography
  decision above).
- Team Spaces admin/join screens: not touched by "The Reveal" — full restyle.

### Auth (`/sign-in`, `/sign-up`, `/claim`) + new password-reset flow

- Restyle the existing editorial split-layout (`AuthLayout.tsx`) onto Precision
  tokens — the split-layout *structure* is a reasonable pattern independent of
  the visual identity sitting on top of it, so it's kept; the dark-example-panel
  content and styling is fully replaced.
- New: a password-reset flow (`/forgot-password`, `/reset-password`) does not
  exist today at all. Building it is a real, scoped feature addition (email
  delivery, token generation/expiry, new routes/forms), not a restyle — flagged
  here as in-scope per product-owner direction, but it is the one item in this
  spec that is net-new product surface rather than redesign, and it depends on
  the app having a transactional-email capability, which does not currently
  exist anywhere in the codebase (`.env.example` has no email-provider config).
  This needs its own implementation-plan section with a from-scratch email-
  sending decision (provider choice, templates), not folded silently into
  "restyle auth pages."

### Dashboard (`/my-pages`, `/my-pages/analytics/[id]`, `/my-pages/versions/[id]`)

- Full restyle onto Precision tokens.

### Admin (`/admin`)

- Explicitly out of scope in "The Reveal"; in scope now. Full restyle — same
  design-system rigor as every other surface, no more "internal tool, doesn't
  need polish" exception.

### Error / system states

- No root-level `not-found.tsx` or global `error.tsx` exists today. Both are new
  files, not restyles: build a Precision-styled 404 and a global error boundary,
  plus review the two existing scoped error boundaries (`app/error.tsx`,
  `p/[id]/error.tsx`) for consistency with the new tokens.

## Copy / voice rules (replaces `BRAND.md` §Voice & Tone)

- Voice: direct, precise, unembellished — a senior engineer explaining something
  correctly, not a marketing team selling it. This is restated independently for
  the Precision identity (not inherited from the old `BRAND.md` as a leftover
  constraint), because short/declarative/concrete copy is what actually reads as
  "confident and minimal" in a monochrome, low-ornamentation interface — verbose
  or hedged copy would visually fight the new design language.
- Keep (restated, not inherited): no hedging, no vague superlatives, concrete
  numbers/use-cases over abstractions, and the specific blocklist of marketing
  clichés (*revolutionary, game-changing, disrupting, paradigm shift, all-in-one,
  end-to-end, seamless, robust, powerful solution, leverage, synergy, we're
  excited to announce, delighted to share, next-level, best-in-class*) — these
  are generically good writing constraints, independent of visual identity.
- Replace: the canonical hero headline and any copy that leans on the "ink/
  paper/booklet-as-physical-object" metaphor needs new lines that fit Precision
  instead (exact new copy is an implementation-time writing task per surface,
  not fixed line-by-line by this spec).
- `BRAND.md` is rewritten in full as the new doc-of-record: new palette, new
  type system, new motion principles, restated voice rules, updated logo
  description. `docs/BOOKLET_TEXTBOOK.md` §2 ("The brand: Ink & Paper") gets a
  short dated addendum pointing at the new `BRAND.md` rather than a full rewrite
  of a 1700-line document (out of proportion to what's needed — the textbook's
  job is historical/technical narrative, and noting "superseded 2026-08-01, see
  BRAND.md" is sufficient and honest).

## Explicitly out of scope

- CLI (`packages/cli`), GitHub Action, VS Code extension, MCP server: these are
  terminal/editor-native surfaces with their own platform conventions (ANSI
  colors, VS Code theme tokens), not web UI — out of scope for this visual
  system. If the CLI has any hardcoded ANSI color choices that reference the old
  brand accent, that's a one-line follow-up, not part of this pass.
- Backend/auth/session logic, Markdown parser/rendering logic, API behavior:
  visual and copy only, except where a surface requires new logic to exist at
  all (the password-reset flow, and only that).
- Any pricing/monetization logic — the product is fully free; no pricing-page
  functional changes, restyle only.

## Rollout

1. Foundations: new token set in `src/app/globals.css` (full replacement of
   Ink & Paper/Reveal custom properties), Geist Sans/Mono font loading, motion
   token module, contrast verification via `scripts/check-contrast.mjs` before
   locking the accent hex.
2. Shared chrome + component primitives (`src/components/ui/*`, `SiteHeader`,
   `SiteFooter`, `AuthLayout`, buttons, cards, inputs) — once these are on the
   new tokens, every page consuming them inherits most of the visual change for
   free.
3. Marketing/landing surfaces.
4. Editor/app + command palette + publish moment.
5. Published page + Team Spaces + `/admin`.
6. Dashboard + auth restyle + new password-reset flow.
7. New 404/global error pages.
8. Docs: rewrite `BRAND.md`, addendum in `BOOKLET_TEXTBOOK.md`.
9. Verification pass (below) and cross-surface QA sweep.

## Verification plan

- Extend the existing Playwright visual-QA sweep (`scripts/visual-qa.mjs`,
  built during "The Reveal") to cover every route touched by this spec,
  including the surfaces "The Reveal" explicitly skipped (`/admin`, `/explore`,
  `/integrations`, `/tags`, Team Spaces, 404).
- Run `scripts/check-contrast.mjs` against the final accent/base combination in
  both light and dark mode before locking hex values; fix anything under WCAG AA.
- `prefers-reduced-motion` manual check on every new motion primitive
  (spotlight, stagger, view-transitions, publish sequence).
- Standard build/typecheck/lint/test suite must pass; no functional regressions
  in publish flow, auth, or dashboard behavior — this is a visual/copy pass plus
  one net-new feature (password reset), not a functional rewrite of anything
  else.
