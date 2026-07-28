# Booklet Visual Elevation ("The Reveal") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Read the design spec first:** `docs/superpowers/specs/2026-07-28-visual-elevation-design.md` — it has the full rationale ("The Reveal" concept, why each surface changes) this plan only summarizes. `BRAND.md` documents the *previous* system; the product owner has explicitly authorized disregarding it wherever this plan's direction differs — do not "fix" a task's output back toward BRAND.md.

**Goal:** Elevate Booklet's frontend from a competently-executed but generic dark-mode-plus-accent SaaS look to a distinctive, showcase-worthy visual identity built around one recurring idea — raw technical text visibly transforming into a warm, paper-typeset reading page — plus fix two bugs found during the design audit (silent content corruption in the Markdown parser, a stale pre-rename logo).

**Architecture:** Foundation-first sequencing: design tokens, fonts, and the two bug fixes land before any surface redesign, because every later task consumes them. Surfaces are then done in descending order of user-facing impact (landing → editor → published page → auth → dashboard/secondary pages), each independently shippable. A final cross-surface QA task closes the plan.

**Tech Stack:** Next.js 16 (App Router), React 19, Tailwind CSS v4 (CSS-first `@theme`, no JS config extension needed for tokens), framer-motion, next/font/google, Playwright (also used as the unit test runner — see `tests/unit/*.spec.ts`).

## Global Constraints

- Tailwind v4 tokens live in `src/app/globals.css` under `@theme` / `:root` / `html.light` — there is no color/font extension in `tailwind.config.ts`; do not add one.
- Every new or changed color pairing must meet WCAG AA (4.5:1 for body text, 3:1 for large text ≥24px/UI components) — compute with the standard relative-luminance formula, don't eyeball. `docs/superpowers/specs/2026-07-28-visual-elevation-design.md`'s Foundations section has the target roles.
- `prefers-reduced-motion: reduce` must resolve every new scroll-driven/kinetic effect to its end state instantly — this is enforced globally in `src/app/globals.css` (~line 405) for CSS animations already; new framer-motion effects must call `useReducedMotion()` themselves (existing pattern — see `src/components/marketing/Landing.tsx:123`, `reduce ? undefined : fadeUp`).
- Existing motion durations/easing curves (`--duration-fast/normal/slow/deliberate`, `--ease-spring/smooth/bounce` in `globals.css` ~line 234-240) stay as the base vocabulary for anything not explicitly redesigned by this plan.
- `npm run test` (`tsc --noEmit`), `npm run lint`, and `npm run test:unit` (Playwright, config `playwright.unit.config.ts`) must all pass before any task is considered done.
- No backend/API logic changes except the parser fix in Task 1. No changes to `/admin` or auth session logic.
- Dev server: `npm run dev` (Turbopack). If port 3000 is occupied, Next.js auto-selects the next free port — check its stdout for the actual URL before using Playwright against it.

---

### Task 1: Fix silent content-corruption bug in the Markdown parser

**Files:**
- Modify: `src/lib/parse.ts` (add a `textDirective` case to `inlineFromNodes`, ~line 184, right before the `case "break":` at line 206)
- Test: `tests/unit/parse-blocks.spec.ts` (append new `test.describe` block)

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: nothing other tasks depend on — this is an isolated correctness fix.

**Context:** `remarkDirective` (registered in `parseToBlocks`, `parse.ts:568`) adds support for `:::containerDirective` blocks (handled at `parse.ts:500`) *and* inline `:textDirective` syntax (`:name[content]{attrs}` or bare `:name`). `inlineFromNodes`'s switch statement never has a `case "textDirective"`, so it falls to the `default` branch at `parse.ts:209-211`, which only recurses into `n.children` if present — a bare `:word` directive has no children, so it produces nothing and is silently dropped. Since remark-directive's tokenizer treats *any* `:` immediately followed by a valid directive-name character (letters, digits, `-`, `_`, no space) as a directive opener, ordinary prose like `"at 10:42am"`, `"a 16:9 ratio"`, or `"John 3:16"` gets tokenized as a (nameless-content) directive and eaten.

Booklet doesn't use inline text directives for anything (only `:::toggle` and `:::columns` container directives are supported, per `parse.ts:343-430`), so the correct fix is to make `textDirective` degrade to its literal source text instead of vanishing — the same "unsupported syntax survives as plain text" philosophy already used for wikilinks and unrecognized callout kinds elsewhere in this file.

- [ ] **Step 1: Write the failing tests**

Append to `tests/unit/parse-blocks.spec.ts`:

```ts
test.describe("inline text-directive syntax is not silently eaten", () => {
  test("a bare colon+digits fragment (time-of-day) survives as plain text", () => {
    const b = firstBlock("Deploy completed at 10:42am.");
    expect(b.t).toBe("paragraph");
    if (b.t === "paragraph") {
      const text = b.inl.map((i) => (i.t === "text" ? i.v : "")).join("");
      expect(text).toBe("Deploy completed at 10:42am.");
    }
  });

  test("a ratio like 16:9 survives as plain text", () => {
    const b = firstBlock("The aspect ratio is 16:9 on this display.");
    expect(b.t).toBe("paragraph");
    if (b.t === "paragraph") {
      const text = b.inl.map((i) => (i.t === "text" ? i.v : "")).join("");
      expect(text).toBe("The aspect ratio is 16:9 on this display.");
    }
  });

  test("a scripture-style reference like John 3:16 survives as plain text", () => {
    const b = firstBlock("See John 3:16 for reference.");
    expect(b.t).toBe("paragraph");
    if (b.t === "paragraph") {
      const text = b.inl.map((i) => (i.t === "text" ? i.v : "")).join("");
      expect(text).toBe("See John 3:16 for reference.");
    }
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx playwright test --config=playwright.unit.config.ts parse-blocks -g "text-directive"`
Expected: FAIL — actual text is missing the `:42am`/`:9`/`:16` fragments (e.g. `"Deploy completed at 10 am."` — note remark-directive also eats trailing directive-name characters `42am`/`9`/`16`, leaving a mangled string).

- [ ] **Step 3: Implement the fix**

In `src/lib/parse.ts`, add a case to the switch in `inlineFromNodes` (insert immediately before the existing `case "break":` at line 206). A `textDirective` mdast node has an `mdast-util-directive`-specific shape not covered by the local `MdNode` type — read its raw source span back out rather than trying to type its directive-specific fields:

```ts
      case "textDirective": {
        // Booklet has no inline text-directive syntax (only :::container
        // directives — see the "Directive containers" section below) so a
        // `:name`/`:name[...]`/`:name{...}` fragment reaching here is
        // always ordinary prose remark-directive misparsed (a colon
        // immediately followed by directive-name characters, e.g. a time
        // "10:42", a ratio "16:9", a reference "John 3:16" — anything
        // matching /:[A-Za-z0-9_-]/  with no preceding space requirement).
        // Degrade to literal source text instead of silently dropping it,
        // same "unsupported syntax survives as plain text" rule already
        // applied to wikilinks and unrecognized callout kinds in this file.
        const directiveNode = n as unknown as {
          name?: unknown;
          children?: MdNode[];
          attributes?: Record<string, string> | null;
        };
        const name = typeof directiveNode.name === "string" ? directiveNode.name : "";
        const label = plainTextFromNodes(directiveNode.children ?? []);
        let literal = `:${name}`;
        if (label) literal += `[${label}]`;
        if (directiveNode.attributes && Object.keys(directiveNode.attributes).length > 0) {
          const attrs = Object.entries(directiveNode.attributes)
            .map(([k, v]) => `${k}=${v}`)
            .join(" ");
          literal += `{${attrs}}`;
        }
        out.push({ t: "text", v: literal });
        break;
      }
```

This reconstructs the directive's own source syntax as literal text (`:name[label]{attrs}`) rather than the original raw prose fragment (mdast doesn't retain the original source slice on directive nodes) — for the plain `:word` case (the one that corrupts times/ratios/references), `name` alone reconstructs it exactly since there's no label/attrs to lose. Update the doc comment above `plainTextFromNodes` (`parse.ts:363`) is not required — it's already generic enough to reuse here unchanged.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx playwright test --config=playwright.unit.config.ts parse-blocks -g "text-directive"`
Expected: PASS (all 3 new tests), and re-run the full suite to confirm no regressions: `npm run test:unit`

- [ ] **Step 5: Verify the fix in the live editor**

Start `npm run dev`, open `/app`, paste `"The ratio is 16:9 and the meeting is at 10:42am. See John 3:16 for reference."` into the editor, and confirm the live preview pane renders the sentence verbatim with no dropped fragments.

- [ ] **Step 6: Commit**

```bash
git add src/lib/parse.ts tests/unit/parse-blocks.spec.ts
git commit -m "$(cat <<'EOF'
fix(parse): stop remark-directive from silently eating word:word text

Bare colon+alphanumeric fragments (times, ratios, scripture references)
were tokenized as inline text directives and dropped with no error,
corrupting published content. Degrade to literal source text instead,
matching how unsupported wikilink/callout syntax already degrades.
EOF
)"
```

---

### Task 2: Fix the stale pre-rename ("Readable") logo

**Files:**
- Modify: `src/app/p/[id]/page.tsx` (~lines 271-280)
- Modify: `src/components/ui/AppLoader.tsx` (~lines 97-112)
- Modify: `src/components/ui/AppLogo.tsx` (export the inner mark so it can be reused standalone, not just wrapped in the `<Link>`)

**Interfaces:**
- Consumes: nothing.
- Produces: `BookletMark` exported from `src/components/ui/AppLogo.tsx` as `{ size?: number }` → `ReactNode` — Task 2 only, but keep this export stable since later tasks (7, 8) may also want the bare mark without the `<Link>` wrapper.

**Context:** Both files hardcode an identical literal SVG `<path>` drawing a stylized "R" glyph (leftover from the product's former name "Readable"), instead of the current folded-page mark defined once in `AppLogo.tsx`. `AppLogo.tsx` currently only exports `AppLogo` (mark + wordmark, wrapped in a `<Link href="/">`) — neither call site wants a link (the loader isn't navigable; the published-page footer already has its own separate "Write your own page" link), so extract the bare mark as its own export first.

- [ ] **Step 1: Export the bare mark from `AppLogo.tsx`**

In `src/components/ui/AppLogo.tsx`, rename the local `BookletMark` function to be exported (change `function BookletMark(...)` at line 6 to `export function BookletMark(...)`), keeping its body and the existing internal usage in `AppLogo` (line 31, `<BookletMark size={28} />`) unchanged.

- [ ] **Step 2: Replace the stale SVG in the published-page footer**

In `src/app/p/[id]/page.tsx`, add the import:

```ts
import { BookletMark } from "@/components/ui/AppLogo";
```

Replace the hardcoded `<svg>` block at ~lines 271-280 (the one starting `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden className="shrink-0">` and ending at the closing `</svg>` before `<div>` at line 281) with:

```tsx
<BookletMark size={20} />
```

- [ ] **Step 3: Replace the stale SVG in `AppLoader.tsx`**

In `src/components/ui/AppLoader.tsx`, add the import:

```ts
import { BookletMark } from "@/components/ui/AppLogo";
```

Replace the hardcoded `<svg>` block at lines 97-112 (`<svg width="56" height="56" ...>` through its closing `</svg>`) with:

```tsx
<BookletMark size={56} />
```

The surrounding ambient-glow `<div>` (lines 85-96) and its wrapping `relative flex items-center justify-center` container stay unchanged — only the inner `<svg>` is swapped.

- [ ] **Step 4: Verify visually**

Start `npm run dev` (or reuse a running instance). Load `/app` directly (hard refresh, so the boot splash fires) and confirm the folded-page mark appears, not the old "R" glyph. Publish any test document and open its `/p/[id]` URL; confirm the footer shows the folded-page mark. Check both dark and light themes.

- [ ] **Step 5: Run typecheck and commit**

Run: `npm run test` (tsc --noEmit) — must pass with no new errors.

```bash
git add src/components/ui/AppLogo.tsx src/app/p/\[id\]/page.tsx src/components/ui/AppLoader.tsx
git commit -m "$(cat <<'EOF'
fix(brand): replace stale pre-rename "R" logo with the current mark

Both the published-page footer and the editor's boot-splash overlay
hardcoded a literal "R" glyph SVG left over from the product's former
name ("Readable"), instead of the current folded-page mark — visible
on every published page and every editor load. Extract the mark as a
reusable BookletMark export and use it in both places.
EOF
)"
```

---

### Task 3: Foundation tokens — ink/paper palette, retuned accent, Fraunces display type

**Files:**
- Modify: `src/app/globals.css` (`:root`, `html.light`, `@theme` blocks)
- Modify: `src/app/layout.tsx` (font loading)
- Create: `scripts/check-contrast.mjs` (one-off contrast verifier, run manually — not wired into CI by this task)

**Interfaces:**
- Consumes: nothing.
- Produces (every later surface task consumes these exact token/class names):
  - New CSS custom properties: `--color-paper-dim`, `--color-paper-ink`, `--color-paper-ink-secondary`, `--shadow-print` (dark + light values each).
  - Changed values: `--color-bg` (dark only), `--color-accent` / `--color-accent-hover` / `--color-accent-soft` (dark + light).
  - New Tailwind utilities (via `@theme`): `bg-paper-dim`, `text-paper-ink`, `text-paper-ink-secondary`, `shadow-print`.
  - New font: `--font-display` CSS variable resolving to Fraunces, plus two helper classes `.font-display-hero` (`font-variation-settings: "opsz" 144`) and `.font-display-body` (`"opsz" 20`) in `globals.css`.

**Context:** Read the "Foundations" section of `docs/superpowers/specs/2026-07-28-visual-elevation-design.md` for the full rationale before changing values. Tailwind v4 in this repo binds every color/font/shadow token through `@theme` in `globals.css:172-241`, mapping straight from the `:root`/`html.light` custom properties defined just above it (`globals.css:21-165`) — follow that exact existing pattern (define the raw value in `:root` and `html.light`, then bind it 1:1 in `@theme`) for every new token, don't invent a second mechanism.

- [ ] **Step 1: Add the paper surface tones**

In `src/app/globals.css`, in `:root` (dark mode block), immediately after the existing `--color-paper: #f4ecdc;` line (~line 88), add:

```css
  /* Paper surface tones — promoted from a two-place accent (old BRAND.md
     "Signature Element" rule) to the dominant read-mode surface. See "The
     Reveal" in docs/superpowers/specs/2026-07-28-visual-elevation-design.md. */
  --color-paper-dim:           #e9dfc8;  /* secondary paper surface, hover states */
  --color-paper-ink:           #1d1a14;  /* primary text ON a paper surface */
  --color-paper-ink-secondary: #5c5546;  /* secondary text ON a paper surface */
```

Add the identical three lines to `html.light`'s block, immediately after its own `--color-paper: #f4ecdc;` line (~line 139) — paper is a print-referencing tone, deliberately identical in both themes (this matches the existing `--color-paper` comment already there), so these three values are the same in both blocks.

- [ ] **Step 2: Retune the accent**

In `:root`, replace lines 78-80:

```css
  --color-accent:       #a12f3e;          /* Booklet ink — action/active       */
  --color-accent-hover: #8a2230;
  --color-accent-soft:  #e5808a;          /* for focus rings, secondary tints  */
```

with:

```css
  --color-accent:       #c2334a;          /* Booklet ink — action/active       */
  --color-accent-hover: #a82940;
  --color-accent-soft:  #ec8a95;          /* for focus rings, secondary tints  */
```

In `html.light`, replace lines 134-136:

```css
  --color-accent:       #ab4252;
  --color-accent-hover: #953649;
  --color-accent-soft:  #c25a6b;
```

with:

```css
  --color-accent:       #c23c50;
  --color-accent-hover: #a52f42;
  --color-accent-soft:  #d16577;
```

- [ ] **Step 3: Deepen the write-mode base**

In `:root`, change line 54 from `--color-bg: #000000;` to `--color-bg: #0a0a0c;`. Leave `html.light`'s `--color-bg: #ffffff;` unchanged (paper/white are already the light-mode read-mode surface — there's no separate "write mode" to deepen in light theme). Also update `src/app/layout.tsx`'s dark `themeColor` meta (line 110, `{ media: "(prefers-color-scheme: dark)", color: "#000000" }`) to `"#0a0a0c"` so the browser chrome color matches.

- [ ] **Step 4: Add the hairline/print shadow token**

In `:root`, immediately after the existing `--shadow-card` line (~line 108), add:

```css
  --shadow-print: 0 2px 0 0 rgba(0, 0, 0, 0.9);   /* hard offset, no blur — printed-card feel */
```

In `html.light`, immediately after its own `--shadow-card` line (~line 159), add:

```css
  --shadow-print: 0 2px 0 0 rgba(0, 0, 0, 0.12);
```

This is additive — do not remove or reassign `--shadow-glass`/`--shadow-glow`/`--shadow-soft`/`--shadow-card`; they stay defined for any component not touched by this plan. `--shadow-print` is what new/redesigned components (Tasks 4-10) should reach for instead.

- [ ] **Step 5: Bind the new tokens in `@theme`**

In `src/app/globals.css`'s `@theme` block, immediately after the existing `--color-paper: var(--color-paper);` line (~line 190), add:

```css
  --color-paper-dim:           var(--color-paper-dim);
  --color-paper-ink:           var(--color-paper-ink);
  --color-paper-ink-secondary: var(--color-paper-ink-secondary);
```

Immediately after the existing `--shadow-card: var(--shadow-card);` line (~line 210), add:

```css
  --shadow-print: var(--shadow-print);
```

This makes `bg-paper-dim`, `text-paper-ink`, `text-paper-ink-secondary`, and `shadow-print` available as Tailwind utility classes, following the exact existing binding pattern for every other token in this file.

- [ ] **Step 6: Load Fraunces and wire up `--font-display`**

In `src/app/layout.tsx`, add to the `next/font/google` imports (line 5): `Fraunces` alongside the existing `Inter, Source_Serif_4`. Add a new font instance below the existing `sourceSerif4` declaration (~line 28):

```ts
// Editorial display typeface — hero/section headlines and (via a lower
// optical-size setting) published-page body copy, see --font-display in
// globals.css and "The Reveal" in
// docs/superpowers/specs/2026-07-28-visual-elevation-design.md. Fraunces'
// opsz/SOFT/WONK variable axes are exposed via next/font's `axes` option.
const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "900"],
  style: ["normal", "italic"],
  axes: ["opsz", "SOFT", "WONK"],
  variable: "--font-fraunces",
  display: "swap",
});
```

Add `fraunces.variable` to the `className` string on the `<html>` element (line 124): `` `${inter.variable} ${sourceSerif4.variable} ${fraunces.variable}` ``.

In `src/app/globals.css`, in `:root` (~line 29, right after the existing `--font-reading` line), add:

```css
  --font-display: var(--font-fraunces), Georgia, "Times New Roman", serif;
```

Bind it in `@theme` immediately after the existing `--font-reading: var(--font-reading);` line (~line 215): `--font-display: var(--font-display);` — this makes `font-display` available as a Tailwind utility.

Immediately after the `@theme { ... }` block that defines motion tokens (after line 241, before the `html, body { ... }` rule at line 243), add two helper classes for the optical-size axis (Tailwind's `font-variation-settings` isn't exposed as a utility, so these stay hand-written CSS, same as the existing `@keyframes` blocks below them):

```css
/* Fraunces optical-size helpers — see --font-display above. Hero/hero-scale
   display type wants the highest-contrast, most characterful optical
   master (144); body-scale reading wants the low-contrast text master
   (20) so it doesn't feel overwrought at paragraph size. */
.font-display-hero {
  font-variation-settings: "opsz" 144;
}
.font-display-body {
  font-variation-settings: "opsz" 20;
}
```

- [ ] **Step 7: Verify contrast on the retuned accent**

Create `scripts/check-contrast.mjs`:

```js
// One-off WCAG contrast verifier for docs/superpowers/specs/2026-07-28-visual-elevation-design.md's
// retuned accent. Run manually: node scripts/check-contrast.mjs
function relLuminance(hex) {
  const c = hex.replace("#", "").match(/.{2}/g).map((h) => parseInt(h, 16) / 255);
  const [r, g, b] = c.map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(hexA, hexB) {
  const [l1, l2] = [relLuminance(hexA), relLuminance(hexB)].sort((a, b) => b - a);
  return (l1 + 0.05) / (l2 + 0.05);
}
const pairs = [
  ["dark accent text on ink-bg", "#c2334a", "#0a0a0c", 4.5],
  ["dark white-on-accent (button label)", "#ffffff", "#c2334a", 4.5],
  ["dark accent-soft on ink-bg", "#ec8a95", "#0a0a0c", 4.5],
  ["light accent text on white", "#c23c50", "#ffffff", 4.5],
  ["light white-on-accent (button label)", "#ffffff", "#c23c50", 4.5],
  ["paper-ink text on paper", "#1d1a14", "#f4ecdc", 4.5],
  ["paper-ink-secondary text on paper", "#5c5546", "#f4ecdc", 4.5],
];
let failed = false;
for (const [label, fg, bg, min] of pairs) {
  const ratio = contrast(fg, bg);
  const pass = ratio >= min;
  if (!pass) failed = true;
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}: ${ratio.toFixed(2)}:1 (min ${min}:1)`);
}
process.exit(failed ? 1 : 0);
```

Run: `node scripts/check-contrast.mjs`
Expected: all rows PASS. If any FAIL, darken/lighten that specific hex (adjust `--color-accent`/`--color-accent-soft` in the relevant theme block, or `--color-paper-ink`/`--color-paper-ink-secondary`) and re-run until all pass — do not proceed to Step 8 with a failing row.

- [ ] **Step 8: Visual smoke test**

Start `npm run dev`, load `/`, and confirm: the page still renders (no CSS parse errors), the background reads as a very slightly warmer near-black than before (subtle, not a visible jump), buttons/links use the new accent, and Fraunces loads (inspect a heading element's computed `font-family` in devtools — should list the Fraunces variable font before the `Georgia` fallback). No layout should be visibly different yet — this task only changes token values, not any component's markup.

- [ ] **Step 9: Run full verification and commit**

Run: `npm run test && npm run lint`
Expected: both pass.

```bash
git add src/app/globals.css src/app/layout.tsx scripts/check-contrast.mjs
git commit -m "$(cat <<'EOF'
feat(design): foundation tokens for "The Reveal" visual system

Adds paper surface tones (paper-dim, paper-ink, paper-ink-secondary),
retunes the accent to a more saturated oxblood-crimson, deepens the
dark-mode base to a warmer near-black, adds a hairline/print shadow
token, and loads Fraunces as the new editorial display typeface
alongside a WCAG contrast verification script. Additive only — no
component markup changes yet. See
docs/superpowers/specs/2026-07-28-visual-elevation-design.md.
EOF
)"
```

---

### Task 4: Landing hero — the scroll-driven transformation ("The Reveal")

**Files:**
- Create: `src/components/marketing/RevealHero.tsx`
- Modify: `src/components/marketing/Landing.tsx` (hero section, ~lines 858-990, and remove the now-unused `HeroMock` function at ~lines 308-441 once nothing references it)

**Interfaces:**
- Consumes: `--color-bg`, `--color-paper`, `--color-paper-ink`, `font-display`/`.font-display-hero`, `--color-accent` from Task 3.
- Produces: `RevealHero` component, no props (self-contained, reads its own scroll position) — exported for potential reuse, but only consumed by `Landing.tsx` in this plan.

**Context:** This is the plan's signature deliverable — read "Core creative concept" in `docs/superpowers/specs/2026-07-28-visual-elevation-design.md` before building it. The mechanic: a fixed sample of Markdown source text is shown in monospace on the dark background; as the user scrolls through the hero's height, syntax marks (`#`, `**`, `` ` ``) fade out and the surrounding text's styling interpolates from monospace/dark to Fraunces/paper, driven by scroll progress through the hero section (not autoplay, not on a timer). It replaces `HeroMock` (the current static macOS-window mockup) as the hero's visual centerpiece.

- [ ] **Step 1: Build the scroll-progress hook and static text plan**

Create `src/components/marketing/RevealHero.tsx`:

```tsx
"use client";

import {
  useReducedMotion,
  useScroll,
  useTransform,
  useMotionTemplate,
  useMotionValue,
  motion,
} from "framer-motion";
import { useRef } from "react";

// Fixed sample — deliberately not derived from live user content: this is a
// marketing demonstration of the transformation, not a live preview.
// Segments alternate between literal Markdown syntax (dimmed/dissolved as
// scroll progresses) and the prose it wraps (restyled from mono to
// Fraunces/paper as scroll progresses). See "Core creative concept" in
// docs/superpowers/specs/2026-07-28-visual-elevation-design.md.
type Segment = { text: string; kind: "syntax" | "prose" };

const SAMPLE: Segment[] = [
  { text: "## ", kind: "syntax" },
  { text: "Incident Report", kind: "prose" },
  { text: "\n\n", kind: "syntax" },
  { text: "**", kind: "syntax" },
  { text: "Severity:", kind: "prose" },
  { text: "** P1, ", kind: "syntax" },
  { text: "resolved in 13 minutes.", kind: "prose" },
];

export function RevealHero() {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  // Reduced-motion: skip straight to the fully-revealed (paper) end state,
  // no scroll-driven interpolation at all. Both motion values are always
  // created (never call hooks conditionally — see Rules of Hooks); which
  // one drives the animation is picked afterward.
  const revealedProgress = useMotionValue(1);
  const progress = reduce ? revealedProgress : scrollYProgress;
  const syntaxOpacity = useTransform(progress, [0, 0.6], [1, 0]);
  const fontWeight = useTransform(progress, [0, 1], [400, 500]);

  // framer-motion's built-in color interpolation (useTransform between two
  // color strings) needs literal color values to mix numerically — it can't
  // blend two `var(--color-x)` references, which is what every color in
  // this codebase's token system is. Compositing the mix via CSS
  // `color-mix()` instead — evergreen-baseline supported (Chrome 111+,
  // Safari 16.4+, Firefox 113+) — lets the browser do the actual blend
  // while still reading the live theme-aware custom properties, so this
  // works correctly in both dark and light mode with zero theme branching.
  const mixPct = useTransform(progress, (p) => `${Math.round(p * 100)}%`);
  const containerBg = useMotionTemplate`color-mix(in srgb, var(--color-paper) ${mixPct}, var(--color-bg))`;
  const proseColor = useMotionTemplate`color-mix(in srgb, var(--color-paper-ink) ${mixPct}, var(--color-text-primary))`;

  return (
    <div ref={ref} className="relative h-[130vh] sm:h-[160vh]">
      <div className="sticky top-0 flex h-screen items-center justify-center overflow-hidden">
        <motion.div
          style={{ backgroundColor: containerBg }}
          className="flex h-full w-full items-center justify-center rounded-none border-y border-border-subtle px-6"
        >
          <motion.p
            style={{ color: proseColor, fontWeight }}
            className="max-w-2xl text-[clamp(20px,3.4vw,32px)] leading-normal font-display font-display-hero"
          >
            {SAMPLE.map((seg, i) =>
              seg.kind === "syntax" ? (
                <motion.span
                  key={i}
                  style={{ opacity: syntaxOpacity }}
                  className="font-mono text-[0.75em] text-text-muted"
                >
                  {seg.text}
                </motion.span>
              ) : (
                <span key={i}>{seg.text}</span>
              ),
            )}
          </motion.p>
        </motion.div>
      </div>
    </div>
  );
}
```

The root `<div>`'s `h-[130vh] sm:h-[160vh]` already gives mobile a shorter scroll-driven region than desktop — Step 4 below verifies this is enough, and only changes the class further if it isn't.

- [ ] **Step 2: Wire it into the hero section**

In `src/components/marketing/Landing.tsx`, locate the current hero's mock element — search for where `<HeroMock` is rendered (inside the `export function Landing()` body, near the hero copy/CTAs around lines 858-990). Replace that `<HeroMock />` usage with `<RevealHero />`, and add the import: `import { RevealHero } from "@/components/marketing/RevealHero";`.

Once no other reference to `HeroMock` remains in the file, delete the `function HeroMock() { ... }` definition (~lines 308-441) entirely — it's now dead code, not kept as a fallback.

- [ ] **Step 3: Verify in the browser**

Start `npm run dev`, load `/` in a 1440×900 viewport, and scroll slowly through the hero. Confirm: the syntax marks (`##`, `**`) visibly fade out, the background tints from dark to paper, and the text weight/color shift feels continuous (not stepped/janky) as you scroll. Then set `prefers-reduced-motion: reduce` (devtools → Rendering tab → "Emulate CSS media feature prefers-reduced-motion") and reload — confirm the hero renders instantly in its fully-revealed (paper) state with no scroll-jacking or animation.

- [ ] **Step 4: Mobile check**

Resize to 390×844. Confirm the hero text remains legible (doesn't overflow horizontally) and the shorter `h-[130vh]` mobile scroll region (vs. `h-[160vh]` on `sm:` and up) doesn't feel like an awkwardly long blank scroll before the reveal completes — if it still does, shorten the mobile value further (e.g. `h-[115vh]`).

- [ ] **Step 5: Run verification and commit**

Run: `npm run test && npm run lint`

```bash
git add src/components/marketing/RevealHero.tsx src/components/marketing/Landing.tsx
git commit -m "$(cat <<'EOF'
feat(marketing): scroll-driven hero transformation ("The Reveal")

Replaces the static macOS-window hero mockup with a scroll-scrubbed
animation that visibly dissolves Markdown syntax while the sample text
restyles from mono/dark to Fraunces/paper — dramatizing the product's
actual promise instead of a generic SaaS device. Resolves instantly to
the end state under prefers-reduced-motion.
EOF
)"
```

---

### Task 5: De-templatize the landing page

**Files:**
- Modify: `src/components/marketing/Landing.tsx`

**Interfaces:**
- Consumes: `RevealHero` (Task 4, already wired into the hero by that task — this task doesn't touch the hero again).
- Produces: nothing other tasks depend on.

**Context:** The audit flagged three repeating macOS-style window mockups on this page. Checking the actual code (`grep -n "bg-\[#ff5f57\]" src/components/marketing/Landing.tsx`) shows only two literal instances: one inside `HeroMock` (~line 313) and one inside `ProblemMock` (~line 606, the "Raw Markdown doesn't travel well" before/after comparison). Task 4 already deletes `HeroMock` in its entirety, which removes that instance — `ProblemMock`'s instance is the one legitimate use (a real side-by-side comparison, not decoration) and must be **kept, untouched**. So after Task 4 lands, this concern is already resolved; this task's Step 1 is a verification, not a removal — do not delete anything from `ProblemMock`.

This task fixes the remaining three specific, independent issues the audit found:

1. The "How it works" section (search for `eyebrow="How it works"` ~line 1048, with a `steps` array defined ~line 648) currently renders as a 4-up grid of numbered cards via the generic `Section` wrapper (defined ~line 106-170, used 6+ times across this file for nearly every section). Rebuild just this section's content (keep using `Section` for its title/subtitle/eyebrow chrome, since that part is fine — only the *body* layout is the problem) as a horizontal sequence where each step is visually connected to the next by a thin connecting rule (a `border-t` or an SVG line between step numbers), rather than four disconnected equal-weight cards — this alone is enough to break the repeating-card-grid rhythm without a full rewrite.
2. Mobile hero headline: the two-tone (white first line / gradient second line) headline currently breaks mid-line at 390px viewport width instead of at the intended line break. Locate the hero `<h1>` (search for the hero heading, likely rendering `"Written in Markdown."` and `"Read by everyone else."` as two `<span>`s per `BRAND.md`'s documented copy). Add an explicit `<br />` between the two spans (or wrap each in a `block` element) so the line break is deterministic at every viewport width instead of relying on natural text wrapping.
3. Integrations section card-height mismatch: locate the Integrations grid (search `Integrations` ~line 1104-1240). The "Claude" card's content fills it fully while "Terminal"/"GitHub Actions" leave empty space at the bottom. Add `flex flex-col` to each card's container and `mt-auto` (or move the CTA/link element to the bottom via `flex-1` on the content above it) so all three cards' bottom edges align regardless of content length, matching the equal-height pattern already used elsewhere (e.g. `FeatureCard`, ~line 184-200, which uses `flex flex-col gap-4 ... h-full` on its grid parent).

- [ ] **Step 1: Verify only one macOS mockup remains**

After Task 4 is committed, run `grep -n "bg-\[#ff5f57\]" src/components/marketing/Landing.tsx` — it should return exactly one match (inside `ProblemMock`). If it returns two, Task 4 didn't fully remove `HeroMock`; go finish that before continuing here. Do not modify `ProblemMock`'s mockup in this task.

- [ ] **Step 2: Rebuild "How it works" as a connected sequence**

Keep the `<Section eyebrow="How it works" ...>` wrapper and its `steps` data array (~line 648) as-is. Replace the body markup (currently a `grid` of numbered cards, inside the `Section`'s children) with a `flex flex-col sm:flex-row` sequence where consecutive steps are joined by a visible connector — the simplest correct implementation is a `sm:flex-row` flex container where each step is `flex-1` and has a `sm:border-t-2 sm:border-accent-dim` positioned as a top rule spanning between the step number and the next, e.g.:

```tsx
<div className="flex flex-col gap-8 sm:flex-row sm:gap-0">
  {steps.map((step, i) => (
    <div key={step.n} className="relative flex-1 sm:px-6 sm:first:pl-0 sm:last:pr-0">
      {i > 0 && (
        <div
          aria-hidden
          className="absolute top-5 left-0 hidden h-px w-6 -translate-x-full bg-border-strong sm:block"
        />
      )}
      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border-strong text-sm font-semibold text-accent">
        {i + 1}
      </div>
      <div className="mt-4 text-[15px] font-semibold tracking-tight">{step.title}</div>
      <div className="mt-2 text-[15px] leading-[1.72] text-text-secondary">{step.desc}</div>
    </div>
  ))}
</div>
```

`steps` (defined ~line 648-664+) is an array of `{ n: string; title: string; desc: string }` (confirmed by reading the file — `n` holds the zero-padded step number as a string like `"01"`, unused directly in this new layout since `{i + 1}` renders the visual number instead). The snippet above uses those real field names directly.

- [ ] **Step 3: Fix the mobile hero line break**

Find the hero `<h1>` element (in the hero section, ~lines 858-990). It should already render two visually distinct spans/lines per `BRAND.md`'s "Hero gradient" copy pattern (plain white first line, gradient-text second line) — insert an explicit line break between them (`<br />` if they're inline spans, or ensure each is a `block`-level element) so the boundary is deterministic rather than dependent on viewport-width text reflow.

- [ ] **Step 4: Fix Integrations card height parity**

In the Integrations grid (~lines 1104-1240), find each card's root `<div>` and add `flex flex-col h-full` if not already present on the grid item wrapper. Inside each card, if there's a trailing CTA/link element, add `mt-auto` to it (or wrap the card's descriptive content in a `flex-1` div above the CTA) so all three cards' CTAs align at the same bottom edge regardless of how much description text each card has.

- [ ] **Step 5: Verify visually**

Start `npm run dev`, load `/` at 1440×900: confirm only one macOS-window-style mockup remains on the page (in the before/after comparison), "How it works" reads as a connected sequence rather than a disconnected 4-up grid, and the three Integrations cards have matching bottom edges. Reload at 390×844: confirm the hero's two-tone headline breaks exactly where intended, not mid-word/mid-line.

- [ ] **Step 6: Run verification and commit**

Run: `npm run test && npm run lint`

```bash
git add src/components/marketing/Landing.tsx
git commit -m "$(cat <<'EOF'
fix(marketing): de-templatize landing page, fix 3 audit findings

Removes the redundant second macOS-window mockup, restyles "How it
works" as a connected sequence instead of a fourth disconnected
card-grid section, forces a deterministic mobile hero line break, and
fixes the Integrations grid's uneven card heights.
EOF
)"
```

---

### Task 6: Editor writing surface — syntax dimming + publish reveal

**Files:**
- Create: `src/components/app/SyntaxOverlay.tsx`
- Modify: `src/components/app/PasteInput.tsx` (wrap the existing `<textarea>` with the new overlay)
- Modify: `src/components/app/TopBar.tsx` (publish confirmation, ~lines 700-730 — the `status === "published"` branch)

**Interfaces:**
- Consumes: `--color-text-muted`, `--color-paper`, `--color-paper-ink`, `font-display` (Task 3); `BookletMark` (Task 2, if used in the reveal — optional, not required).
- Produces: `SyntaxOverlay` component, props `{ value: string }` → renders dimmed-syntax overlay text positioned under a transparent-background textarea. Only consumed by `PasteInput.tsx` in this plan.

**Context:** `PasteInput.tsx` currently renders a plain `<textarea className="font-mono">` with no visual distinction between Markdown syntax characters (`#`, `**`, `` ` ``, `- `, etc.) and prose. The standard technique for styling text *inside* an editable textarea without switching to a full contenteditable/CodeMirror setup is a synchronized overlay: an absolutely-positioned `<div>` behind the textarea renders the same text with syntax spans dimmed, the textarea itself becomes `background: transparent` with `color: transparent` for the parts covered by the overlay... but partial-transparency-per-character isn't possible with a plain `<textarea>` (its text is one uniform color). The correct approach here is: keep the textarea's native text fully transparent (`color: transparent`, `caret-color` set to the normal text color so the cursor stays visible), and render ALL text — both syntax and prose — in the overlay div, positioned exactly behind/under the textarea with identical font/line-height/padding so characters align pixel-for-pixel, with syntax characters dimmed via `<span>` styling in the overlay. Read the full existing `PasteInput.tsx` before starting — it manages selection/caret logic (`applyFormat`, `getCaretCoordinates` import) that must keep working with the textarea unchanged underneath.

- [ ] **Step 1: Build the syntax-tokenizing overlay component**

Create `src/components/app/SyntaxOverlay.tsx`:

```tsx
"use client";

import { useMemo } from "react";

// Lightweight, presentational-only tokenizer — this is NOT the app's real
// Markdown parser (src/lib/parse.ts), it only needs to visually distinguish
// syntax characters from prose in the editor, line by line. False
// positives/negatives here have zero effect on parsing or publishing.
const SYNTAX_RE = /^(#{1,4}\s|>\s|-\s|\d+\.\s)|(\*\*|__|`{1,3}|~~|\[|\]|\(|\))/g;

type Token = { text: string; syntax: boolean };

function tokenizeLine(line: string): Token[] {
  const tokens: Token[] = [];
  let lastIndex = 0;
  SYNTAX_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = SYNTAX_RE.exec(line))) {
    if (match.index > lastIndex) {
      tokens.push({ text: line.slice(lastIndex, match.index), syntax: false });
    }
    tokens.push({ text: match[0], syntax: true });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < line.length) tokens.push({ text: line.slice(lastIndex), syntax: false });
  return tokens;
}

export function SyntaxOverlay({ value }: { value: string }) {
  const lines = useMemo(() => value.split("\n"), [value]);

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden whitespace-pre-wrap break-words font-mono text-text-primary"
    >
      {lines.map((line, i) => (
        <div key={i}>
          {tokenizeLine(line).map((tok, j) =>
            tok.syntax ? (
              <span key={j} className="text-text-muted/60">
                {tok.text}
              </span>
            ) : (
              <span key={j}>{tok.text}</span>
            ),
          )}
          {line === "" ? " " : null}
        </div>
      ))}
    </div>
  );
}
```

The trailing ` ` for empty lines prevents an empty `<div>` from collapsing to zero height and desyncing the overlay's line positions from the textarea's.

- [ ] **Step 2: Wire it behind the textarea in `PasteInput.tsx`**

Read `PasteInput.tsx` in full first — find the JSX that renders the `<textarea>` element (its exact className/styling, and the wrapping container). Wrap the textarea in a `relative` container if it isn't already one, add `<SyntaxOverlay value={value} />` as a sibling positioned identically (`absolute inset-0`, matching padding), then change the textarea's own classes to add `relative bg-transparent text-transparent caret-text-primary` (add `relative` so it stacks above the overlay for click/selection purposes; `z-10` if needed) — the overlay must use the exact same font-size/line-height/padding/border classes as the textarea or the two will visually drift apart as the user types. Import: `import { SyntaxOverlay } from "@/components/app/SyntaxOverlay";`.

- [ ] **Step 3: Verify pixel alignment**

Start `npm run dev`, load `/app`, type a multi-line document with headings, bold text, and a list. Confirm: syntax characters (`#`, `**`, `- `) appear visually dimmed relative to surrounding prose, the cursor remains visible and lands in the correct character position when clicking anywhere in the text, and selecting text with the mouse/keyboard still works normally (the overlay is `pointer-events-none`, so all interaction still goes to the real textarea underneath). Scroll the textarea if the document is long — confirm the overlay scrolls in sync (if it doesn't, the overlay needs `overflow-y-auto` synced to the textarea's `scrollTop` via an `onScroll` handler that updates the overlay's own scroll position or a CSS `translateY`; implement whichever the existing `PasteInput.tsx` scroll-handling pattern, if any, already suggests).

- [ ] **Step 4: Publish reveal**

In `TopBar.tsx`, find the `status === "published"` render branch (~lines 704-730, the one currently rendering "Copy link"/"Your page · Copy link"). Before this branch's content appears, add a brief (~500ms) full-viewport transition: create a simple overlay `<div>` (fixed, `inset-0`, `z-50`) that fades from `bg-bg` to `bg-paper` and back to transparent — reuse the same fade timing already established by `AppLoader.tsx` (`FADE_MS = 220` pattern) rather than inventing new durations. Trigger it only on the `idle`/`typing`/`publishing` → `published` status transition (use a `useEffect` watching `status`, not on every render), and skip it entirely under `prefers-reduced-motion` (check with the same `prefersReducedMotion()` helper pattern used in `AppLoader.tsx:19-22` — extract it to a shared util if it doesn't already exist in `src/lib/ui/`, since this is now the second component needing it).

- [ ] **Step 5: Verify the publish reveal**

In `/app`, write a short document and hit Publish. Confirm a brief dark→paper→transparent flash plays once, then the normal "Copy link" state appears. Toggle reduced-motion and repeat — confirm no flash plays, just the immediate state change.

- [ ] **Step 6: Run verification and commit**

Run: `npm run test && npm run lint`

```bash
git add src/components/app/SyntaxOverlay.tsx src/components/app/PasteInput.tsx src/components/app/TopBar.tsx
git commit -m "$(cat <<'EOF'
feat(editor): dim Markdown syntax in the writing surface, publish reveal

The plain textarea gave the editor's writing surface zero craft beyond
monospace font. A synchronized overlay now dims syntax characters
relative to prose, foreshadowing the write-to-read transformation.
Hitting Publish now plays a brief dark-to-paper reveal instead of a
plain top-bar state swap.
EOF
)"
```

---

### Task 7: Published page chrome — hairline rule system

**Files:**
- Modify: `src/app/p/[id]/page.tsx` (footer + share/reactions row, ~lines 240-300)
- Modify: `src/components/share/ShareButtons.tsx`
- Modify: `src/components/share/Reactions.tsx`
- Modify: `src/components/share/TocClient.tsx` (desktop TOC)

**Interfaces:**
- Consumes: `--shadow-print`, `--color-border-default` (Task 3), `BookletMark` (Task 2).
- Produces: nothing other tasks depend on.

**Context:** Per the audit, the published page's core typesetting (Fraunces-via-Task-3 body copy, code blocks, spacing) is already the strongest surface in the product and must not be rebuilt — this task only touches the chrome *around* the content: the share buttons row, reactions, and desktop table-of-contents. Apply the hairline-over-blur geometry direction from the spec: replace any `shadow-card`/`shadow-glass`/soft-blur usage in these four files with `border border-border-default` (already present in most cases — check first, many of these components may already be hairline-based) plus `shadow-print` only where a card genuinely needs to lift off the page (e.g. a hover state), not as a default resting state.

- [ ] **Step 1: Audit current shadow usage**

Run: `grep -n "shadow-card\|shadow-glass\|shadow-glow\|shadow-soft" src/app/p/\[id\]/page.tsx src/components/share/ShareButtons.tsx src/components/share/Reactions.tsx src/components/share/TocClient.tsx`

For each match, replace the blurred shadow class with `shadow-print` if the element is a card/button that should read as "lifted" (e.g. a reaction button's active/hover state), or remove the shadow entirely in favor of just `border border-border-default` if it's a static resting-state panel (e.g. the TOC sidebar).

- [ ] **Step 2: Apply consistent hairline dividers**

In `src/app/p/[id]/page.tsx`, confirm the footer's `border-t border-border-subtle` (~line 262) and the existing structure are consistent with the rest of the chrome — this file is largely already hairline-based (it uses `border-t`, not shadows, for its main divider), so this step is primarily verifying `ShareButtons`/`Reactions`/`TocClient` match that same discipline rather than introducing a different visual language of their own.

- [ ] **Step 3: Verify visually**

Publish a longer test document (enough headings to trigger the desktop TOC — check `showToc` logic in `page.tsx` for the heading-count threshold) and view it at 1440×900 in both themes. Confirm the share/reactions/TOC chrome reads as crisp hairline-bordered elements, none of them using a soft ambient glow shadow as their default resting state.

- [ ] **Step 4: Run verification and commit**

Run: `npm run test && npm run lint`

```bash
git add src/app/p/\[id\]/page.tsx src/components/share/ShareButtons.tsx src/components/share/Reactions.tsx src/components/share/TocClient.tsx
git commit -m "$(cat <<'EOF'
style(published-page): hairline geometry for share/reactions/TOC chrome

Replaces blurred ambient-glow shadows with crisp hairline borders (and
shadow-print only where a genuine lift/hover state is warranted) in the
chrome surrounding published-page content, matching the new geometry
direction. The content typesetting itself is untouched.
EOF
)"
```

---

### Task 8: Auth screens — editorial split layout

**Files:**
- Modify: `src/components/auth/AuthLayout.tsx`
- Modify: `src/app/sign-in/AuthForm.tsx`
- Modify: `src/app/sign-in/page.tsx`
- Modify: `src/app/sign-up/page.tsx`

**Interfaces:**
- Consumes: `--color-paper`, `--color-paper-ink`, `font-display` (Task 3), `BookletMark` (Task 2).
- Produces: nothing other tasks depend on.

**Context:** Read `AuthLayout.tsx` first — it's the shared wrapper both `sign-in` and `sign-up` already use, so the split-layout change belongs there, not duplicated per-page. Current layout: a single centered card on a plain background, no brand personality. New layout: a two-pane split — left pane (dark, `bg-bg`) shows a static example of "The Reveal" transformation (reuse the same `SAMPLE` data shape/idea from `RevealHero.tsx`, Task 4, but as a *static* fully-revealed paper-toned snippet, not scroll-driven — a full scroll animation doesn't make sense on a form page), right pane (or the only pane on mobile) holds the actual form, unchanged in function.

- [ ] **Step 1: Read the current layout and form components**

Read `src/components/auth/AuthLayout.tsx`, `src/app/sign-in/AuthForm.tsx`, `src/app/sign-in/page.tsx`, and `src/app/sign-up/page.tsx` in full to understand the current prop contracts before changing anything — `AuthForm.tsx` handles actual submit logic and must not have its behavior changed, only its container.

- [ ] **Step 2: Build the split layout in `AuthLayout.tsx`**

Restructure `AuthLayout.tsx` to render a `grid grid-cols-1 lg:grid-cols-2 min-h-screen` container. The left `lg:` column (`hidden lg:flex`, so it's absent on mobile — the form-only single-column layout is preserved on small screens) shows a static editorial panel: `bg-bg` background, centered content with a `font-display font-display-hero` heading (reuse copy from `BRAND.md`'s hero headline list — e.g. "Written in Markdown. Read by everyone else." — or a shorter auth-context variant if that reads too long here), and below it a static paper-toned card (`bg-paper text-paper-ink rounded-2xl p-6 shadow-print`) showing a short example transformation snippet (2-3 lines, no animation). The right column (full width on mobile, half on `lg:`) keeps `AuthLayout`'s existing children slot (the actual form) with the same padding/max-width it has today, just no longer centered in a full-viewport single column.

- [ ] **Step 3: Verify neither page's form logic changed**

`AuthForm.tsx` should need zero changes to its submit handler, validation, or field logic — only `AuthLayout.tsx`'s JSX structure changes. If `AuthForm.tsx` currently sets its own max-width/centering assuming a full-viewport single-column parent, adjust those classes to fit the new right-column context, but don't touch its `onSubmit`/state logic.

- [ ] **Step 4: Verify visually**

Load `/sign-in` and `/sign-up` at 1440×900 in both themes — confirm the split layout renders, the left panel's example card is legible and static (no animation), and the form still functions (fill it out, confirm client-side validation still fires as before). Load both at 390×844 — confirm the left panel is hidden and the form renders full-width, matching the original mobile experience.

- [ ] **Step 5: Run verification and commit**

Run: `npm run test && npm run lint`

```bash
git add src/components/auth/AuthLayout.tsx src/app/sign-in/AuthForm.tsx src/app/sign-in/page.tsx src/app/sign-up/page.tsx
git commit -m "$(cat <<'EOF'
feat(auth): editorial split layout replacing generic centered card

Auth screens were the single most generic-looking surface in the
product per the design audit. AuthLayout now shows a static example of
the write/read transformation alongside the form on desktop, carrying
brand confidence into a previously bare screen. Mobile keeps the
original single-column form-only layout unchanged.
EOF
)"
```

---

### Task 9: Dashboard and secondary marketing pages — re-skin onto new tokens

**Files:**
- Modify: `src/app/my-pages/MyPagesClient.tsx`
- Modify: `src/app/pricing/page.tsx`
- Modify: `src/app/changelog/page.tsx`
- Modify: `src/app/api-docs/page.tsx`
- Modify: `src/app/about/page.tsx`

**Interfaces:**
- Consumes: all Task 3 tokens.
- Produces: nothing other tasks depend on.

**Context:** Per the audit, these pages are structurally sound (no rebuild needed) — `api-docs` in particular is already well-executed. This task is a re-skin pass: replace any blurred-shadow (`shadow-card`/`shadow-glass`/`shadow-glow`) usage with the hairline/`shadow-print` direction (same instruction as Task 7), and apply `font-display`/`font-display-body` to page-level headings (`<h1>`/section `<h2>`s) where they currently use plain `font-bold` Inter, matching the editorial voice established by Tasks 4-5 on the landing page. Do not change any of these pages' data-fetching, table logic, or interactive behavior (e.g. `MyPagesClient.tsx`'s page-list/analytics logic) — headings and surface treatment only. If any chart/analytics visualization is touched while editing `MyPagesClient.tsx`, follow the project's `dataviz` skill for its color/palette treatment rather than styling it ad hoc.

- [ ] **Step 1: Audit shadow and heading-font usage across all five files**

Run: `grep -n "shadow-card\|shadow-glass\|shadow-glow\|<h1\|<h2" src/app/my-pages/MyPagesClient.tsx src/app/pricing/page.tsx src/app/changelog/page.tsx src/app/api-docs/page.tsx src/app/about/page.tsx`

- [ ] **Step 2: Apply the re-skin per file**

For each match from Step 1: replace blurred shadows per the Task 7 rule (`shadow-print` for genuinely lifted elements, plain `border border-border-default` otherwise). For each top-level `<h1>`/section `<h2>` heading, add `font-display` to its className (append, don't replace existing weight/tracking/size classes — `font-display` only changes the `font-family`).

- [ ] **Step 3: Verify visually**

Load each of the five pages at 1440×900 in both themes (sign in first for `/my-pages` — use the dev auth flow already set up in the repo, or skip this one page's runtime check if auth setup is nontrivial in the local environment, and instead verify via `grep` that the className changes were applied consistently). Confirm headings now render in Fraunces and no page has a leftover blurred ambient shadow.

- [ ] **Step 4: Run verification and commit**

Run: `npm run test && npm run lint`

```bash
git add src/app/my-pages/MyPagesClient.tsx src/app/pricing/page.tsx src/app/changelog/page.tsx src/app/api-docs/page.tsx src/app/about/page.tsx
git commit -m "$(cat <<'EOF'
style: re-skin dashboard + secondary marketing pages onto new tokens

Applies the Fraunces display headings and hairline/shadow-print
geometry direction to /my-pages, /pricing, /changelog, /api-docs, and
/about. Structure, data-fetching, and interactive behavior on these
pages are unchanged — visual treatment only.
EOF
)"
```

---

### Task 10: `/templates` — visual gallery redesign

**Files:**
- Modify: `src/app/templates/page.tsx`
- Create: `src/components/marketing/TemplatePreviewCard.tsx`

**Interfaces:**
- Consumes: `TEMPLATES` data (already imported in `Landing.tsx:13` from `@/lib/templates` — reuse the same source, don't duplicate template data). `Template` (from `src/lib/templates.ts`) is `{ name: string; description: string; content: string; slug?: string; aliases?: string[]; headline?: string; metaDescription?: string; category?: string; useCases?: string[] }` — only entries with a defined `slug` have a `/templates/[slug]` page to link to, so the gallery must filter to `TEMPLATES.filter((t) => t.slug)` before rendering.
- Produces: `TemplatePreviewCard` component, props `{ name: string; description: string; slug: string; content: string }` (a narrowed, `slug`-required view of `Template`, matching the real field names — not `title`).

**Context:** Per the audit, `/templates` is currently "a plain 2-column link-card list, no icons, functional but flat" — the clearest remaining flat/functional-only surface. Upgrade it to a visual gallery: each template gets a small mini paper-page preview (a scaled-down, non-interactive `bg-paper text-paper-ink` card showing a stylized excerpt — a fake heading + 2-3 lines — rather than just a text link), consistent with paper-as-material-language established elsewhere in this plan.

- [ ] **Step 1: Read the templates data source and current page**

Read `src/lib/templates.ts` in full (the `Template` type and `TEMPLATES` array shape are already confirmed above) and `src/app/templates/page.tsx` to see exactly how it currently maps over `TEMPLATES` and what it filters/sorts by, so the new gallery preserves the same set of visible templates (only `slug`-bearing ones) and ordering.

- [ ] **Step 2: Build the preview card**

Create `src/components/marketing/TemplatePreviewCard.tsx` — a card with two stacked sections: a `bg-paper text-paper-ink rounded-t-xl p-4` mini-preview area showing the template's own `content`, not decorative filler — extract the first `# Heading` line (strip the `#`/`##` markers) as a `font-display` heading and the next 1-2 non-empty, non-heading lines as plain text underneath (truncate each with `line-clamp-1`), giving an honest miniature of what publishing that template actually produces. This sits above a `bg-bg-elevated border border-border-default rounded-b-xl p-4` info area with the real `name`/`description` and a link to `/templates/${slug}`. Match the existing `rounded-2xl`/`border-border-default` card language used elsewhere (e.g. `FeatureCard` in `Landing.tsx:184-200`) for the outer container's border-radius consistency (`rounded-t-xl`/`rounded-b-xl` should sum to the same visual corner radius as the single `rounded-2xl` used elsewhere).

- [ ] **Step 3: Wire it into `/templates/page.tsx`**

Replace the current plain link-list rendering with a grid of `TemplatePreviewCard`s, one per `TEMPLATES` entry, in a `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5` layout (matching the responsive grid pattern used elsewhere in this codebase, e.g. `Landing.tsx`'s feature grids).

- [ ] **Step 4: Verify visually**

Load `/templates` at 1440×900 and 390×844, both themes. Confirm each template now shows a small paper-toned preview instead of being a plain text link, the grid reflows correctly at mobile width, and every link still navigates to the correct `/templates/[slug]` page.

- [ ] **Step 5: Run verification and commit**

Run: `npm run test && npm run lint`

```bash
git add src/app/templates/page.tsx src/components/marketing/TemplatePreviewCard.tsx
git commit -m "$(cat <<'EOF'
feat(templates): visual gallery with mini paper-page previews

Replaces the flat 2-column link list on /templates with a card grid
where each entry shows a small paper-toned mini-preview, consistent
with the paper-as-material-language direction used elsewhere in this
pass, instead of being the last plain-link-list surface in the product.
EOF
)"
```

---

### Task 11: Cross-surface QA pass

**Files:**
- Create: `scripts/visual-qa.mjs`
- No component files modified by this task unless QA finds a regression, in which case fix it in place and note which file changed in the commit message.

**Interfaces:**
- Consumes: every surface touched by Tasks 1-10.
- Produces: nothing — this is a verification-only task.

**Context:** This is the plan's final gate. Take before/after-equivalent screenshots of every touched surface, both themes, both breakpoints, and manually review each for regressions the per-task verification steps might have missed in isolation (e.g. a token change in Task 3 that looks fine on the page it was tested on but clashes somewhere else).

- [ ] **Step 1: Write the screenshot script**

Create `scripts/visual-qa.mjs`:

```js
// Cross-surface visual QA sweep for the "Booklet Visual Elevation" plan.
// Requires a running dev server — start with `npm run dev` first and pass
// its actual URL (Next.js may pick a non-3000 port if 3000 is occupied).
// Usage: node scripts/visual-qa.mjs http://localhost:3000
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE_URL = process.argv[2];
if (!BASE_URL) {
  console.error("Usage: node scripts/visual-qa.mjs <base-url>");
  process.exit(1);
}

const ROUTES = ["/", "/app", "/sign-in", "/sign-up", "/templates", "/pricing", "/changelog", "/api-docs", "/about"];
const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 390, height: 844 },
];
const THEMES = ["dark", "light"];

mkdirSync("qa-screenshots", { recursive: true });

const browser = await chromium.launch();
for (const theme of THEMES) {
  for (const viewport of VIEWPORTS) {
    const page = await browser.newPage({ viewport });
    await page.emulateMedia({ colorScheme: theme });
    for (const route of ROUTES) {
      await page.goto(`${BASE_URL}${route}`, { waitUntil: "networkidle" });
      const safeName = route === "/" ? "home" : route.replace(/\//g, "_");
      await page.screenshot({
        path: `qa-screenshots/${theme}-${viewport.name}-${safeName}.png`,
        fullPage: true,
      });
    }
    await page.close();
  }
}
await browser.close();
console.log("Screenshots written to ./qa-screenshots/");
```

- [ ] **Step 2: Run it and review**

Start `npm run dev`, note the actual URL from its stdout, then run: `node scripts/visual-qa.mjs <that-url>`

Review every generated screenshot in `qa-screenshots/`. For each, check specifically: no leftover stale-logo glyph anywhere (Task 2), no page rendering with broken/missing fonts (Task 3), no visibly clipped/overflowing text at the mobile width, no component showing an obviously wrong color (e.g. white text on paper background, or paper-ink text on a dark surface — a token miswired to the wrong role). List every issue found.

- [ ] **Step 3: Fix any regressions found**

For each issue from Step 2, fix it in the relevant file (from whichever Task above owns that surface) and re-run the specific affected screenshot(s) to confirm the fix.

- [ ] **Step 4: Run the retuned-accent contrast check again**

Run: `node scripts/check-contrast.mjs` (from Task 3) — must still all-PASS; if Task 9's or others' heading-font changes introduced any new text-on-background pairing not covered by that script, add a row for it and verify.

- [ ] **Step 5: Final full verification suite**

Run: `npm run test && npm run lint && npm run test:unit`
Expected: all pass, zero regressions from the pre-plan baseline.

- [ ] **Step 6: Commit**

```bash
git add scripts/visual-qa.mjs
git commit -m "$(cat <<'EOF'
test: add cross-surface visual QA sweep script

Screenshots every surface touched by the visual elevation plan across
both themes and both breakpoints for final review. No functional
changes — QA tooling only (any regressions found during this pass were
fixed in their owning surface's files, see individual commits).
EOF
)"
```

---

## Post-plan

Once all 11 tasks are committed, follow `superpowers:finishing-a-development-branch` to decide how this work gets integrated (the working tree may already be `main` directly, given no worktree/branch was set up at plan start — check `git status`/`git branch` before assuming a PR flow is needed).
