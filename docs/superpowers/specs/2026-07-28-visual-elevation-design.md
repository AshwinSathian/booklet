# Booklet Visual Elevation — "The Reveal"

*Design spec — 2026-07-28*

## Why

Booklet's frontend was audited surface-by-surface (landing page, editor, published
page, dashboard, auth, secondary marketing pages) against both its own documented
brand system (`BRAND.md`, the "Ink & Paper" system shipped July 2026) and against
current (2025–2026) top-tier developer-tool design practice. Findings:

- Most of the product executes its *current* brand system competently — the
  published-page typesetting and the API docs page are genuinely strong.
- But the current system, even perfectly executed, still reads as safe: it sits in
  the same "dark mode + one restrained accent" lane as most competing dev tools
  (Linear, Raycast, Vercel, and Booklet's own direct competitors). Research into
  2025–2026 design trends confirms dark-as-default + single accent, kinetic/
  oversized typography, sharper hairline geometry, real interactive demos over
  static mockups, and scroll-driven motion are what currently separate top-tier
  from competent-but-forgettable.
- Concretely, the product has **no signature interactive or motion moment
  anywhere** — all craft is typographic. Landing-page sections repeat one
  eyebrow+H2+card-grid template six-plus times. Three separate macOS
  traffic-light window mockups appear on one page. Auth screens are a generic
  centered card with no brand personality. `/templates` is a plain link list.
- Two concrete, non-stylistic bugs were also found and are in scope to fix
  alongside the redesign: a silent content-corruption bug in the Markdown parser,
  and a stale pre-rename ("Readable") logo hardcoded in two places, appearing on
  every published page and every editor load.

**Product owner direction (2026-07-28):** go beyond incrementally polishing the
existing "Ink & Paper" system — explicit permission to disregard `BRAND.md` where
a better, cooler, more distinctive execution exists, across the full surface area
of the app (marketing site, editor, published pages, dashboard, auth, docs pages),
not a narrow subset.

## Core creative concept: "The Reveal"

Booklet's product promise is turning raw technical Markdown into something a
non-technical reader can actually open and understand. Nothing in the current UI
*shows* that transformation happening — it's only asserted in copy. The new
system makes the transformation the literal, recurring visual mechanic:

- **Write mode** — dark, precise, monospace/grid-driven surfaces: the editor
  chrome, the marketing site's structural background, nav.
- **Read mode** — warm paper, serif display type, generous whitespace: the
  published page (already true today) — now also the *payoff state* of the
  hero's scroll animation, the editor's publish confirmation, and other moments
  where "write" becomes "read."

Paper stops being a two-place-only accent (the old `BRAND.md` rule) and becomes
the product's actual reward state, used with confidence wherever a "reveal"
happens. This gives every surface decision below a reason for existing, instead
of being unrelated redesigns bolted onto a shared token file.

## Foundations

### Color

- **Ink black** `#0a0a0c` — write-mode base surface. Deliberately not pure
  `#000000`: slightly warmer, reads less like generic "dark mode template."
- **Paper** — the existing warm cream (`#f4ecdc` family), promoted from a
  two-place accent to the dominant surface color of every read-mode context.
  Tune a small tonal range (paper / paper-dim / paper-ink-text) rather than a
  single flat swatch, so paper surfaces have their own depth hierarchy the way
  the dark surfaces already do.
- **Accent** — one action/active color, pushed more saturated and alive than the
  current muted burgundy: an oxblood-crimson in the `#c2334a`-ish range, retuned
  for WCAG AA against both ink-black and paper. Same discipline as before — accent
  is for actions and active states only, never decoration — just a more confident
  hex, verified with real contrast math (not eyeballed) before locking.
- Exact hex values, full light/dark token tables, and measured contrast ratios are
  an implementation-time task, not fixed by this spec — the constraint is the
  *role* system above and the AA-contrast bar, not specific numbers.

### Typography

- **Fraunces** (variable, optical-size axis, characterful — soft-contrast serif
  with real personality) becomes the single editorial typeface: hero and section
  display headlines *and* published-page long-form body copy, flexing across its
  optical-size axis rather than mixing two separate serif families (the old
  system's Inter-black-headline + Source-Serif-4-body split). One distinctive
  serif voice used at every size, instead of a generic grotesk for display and a
  safe workhorse serif for reading.
- **Inter** remains for UI chrome only — nav, buttons, form controls, the editor
  textarea, dashboard tables. It should stay invisible there; if a UI-chrome
  element starts asking for "personality," that's a sign it should be using
  Fraunces or it's over-scoped, not that Inter needs a heavier weight.
- **JetBrains Mono** (→ Fira Code → Cascadia Code → SF Mono) stays for code, as
  today.
- Self-host Fraunces via `next/font` the same way the current fonts are loaded.

### Geometry

- Replace soft blurred glow-shadows (`--shadow-glass`, `--shadow-glow`, the
  large-blur card shadows) with crisp 1px hairline borders as the primary depth
  cue, plus occasional hard offset shadows (no blur) for a printed/engineered
  feel rather than the ambient-glow look most competing dark-mode SaaS sites
  share.
- Literal print motifs (thin registration-style rules, a folded-corner
  interaction on cards) are permitted where they reinforce the paper concept,
  used sparingly — not decoration for its own sake, and never a second
  competing accent.

### Motion

- **Signature moment:** a scroll-scrubbed hero transformation. As the user
  scrolls the hero, visible Markdown syntax marks (`#`, `**`, backticks) in a
  block of sample text visibly dissolve while the text reflows from
  monospace/dark styling into Fraunces/paper styling — literally dramatizing the
  product's core promise, driven by scroll position (not autoplay).
- Kinetic display type (weight/position shifting on load or scroll) replaces
  static fade-ups specifically for hero-level headlines. Standard fade-up/stagger
  motion (as documented in the old `BRAND.md` motion section — durations, easing
  curves) continues to govern lower-priority content; it doesn't need
  reinventing, only the hero-level treatment does.
- `prefers-reduced-motion` must resolve every new scroll-driven or kinetic effect
  to its end state instantly — no scroll-jacking, no motion-only affordances.
  This is a hard requirement, not a nice-to-have, given these are new,
  more elaborate effects than the current fade-ups.

## Per-surface plan

### Landing (`/`)

- New hero built around the live transformation scroll effect, replacing the
  static macOS-window mockup. Cut the other two macOS traffic-light window
  mockups elsewhere on the page (found in the audit) — this device is one of
  the most common SaaS-template patterns in existence and using it 3× on one
  page reads as filler.
- De-templatize the repeated eyebrow+H2+card-grid section pattern (currently
  used 6+ times) — each section needs a visually distinct treatment. Example:
  "How it works" becomes a horizontal, scroll-linked sequence instead of a 4-up
  numbered-card row.
- Fix two concrete audit findings: the mobile hero headline's two-tone
  white/gradient line break lands mid-line at 390px instead of at the intended
  line break; the Integrations section's "Claude" card is visually heavier than
  the adjacent "Terminal"/"GitHub Actions" cards in the same row.

### Editor (`/app`)

- The writing surface gets real craft: Markdown syntax characters in the
  textarea are visually dimmed/de-emphasized relative to content, foreshadowing
  the write→read transformation rather than rendering as flat, undifferentiated
  monospace text.
- Hitting Publish triggers a compressed version of the hero's dark→paper reveal
  as the confirmation moment, replacing the current plain top-bar-swap-to-copy-link
  state.

### Published page (`/p/[id]`)

- This is already the strongest-typeset surface in the product — preserve that,
  don't rebuild it from scratch. Sharpen the chrome around it: apply the new
  hairline-rule geometry to the share/reactions/TOC bar.
- Fix the stale pre-rename logo bug found in the audit: `src/app/p/[id]/page.tsx`
  (~line 271-276) and `src/components/ui/AppLoader.tsx` (~line 97-112) both
  hardcode a literal "R" glyph SVG path left over from the "Readable" name,
  instead of importing the canonical mark from `src/components/ui/AppLogo.tsx`.
  This appears on every published page and every editor load.

### Auth (`/sign-in`, `/sign-up`)

- Replace the generic centered-card layout with a split layout: a dark editorial
  side showing a live example transformation snippet, beside the form. Currently
  the single most generic-looking screen in the product relative to the
  landing page's confidence.

### Dashboard (`/my-pages`) and secondary marketing pages

- Re-skin `/my-pages`, `/pricing`, `/changelog`, `/api-docs`, `/about` onto the
  new tokens and type system. `/api-docs` is already well-executed structurally
  (sidebar TOC, clear endpoint blocks) — it needs re-skinning, not rebuilding.
- `/templates` specifically upgrades from a plain 2-column link list to a visual
  gallery of mini paper-page previews of each template, consistent with the new
  paper-as-material-language approach — this is the clearest remaining "flat,
  functional-only" surface found in the audit.
- If dashboard analytics visualizations (charts) are touched during this phase,
  follow the project's `dataviz` skill for chart/palette treatment rather than
  ad hoc styling.

## Also in scope (non-stylistic, found during audit)

1. **Silent content-corruption bug** — `src/lib/parse.ts` registers
   `remarkDirective` and only handles `containerDirective` nodes; it never
   handles or escapes remark-directive's inline `textDirective` (`:word`)
   syntax, so any real prose containing `word:word` patterns with no space
   (times like `10:42`, ratios like `16:9`, references like `John 3:16`) is
   silently deleted with no error, on the published artifact itself. Fix:
   handle/passthrough `textDirective` nodes in the parser instead of leaving
   them unhandled.
2. **Stale logo bug** — see Published Page section above.

## Explicitly out of scope

- No changes to backend/API logic beyond the parser fix above.
- No changes to the admin surface (`/admin`) — not reviewed in the audit, not
  requested.
- No account/auth *logic* changes — this is a visual redesign of the auth
  *screens*, not the auth flow or session model.
- Exact color hex values, font-loading config, and animation implementation
  details are intentionally left to implementation — this spec fixes the design
  *system and rationale*, not final numbers.

## Rollout

Given the full-sweep scope, implementation should be sequenced as independently
reviewable/shippable phases rather than one monolithic change:

1. Foundations (tokens, fonts, geometry primitives) + the two bundled bug fixes
2. Landing page
3. Editor (`/app`)
4. Published page (`/p/[id]`)
5. Auth screens
6. Dashboard + secondary marketing pages
7. Cross-surface QA pass (all phases, both themes, desktop + mobile)

The implementation plan (next step, via the `writing-plans` skill) should turn
this into concrete milestones along these phase lines.

## Verification plan

- Playwright screenshot pass across dark/light themes and desktop (1440px) /
  mobile (390px) viewports, per surface, before/after comparison.
- `tsc --noEmit`, `eslint`, and the existing Playwright unit suite
  (`test:unit`) must continue to pass.
- Manual verification of `prefers-reduced-motion` behavior and keyboard/focus
  paths specifically for the new hero scroll effect, kinetic type, and publish
  reveal — these are new interactive surfaces without existing test coverage.
- Re-verify WCAG AA contrast for the retuned accent color against both new
  background roles (ink-black, paper), the same way the current `BRAND.md`
  documents doing for the existing accent.
