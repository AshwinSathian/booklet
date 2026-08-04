# Editor Screen Revamp — Design Spec

> Status: Approved for implementation
> Scope: `/app` (Booklet's editor screen) and its component tree only
> Author: Ashwin Sathian (via Claude)

---

## 1. Problem & Goal

The editor (`/app`) is already a mature, well-built surface: a custom `<textarea>` +
syntax-dimming overlay, a true split-pane live preview, unlimited local drafts, a
formatting toolbar, find/replace, wikilink autocomplete, backlinks/graph view, a publish
flow with slug management, and a settings panel — all built inside Booklet's locked
"Precision" design system (monochrome + single amber accent, Geist Sans/Mono, hairline
borders, one easing curve; see `BRAND.md`).

The goal of this project is to take that already-solid foundation to **world-class**:
sharper interaction design, real fixes for structural debt found during the audit, and a
small number of genuinely delightful additions — without touching the published
`/p/[id]` page, without violating the product's explicit "no WYSIWYG" boundary
(`PRODUCT.md` → "What Booklet Does Not Do"), and without reopening the design-token
system that was deliberately locked 2026-08-01.

### Non-goals

- No change to `/p/[id]` (the published reading page) or its rendering pipeline.
- No CodeMirror 6 / editor-engine rewrite. `PLAN-obsidian-parity.md` scopes this as its
  own future Milestone 2; bolting it onto this pass would conflate two different risk
  profiles. The current textarea+overlay engine is kept as-is.
- No new design tokens (colors, radii, easing curves, font families). Only compositions
  of existing tokens.
- No change to documented product behavior: character limits, publish flow mechanics,
  draft storage model (`localStorage`, never transmitted pre-publish), rate limits.
- No rebinding of `⌘B` away from "New draft" — it's real, documented behavior
  (`PRODUCT.md`'s shortcut table). The `ShortcutsModal` bug here is a documentation bug
  (it advertises Bold/Italic/Inline-code shortcuts that were never wired), fixed by
  correcting the copy, not by adding conflicting keybindings.

---

## 2. Design Principles for This Pass

1. **The engine stays; the experience gets sharper.** Every change composes with the
   existing textarea+overlay, doesn't replace it.
2. **Every new surface earns its keystroke.** `⌘K` and `/` both become more powerful,
   not more numerous — no third new invocation pattern.
3. **Fix what's actually broken before adding what's new.** Duplicate drafts logic,
   phantom shortcuts, and dead PrimeReact wiring get resolved as part of this pass, not
   deferred.
4. **Motion has a job.** Every new animation reuses `EASE_PRECISION` /
   `--ease-spring` and the existing duration tokens. No new easing curves.
5. **Additions must still be "no WYSIWYG."** Anything that inserts or previews content
   inserts real Markdown text the user could have typed by hand.

---

## 3. Changes

### 3.1 Command palette (⌘K) — from 2 items to a real quick-switcher

Currently `CommandPalette.tsx` has one group ("Navigate") with exactly two items. It
becomes the app's central power surface:

- **Groups:** Drafts (fuzzy-searchable by title, recent-first), Actions (New draft,
  Publish / Update page, Toggle focus mode, Open settings, Copy as Markdown, Copy as
  HTML, Import Markdown), Insert (same entries as the slash-menu, §3.2 — lets mouse-off
  keyboard users insert a block without leaving the palette), Navigate (My Pages, back to
  existing entries).
- Selecting a draft switches the active draft (same `onSwitchDraft` path already wired
  in `AppClient.tsx`) and closes the palette with `navigateWithViewTransition`-style
  polish where it's a route change, or a plain state update where it isn't (switching
  drafts is not a route change today — stays that way).
- Drafts are pulled through the same shared hook introduced in §3.4, not a second
  fetch/format of the drafts list.
- Empty-query state shows the 5 most recently edited drafts plus the Actions group —
  never a blank palette.

### 3.2 Slash-insert menu (`/` at cursor) — closes the block-affordance gap

`PLAN-rich-markdown-blocks.md` shipped callout/toggle/columns block types with no editor
affordance, flagged there as an open question. This closes it:

- Typing `/` at the start of a line, or after whitespace, opens an inline popup anchored
  at the caret using the same caret-coordinate math already built for wikilink
  autocomplete (`detectWikilinkTrigger` pattern in `PasteInput.tsx`) — no new
  positioning system.
- Items: Heading 1/2/3, Bullet list, Ordered list, Task list, Quote, Callout (submenu or
  inline variants for the four `CalloutKind`s: note/warning/success/danger — match
  whatever `CalloutKind` actually enumerates in `blocks.ts`), Toggle, Table, Code block,
  Divider, Columns.
- Typing after `/` fuzzy-filters the list; `Escape` or click-away dismisses; `Enter` /
  click inserts the corresponding Markdown snippet via the same `applyFormat`-style
  insertion primitives the toolbar already uses.
- If `/` is typed mid-word (not at a line start / after whitespace), it's just a literal
  character — no trigger. Matches how the wikilink trigger already discriminates context.
- New toolbar button ("Insert block", `+`-style icon) opens the identical menu anchored
  under the button, for mouse-first users — instead of adding 5+ new toolbar icons that
  would clutter the toolbar row (contra BRAND.md's "chrome recedes").

### 3.3 Focus Mode — typewriter scrolling + optional paragraph dimming

- **Typewriter scrolling** (on by default whenever Focus Mode is active): the active
  line is kept vertically centered (~40–45% of viewport height) as the cursor moves or
  the user types. Implemented by computing the caret's line offset and setting
  `textarea.scrollTop` directly — the overlay already mirrors textarea scroll via its
  existing `translateY` sync, so this requires no new sync mechanism.
- **Paragraph dimming** (opt-in, default off): all text outside the current paragraph
  (blank-line-delimited, not sentence-level — sentence detection is fragile and not
  worth the complexity) renders at reduced opacity via the `SyntaxOverlay` layer.
  Discoverable via a toggle in `SettingsPanel` and listed in the command palette /
  shortcuts modal. Off by default so existing Focus Mode users aren't surprised by a
  behavior change.
- Both respect `prefers-reduced-motion` per the existing project-wide rule — typewriter
  scrolling in particular should use instant (not smoothed) scroll adjustment when
  reduced motion is requested, since a smoothed scroll is itself motion.

### 3.4 Structural fixes

- **Drafts UI de-duplication.** Extract a shared `useDraftListActions` hook (rename,
  duplicate, delete-with-confirmation, switch) and a shared `DraftRow` presentational
  component. `DraftsDialog.tsx` (desktop, ⌘D) and `DrawerDraftsView` (mobile drawer)
  both consume these — eliminating the ~150 lines of duplicated logic while keeping both
  entry points, since desktop-modal vs. mobile-drawer chrome is a legitimate difference,
  not duplication. The command palette's Drafts group (§3.1) also consumes the same hook
  for its data, not a third implementation.
- **`ShortcutsModal` correction.** Remove the Bold/Italic/Inline-code entries under
  "Formatting" that were never wired to a keydown handler. The toolbar remains the way
  to apply those — `PRODUCT.md` never promised keyboard shortcuts for them.
- **PrimeReact removal.** Delete `src/app/app/primereact.css`, the import in
  `src/app/app/layout.tsx`, `src/components/ui/PrimeStyles.tsx`, and
  `public/primereact-themes/{light,dark}/theme.css`. Zero components import from
  `primereact` anywhere in the app (`grep -rl "from \"primereact"` confirmed empty), so
  this is a pure deletion, not a migration. `primereact`/`primeicons` can also come out
  of `package.json` if nothing else in the workspace depends on them — verify against
  the other workspace packages before removing from `package.json` itself.

### 3.5 Craft passes

- **Empty-state for a brand-new blank draft.** Replace the bare placeholder with a
  designed hint block (still just the textarea's `placeholder`-equivalent — rendered via
  the overlay layer so it can have real structure, not a single-line HTML placeholder
  attribute): 2–3 short lines teaching `/` to insert a block, `⌘K` for commands, and
  drag-and-drop import — copy following `BRAND.md` voice rules (concrete, no fluff, no
  exclamation marks). Disappears the instant the user types or a file is imported.
- **Mobile Write/Preview tab switch** gets a crossfade/slide transition (reusing
  `--duration-normal` / `EASE_PRECISION`, framer-motion since this is a local state
  toggle, not a route change) instead of an instant swap.
- **Accessibility pass:** audit focus-visible rings on every new interactive element
  against `--color-accent-soft`; ARIA roles/labels on the slash-menu and expanded command
  palette groups (cmdk provides most of this by default — verify, don't assume); confirm
  the transparent-textarea-plus-overlay trick still reads correctly via screen reader
  (the overlay is `aria-hidden`, the real value lives in the textarea — verify this
  holds, it's an audit item not a redesign item unless something's actually broken).

---

## 4. Explicit Non-Goals (repeated for emphasis)

- `/p/[id]` published page: untouched.
- Design tokens (`globals.css` `@theme` block): untouched.
- CodeMirror 6 engine swap: not this project.
- Character/size limits, rate limiting, publish mechanics: untouched.

---

## 5. Testing Approach

This is a UI-heavy, feel-driven project. Automated checks (`tsc --noEmit`, `eslint`,
existing Playwright unit suite) verify correctness and prevent regressions, but the
actual acceptance bar is a manual test loop in a real browser (via the `run` skill /
Playwright MCP) against the local dev server: exercising every new surface (slash-menu
trigger edge cases, palette fuzzy search, typewriter scrolling with reduced-motion on
and off, mobile tab crossfade, drafts de-duplication across both entry points) across
light/dark and desktop/mobile viewport sizes, iterating on feel until it's genuinely
polished — not just functionally correct. This loop is expected to surface small
additional polish opportunities beyond what's enumerated here; taking them is in scope
as long as they stay inside §2's principles and §4's non-goals.

---

## 6. Open Details Deferred to Implementation

These are intentionally left for the implementation/plan step rather than pre-decided
here, since they depend on reading exact current code shapes:

- Exact `CalloutKind` enum values and how the slash-menu should present them (flat list
  vs. one item with a color sub-picker).
- Whether `primereact`/`primeicons` can be fully removed from `package.json` or only
  from the app's runtime wiring (depends on whether `packages/*` workspaces use them).
- Precise caret-coordinate reuse mechanics for the slash-menu (confirm the wikilink
  trigger's positioning utility is generic enough to share, or needs a small extraction).
