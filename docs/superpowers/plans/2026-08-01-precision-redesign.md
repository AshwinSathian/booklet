# Booklet Precision Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Booklet's "Ink & Paper" / "The Reveal" identity (oxblood accent, paper-cream surfaces, Fraunces serif, dark→paper motion) with a monochrome, motion-led "Precision" identity (near-black/near-white, single amber accent, Geist Sans/Mono, hairline borders, cursor-spotlight + command-palette + view-transition motion) across every user-facing surface, and close the surfaces/features the last redesign explicitly skipped.

**Architecture:** Tailwind v4 CSS-first tokens in `src/app/globals.css` are the single source of truth every component consumes via Tailwind utility classes — repainting that file plus the handful of components that hardcode "paper"/Fraunces (`AppLogo`, `AuthLayout`, `RevealHero`, `TopBar`'s `PublishReveal`, `TemplatePreviewCard`) propagates the new identity to ~95% of the app for free. The remainder of the work is: (a) migrating the legacy `--color-outline` token to the newer `--color-border-*` triad everywhere it still appears, (b) reconciling third-party brand colors (Claude, HTTP methods, changelog tags) that visually collide with the new amber accent, (c) two genuinely new motion primitives (`CursorSpotlight`, a command palette) plus a redesigned publish animation, and (d) one net-new feature (password reset) that the product has never had.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript 5.9, Tailwind CSS v4 (CSS-first `@theme`), framer-motion, `geist` (new dep), `cmdk` (new dep), `resend` (new dep), MongoDB, argon2, zod.

## Global Constraints

- Every new/changed color pair must pass WCAG AA (4.5:1 normal text, 3:1 UI/large text) verified via `scripts/check-contrast.mjs` before being considered done.
- `prefers-reduced-motion` must degrade every new motion primitive (spotlight, stagger, view-transitions, publish sequence) to instant/no-op — not just "reduced."
- No functional/logic regressions outside the password-reset feature: this is a visual/copy pass plus one net-new feature, not a rewrite of publish/auth/dashboard behavior.
- Keep existing token *names* stable wherever possible (only values change) to minimize diff surface — introduce new token names only where a genuinely new role is needed (e.g. `--color-accent-contrast`).
- Voice: direct, precise, concrete numbers over superlatives; blocklist carries forward verbatim: *revolutionary, game-changing, disrupting, paradigm shift, all-in-one, end-to-end, seamless, robust, powerful solution, leverage, synergy, we're excited to announce, delighted to share, next-level, best-in-class.*
- Full spec: `docs/superpowers/specs/2026-08-01-precision-redesign-design.md`.

---

## Milestone 0 — Foundations

### Task 1: Rewrite color/shadow tokens in `globals.css`

**Files:**
- Modify: `src/app/globals.css:1-184` (`:root` dark block, `html.light` block), `:335` (`::selection`)

**Interfaces:**
- Produces: final token values every later task assumes — `--color-bg: #0a0a0a`, `--color-accent: #f5a623` (dark) / `#8a5a00` (light), new `--color-accent-contrast: #0a0a0a` (dark) / `#fafafa` (light), retired `--color-paper*` and `--color-accent-warm`, renamed `--shadow-print` → `--shadow-hard`.

- [ ] **Step 1: Replace the dark `:root` accent/paper/shadow block (lines 67–123)**

Replace the entire block from the `/* ── Accent (DARK) ── */` comment (line 67) through the shadow block (line 123) with:

```css
  /* ── Accent (DARK) — "Precision" (2026-08-01) ────────────────────────────── */
  /* A single amber/gold accent replaces "Ink & Paper"'s oxblood — chosen to
     avoid the indigo/violet that's become this product category's default
     (Linear, most YC-era dev tools) and the burgundy the last two systems
     already used. Two distinct hexes exist for a reason bright amber is
     genuinely bad at: amber (#f5a623) reads at ~9.5:1 as bare text/icon
     directly on --color-bg, but a WHITE label on that same amber button
     background only hits ~2.1:1 (fails AA outright) — bright colors are
     high-luminance, so white text on them is low-contrast almost by
     definition. --color-accent-contrast is the fix: it's the text color to
     place ON TOP of an accent-colored surface (near-black in dark mode,
     since black-on-amber hits ~9.5:1), never white. Button.tsx's primary
     variant uses --color-accent-contrast, not a hardcoded text-white, for
     exactly this reason. Verified via `node scripts/check-contrast.mjs`. */
  --color-accent:          #f5a623;   /* action/active — text/icon on dark bg: ~9.5:1 */
  --color-accent-hover:    #e0961d;
  --color-accent-soft:     #f8c368;   /* lighter tint — secondary tints, focus rings */
  --color-accent-contrast: #0a0a0a;   /* text/icon ON an accent-colored surface */
  --color-accent-dim:      rgba(245, 166, 35, 0.14); /* icon backgrounds */

  /* ── Borders — pre-computed, never composed in component classes (DARK) ── */
  --color-border-strong:  rgba(255, 255, 255, 0.16);
  --color-border-default: rgba(255, 255, 255, 0.09);
  --color-border-subtle:  rgba(255, 255, 255, 0.05);

  /* ── Surface fills (DARK) ───────────────────────────────────────────────── */
  --color-fill-1: rgba(255, 255, 255, 0.04);   /* table row alternates        */
  --color-fill-2: rgba(255, 255, 255, 0.08);   /* code headers, inset panels  */
  --color-fill-3: rgba(255, 255, 255, 0.13);   /* table head, button hover    */

  /* ── Shadows (DARK) ─────────────────────────────────────────────────────── */
  /* Precision favors hairline borders over glow/blur shadows as the primary
     depth cue — --shadow-soft and --shadow-glow (both accent-tinted glows)
     are retired outright, not retuned. --shadow-card/--shadow-glass survive
     because their values were already neutral black (never accent-tinted),
     so they're legitimate generic elevation shadows, not brand artifacts.
     --shadow-print is renamed --shadow-hard: identical value, but the old
     name carried "printed card" framing this identity doesn't use. */
  --shadow-glass: 0 8px 48px rgba(0, 0, 0, 0.70);       /* dropdowns/drawers/toasts */
  --shadow-card:  0 1px 2px rgba(0, 0, 0, 0.60), 0 4px 24px rgba(0, 0, 0, 0.40);
  --shadow-hard:  0 2px 0 0 rgba(0, 0, 0, 0.9);          /* rare hard-offset emphasis */

  /* ── Scrollbar (DARK) ───────────────────────────────────────────────────── */
  --scrollbar-thumb:       rgba(255, 255, 255, 0.10);
  --scrollbar-thumb-hover: rgba(255, 255, 255, 0.20);

}
```

Note this deliberately drops `--color-border-strong`'s duplicate definition further down (lines 104–117 in the old file) since it's now folded into this same block — after this edit there must be exactly one definition of each border/fill token in `:root`.

- [ ] **Step 2: Replace the `html.light` accent/paper/shadow block (lines 148–178)**

```css
  /* ── Accent (LIGHT) — "Precision" ───────────────────────────────────────── */
  /* Amber itself fails as bare text or a white-text button fill on a WHITE
     background (same luminance problem as dark mode, mirrored) — light mode
     uses a deep ochre instead, tuned so both roles clear AA: as bare text on
     --color-bg (#fafafa) it's ~5.96:1; as a button fill with
     --color-accent-contrast (white) label it's the same ~5.96:1. */
  --color-accent:          #8a5a00;
  --color-accent-hover:    #6f4700;
  --color-accent-soft:     #a8720a;
  --color-accent-contrast: #fafafa;
  --color-accent-dim:      rgba(138, 90, 0, 0.10);

  /* ── Borders (LIGHT) ────────────────────────────────────────────────────── */
  --color-border-strong:  rgba(0, 0, 0, 0.14);
  --color-border-default: rgba(0, 0, 0, 0.09);
  --color-border-subtle:  rgba(0, 0, 0, 0.05);

  /* ── Surface fills (LIGHT) ──────────────────────────────────────────────── */
  --color-fill-1: rgba(0, 0, 0, 0.03);
  --color-fill-2: rgba(0, 0, 0, 0.06);
  --color-fill-3: rgba(0, 0, 0, 0.10);

  /* ── Shadows (LIGHT) ────────────────────────────────────────────────────── */
  --shadow-glass: 0 4px 24px rgba(0, 0, 0, 0.10);
  --shadow-card:  0 1px 2px rgba(0, 0, 0, 0.08), 0 4px 16px rgba(0, 0, 0, 0.06);
  --shadow-hard:  0 2px 0 0 rgba(0, 0, 0, 0.12);

  /* ── Scrollbar (LIGHT) ──────────────────────────────────────────────────── */
  --scrollbar-thumb:       rgba(0, 0, 0, 0.14);
  --scrollbar-thumb-hover: rgba(0, 0, 0, 0.28);

}
```

Also update `--color-bg`/`--color-bg-soft`/`--color-bg-elevated` in both blocks: dark → `#0a0a0a` / `#0d0d0d` / `#161616` (drop the warm `c`/`7` tint); light → `#fafafa` / `#f2f2f3` / `#e8e8ea`. Delete the now-unused `--color-outline`/`--color-outline-soft` legacy pair from **both** blocks only after Milestone 5/8/9/10/12 finish migrating every consumer (tracked as the last step of Task 27 below) — leave them in place for now so intermediate commits in this milestone don't break unmigrated files.

- [ ] **Step 3: Remove the retired `--color-paper*` and `--color-accent-warm` tokens**

Delete lines defining `--color-paper`, `--color-paper-dim`, `--color-paper-ink`, `--color-paper-ink-secondary`, and `--color-accent-warm` from both `:root` and `html.light` (they're superseded by Step 1/2 above — this step is just confirming no stray leftover line survives a copy-paste of Steps 1–2).

- [ ] **Step 4: Update the `@theme` binding block (lines 191–265)**

Remove `--color-paper*` and `--color-accent-warm` bindings; add `--color-accent-contrast: var(--color-accent-contrast);`; rename `--shadow-print: var(--shadow-print);` → `--shadow-hard: var(--shadow-hard);`; remove `--shadow-soft`/`--shadow-glow` bindings entirely.

- [ ] **Step 5: Update `::selection` (line 335) off its hardcoded oxblood literal**

```css
::selection {
  background: rgba(245, 166, 35, 0.25);
  color: inherit;
}
```

- [ ] **Step 6: Rewrite the stale Design DNA header comment (lines 4–19)**

```css
/*
  Theme strategy (dark-first, avoids white flash):
  - :root is DARK (pre-hydration background is dark)
  - html.light overrides to LIGHT when user chooses light or system is light
  - next-themes toggles html class: "light" | "dark"
  - PrimeReact theme is swapped in PrimeStyles based on html.dark

  Design DNA — "Precision" (2026-08-01, replaces "Ink & Paper"/"The Reveal";
  see docs/superpowers/specs/2026-08-01-precision-redesign-design.md):
  - Monochrome base, one accent: amber means action/active only, never
    decoration or a category color
  - Three surfaces: base → elevated → glass (bg → bg-elevated → bg-glass);
    no fourth level
  - Hairline borders are the primary depth cue, not blurred glow shadows
  - Motion is the differentiator: cursor-aware spotlight, staggered reveal,
    a command palette, view-transitions — restraint everywhere else
*/
```

- [ ] **Step 7: Delete the Fraunces optical-size helper classes (lines 267–276)**

Remove `.font-display-hero` / `.font-display-body` entirely — they're `font-variation-settings: opsz` controls specific to Fraunces's variable-font axis, meaningless once `--font-display` repoints to Geist Sans (Task 2). Their remaining call sites are gutted in Tasks 9 and 17 as part of replacing the components that used them (`RevealHero.tsx`, `AuthLayout.tsx`).

- [ ] **Step 8: Build and visually smoke-check**

Run: `npm run build`
Expected: build succeeds (some pages will still reference now-undefined `bg-paper`/`font-display-hero`/`shadow-soft`/`shadow-glow` Tailwind classes at this point in the plan — Tailwind emits unknown-utility warnings, not build failures, for unrecognized class names, so this is expected until later milestones land; if the build hard-fails, check for a literal remaining `--color-paper`/`--shadow-soft` reference in `globals.css` itself).

- [ ] **Step 9: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(theme): replace Ink & Paper tokens with Precision monochrome+amber palette"
```

---

### Task 2: Swap Fraunces/Inter/JetBrains Mono for Geist Sans/Mono

**Files:**
- Modify: `src/app/layout.tsx:5,10-52,133-136,148`
- Modify: `src/app/globals.css:24-30` (`--font-body`/`--font-mono`/`--font-display`)
- Modify: `package.json` (add `geist` dependency)

**Interfaces:**
- Produces: `--font-body`/`--font-mono`/`--font-display` all resolve to Geist Sans/Mono; `--font-reading` (Source Serif 4) is explicitly preserved — `src/lib/blocks.ts`'s `DocSettings.typeface: "sans" | "serif"` reader-facing toggle depends on it and must keep working.

- [ ] **Step 1: Install `geist`**

Run: `npm install geist`
Expected: adds one dependency; this is Vercel's official package — it ships local `.woff2` files behind `next/font`-compatible exports, no Google Fonts network fetch involved.

- [ ] **Step 2: Update font loading in `layout.tsx`**

Remove the `Inter` and `Fraunces` imports/consts (keep `Source_Serif_4` — it backs the reader's serif toggle, out of scope to remove). Replace with:

```ts
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
```

`GeistSans`/`GeistMono` already export `.variable` (a CSS custom property name, e.g. `--font-geist-sans`) — no `next/font/google` config object needed, unlike the `Inter`/`Fraunces` calls being removed.

- [ ] **Step 3: Update the `className` wiring (line 148)**

```tsx
className={`${GeistSans.variable} ${GeistMono.variable} ${sourceSerif4.variable}`}
```

- [ ] **Step 4: Update `globals.css` font tokens (lines 24–30)**

```css
  --font-body:    var(--font-geist-sans), "Geist Sans", system-ui, -apple-system, sans-serif;
  --font-mono:    var(--font-geist-mono), "Geist Mono", ui-monospace, "SF Mono", monospace;
  /* Distinct reading typeface for published-page body content when a reader
     explicitly picks "serif" (BlockRenderer / DocSettings.typeface in
     src/lib/blocks.ts) — the default for NEW documents flips to "sans" in
     Task 26, but existing published documents and the per-document toggle
     itself are unchanged: this stays loaded. */
  --font-reading: var(--font-source-serif-4), Georgia, "Times New Roman", serif;
  /* Precision has no separate display identity — Geist Sans handles both UI
     chrome and headline/display type, so --font-display is kept only as an
     alias (zero risk to the ~9 pages that already reference the
     `font-display` Tailwind class) rather than touching every call site. */
  --font-display: var(--font-geist-sans), "Geist Sans", system-ui, sans-serif;
```

- [ ] **Step 5: Update `viewport.themeColor` (lines 133–136) to match the new near-black/near-white**

```ts
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
  ],
};
```//adjust to match the existing export shape at that line — read the surrounding code before editing, since the exact object shape (single vs. array) must match what's already there.

- [ ] **Step 6: Build and confirm fonts load**

Run: `npm run build && npm run dev`
Expected: no missing-module errors for `geist/font/sans`/`geist/font/mono`; inspect `/` in a browser and confirm body/heading text renders in Geist Sans (distinct from the old Inter — Geist has a slightly more geometric lowercase `a`/`g`).

- [ ] **Step 7: Commit**

```bash
git add src/app/layout.tsx src/app/globals.css package.json package-lock.json
git commit -m "feat(theme): replace Inter/Fraunces with Geist Sans/Mono"
```

---

### Task 3: Shared motion primitives module + new deps

**Files:**
- Create: `src/lib/motion.ts`
- Modify: `package.json` (add `cmdk`)

**Interfaces:**
- Produces: `EASE_PRECISION` (string, cubic-bezier), `DURATION` (object of ms numbers), `usePrefersReducedMotion()` (hook, returns boolean), `navigateWithViewTransition(navigate: () => void, prefersReducedMotion: boolean): void` — consumed by Task 4 (`CursorSpotlight`), Task 9 (`RevealHero`), Task 14 (`PublishReveal`), Task 15 (command palette, which also uses `navigateWithViewTransition` for its own navigations — the one in-app entry point this plan wires up to the native View Transitions API, per the spec's motion-primitives list).

- [ ] **Step 1: Install `cmdk`**

Run: `npm install cmdk`

- [ ] **Step 2: Write `src/lib/motion.ts`**

```ts
/**
 * Shared motion primitives for the Precision identity. One easing curve and
 * a small fixed set of durations, so every animated component feels like one
 * system instead of per-component guesses — mirrors the CSS-side
 * --duration-*/--ease-spring tokens in globals.css; this is the JS-side
 * equivalent for framer-motion consumers, which can't read CSS custom
 * properties directly into transition configs.
 */

import { useEffect, useState } from "react";

/** Linear-style "snappy decelerate" — the one curve used everywhere. */
export const EASE_PRECISION = [0.16, 1, 0.3, 1] as const;

export const DURATION = {
  fast: 0.12,
  normal: 0.18,
  slow: 0.24,
} as const;

/** SSR-safe: starts false, syncs to the real media query after mount. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);
    const listener = (e: MediaQueryListEvent) => setReduced(e.matches);
    query.addEventListener("change", listener);
    return () => query.removeEventListener("change", listener);
  }, []);

  return reduced;
}

/**
 * Runs an in-app navigation inside the native View Transitions API when the
 * browser supports it and the user hasn't asked for reduced motion,
 * otherwise falls back to a plain navigation. Deliberately uses the
 * standard `document.startViewTransition` web-platform API directly rather
 * than a Next.js-version-specific experimental config flag, so it doesn't
 * depend on unstable framework internals — `navigate` is whatever
 * navigation function the caller already has (e.g. a `next/navigation`
 * router's `.push`).
 */
export function navigateWithViewTransition(navigate: () => void, prefersReducedMotion: boolean): void {
  if (prefersReducedMotion || typeof document === "undefined" || !("startViewTransition" in document)) {
    navigate();
    return;
  }
  (document as Document & { startViewTransition: (cb: () => void) => void }).startViewTransition(navigate);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/motion.ts package.json package-lock.json
git commit -m "feat(motion): add shared Precision motion primitives module"
```

---

### Task 4: `CursorSpotlight` component

**Files:**
- Create: `src/components/ui/CursorSpotlight.tsx`

**Interfaces:**
- Consumes: `usePrefersReducedMotion` from `src/lib/motion.ts`
- Produces: `<CursorSpotlight />` — a client component meant to be placed as the first child of a `relative`-positioned dark hero/marketing section; renders `null` markup-wise beyond an absolutely-positioned pointer-events-none layer.

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "@/lib/motion";

/**
 * A low-opacity radial-gradient glow that tracks the pointer within its
 * nearest `relative`-positioned ancestor. Meant for dark hero/marketing
 * sections only — this is Precision's one static-mode "glow," reserved for
 * a handful of signature moments (hero, final CTA), not general chrome.
 * Renders nothing (skips the mousemove listener entirely) under
 * prefers-reduced-motion.
 */
export function CursorSpotlight() {
  const ref = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (reducedMotion) return;
    const el = ref.current;
    if (!el) return;

    const parent = el.parentElement;
    if (!parent) return;

    function handleMove(e: PointerEvent) {
      const rect = parent!.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      el!.style.background = `radial-gradient(600px circle at ${x}px ${y}px, var(--color-accent-dim), transparent 70%)`;
    }

    parent.addEventListener("pointermove", handleMove);
    return () => parent.removeEventListener("pointermove", handleMove);
  }, [reducedMotion]);

  if (reducedMotion) return null;

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 transition-opacity duration-300"
    />
  );
}
```

- [ ] **Step 2: Verify manually**

Run: `npm run dev`, open `/` in a browser, confirm a subtle amber glow follows the cursor within the hero section once Task 8 mounts it (this component has no visible effect until then — this step is a static/type check only for now).

Run: `npx tsc --noEmit`
Expected: no type errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/CursorSpotlight.tsx
git commit -m "feat(motion): add CursorSpotlight component"
```

---

### Task 5: Update `scripts/check-contrast.mjs` for the new palette

**Files:**
- Modify: `scripts/check-contrast.mjs:12-34`

**Interfaces:**
- Consumes: final hex values from Task 1.

- [ ] **Step 1: Replace the hex-pair table**

Replace the existing 7-tuple array (lines 12–20) with:

```js
const PAIRS = [
  // [label, fg, bg, minRatio]
  ["dark: accent text/icon on bg",        "#f5a623", "#0a0a0a", 4.5],
  ["dark: accent-contrast on accent bg",  "#0a0a0a", "#f5a623", 4.5],
  ["dark: accent-soft on bg",             "#f8c368", "#0a0a0a", 4.5],
  ["light: accent text/icon on bg",       "#8a5a00", "#fafafa", 4.5],
  ["light: accent-contrast on accent bg", "#fafafa", "#8a5a00", 4.5],
  ["light: accent-soft on bg",            "#a8720a", "#fafafa", 4.5],
];
```

Remove the `paper-ink`-related rows and the previously-disclosed `knownFailures` entry for the old oxblood-as-bare-text gap (line 34) — the new accent/accent-contrast split is designed so no pair needs a disclosed exception; if any of the 6 pairs above fails when actually computed, tune that specific hex (not the pairing logic) until it passes, rather than re-adding a `knownFailures` row.

- [ ] **Step 2: Run it**

Run: `node scripts/check-contrast.mjs`
Expected: all 6 pairs report PASS. If any fails, adjust that specific hex slightly (darker for light-mode accent, or lighter for dark-mode accent-soft) and re-run until all pass — do not proceed to later tasks with a failing pair, since Button.tsx (Task 6) depends on `--color-accent-contrast` being genuinely readable.

- [ ] **Step 3: Commit**

```bash
git add scripts/check-contrast.mjs
git commit -m "test: update contrast checker for Precision palette"
```

---

## Milestone 1 — Shared UI primitives

### Task 6: `Button.tsx`, `AppLogo.tsx`

**Files:**
- Modify: `src/components/ui/Button.tsx:18-23`
- Modify: `src/components/ui/AppLogo.tsx:17`

**Interfaces:**
- Produces: `Button`'s `primary` variant no longer hardcodes `text-white`; every consumer of `<Button variant="primary">` (dozens of call sites site-wide) inherits the fix automatically — no other file needs editing for this specific change.

- [ ] **Step 1: Update `Button.tsx` variants**

```ts
const VARIANTS = {
  primary:   "bg-accent text-accent-contrast hover:bg-accent-hover",
  secondary: "border border-border-default text-text-secondary hover:border-accent-soft/50 hover:text-text-primary",
  danger:    "border border-red-400/40 text-red-400 hover:bg-red-400/10",
  ghost:     "text-text-muted hover:text-text-primary hover:bg-fill-2",
};
```

(Drops `shadow-soft` from `primary` — retired token, Precision uses flat fills not glows; migrates `secondary` off legacy `border-outline` to `border-border-default`.)

- [ ] **Step 2: Fix `AppLogo.tsx`'s fold-shadow fill**

Line 17, change:
```tsx
<path d="M15.2 5L17.5 7.3H16C15.5582 7.3 15.2 6.94183 15.2 6.5V5Z" fill="var(--color-paper)" />
```
to:
```tsx
<path d="M15.2 5L17.5 7.3H16C15.5582 7.3 15.2 6.94183 15.2 6.5V5Z" fill="rgba(0, 0, 0, 0.18)" />
```

Everything else in this file (the accent-colored tile background at line 9, the white page shape at line 14, the accent-colored "text line" rects at lines 18–19) already works correctly once `--color-accent` is amber — no other edit needed. The folded-corner page silhouette is a good, timeless mark independent of the retired "paper" *color*; only its one paper-cream fill needed to go.

- [ ] **Step 3: Update the comment at lines 10–12** (now stale — no longer "mirrors the paper-tab"):

```tsx
{/* The page — a rounded rect with its top-right corner folded down: a page
    worth flagging. The fold's shadow is a plain black tint now, not the
    retired paper-cream fill. */}
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: no errors. Manually load `/` and `/pricing` in a browser; confirm every primary button (amber fill) has legible dark text, not invisible/low-contrast white-on-amber.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/Button.tsx src/components/ui/AppLogo.tsx
git commit -m "fix(ui): Button primary uses accent-contrast text; AppLogo drops paper fill"
```

---

### Task 7: `ToastProvider` warn-color reconciliation + `PrimeStyles` theme files

**Files:**
- Modify: `src/components/ui/ToastProvider.tsx:70-75`
- Modify: `public/primereact-themes/dark/theme.css:15-16,49-50,181-190`
- Modify: `public/primereact-themes/light/theme.css:15-16,49-50,181-190`

**Interfaces:**
- Produces: toast "warn" no longer collides hue-wise with the brand accent; PrimeReact-rendered components (used somewhere in the editor per the `primereact`/`primeicons` deps) finally match the app's actual accent instead of a generic indigo `#818cf8`/`#6366f1` that was never rebranded through either prior redesign.

- [ ] **Step 1: Move `ToastProvider`'s warn color off amber**

In the `COLORS` map (around line 70–75), change `warn`'s Tailwind classes from `amber-400`/`amber-400/30`/`amber-400/8` to `sky-400`/`sky-400/30`/`sky-400/8` — keeps `info` on the brand accent, `success` emerald, `error` red, and now `warn` distinctly blue rather than visually identical to every primary CTA and accent-colored icon on the page.

- [ ] **Step 2: Update PrimeReact dark theme primary color**

In `public/primereact-themes/dark/theme.css`:
```css
--primary-color: #f5a623;
--primary-color-text: #0a0a0a;
```
and the `--highlight-*` pair (line 49–50):
```css
--highlight-bg: rgba(245, 166, 35, 0.16);
--highlight-text-color: rgba(255, 255, 255, 0.87);
```
and the `--primary-50`…`--primary-900` ramp (lines 181–190) — replace with a monochrome-amber ramp tinted from the new accent (lightest to darkest, keeping the same 10-step structure):
```css
--primary-50:#fef6e9;
--primary-100:#fce7bf;
--primary-200:#fad894;
--primary-300:#f8c86a;
--primary-400:#f7b846;
--primary-500:#f5a623;
--primary-600:#d1891d;
--primary-700:#ad6f18;
--primary-800:#895613;
--primary-900:#5f3c0d;
```

- [ ] **Step 3: Update PrimeReact light theme primary color**

In `public/primereact-themes/light/theme.css`, same pattern with `#8a5a00`/`#fafafa`:
```css
--primary-color: #8a5a00;
--primary-color-text: #fafafa;
--highlight-bg: #fdf1de;
--highlight-text-color: #6f4700;
--primary-50:#fdf6ec;
--primary-100:#f9e4c4;
--primary-200:#f4d29c;
--primary-300:#efc074;
--primary-400:#ecae4c;
--primary-500:#8a5a00;
--primary-600:#734b00;
--primary-700:#5c3c00;
--primary-800:#452d00;
--primary-900:#2e1e00;
```

- [ ] **Step 4: Verify**

Run: `npm run dev`, open `/app`, exercise any PrimeReact-rendered control (check the editor's settings/template pickers — grep `from "primereact"` in `src/components/app/` if unsure which control renders one) and confirm it now uses amber, not indigo.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/ToastProvider.tsx public/primereact-themes/dark/theme.css public/primereact-themes/light/theme.css
git commit -m "fix(ui): dereference toast warn color from brand accent; rebrand PrimeReact theme to Precision"
```

---

## Milestone 2 — Landing page signature moments

### Task 8: Hero headline + ambient glow + `CursorSpotlight` mount

**Files:**
- Modify: `src/components/marketing/Landing.tsx:739-843`

- [ ] **Step 1: Replace the 3-stop gradient headline (line 769)**

A 3-stop gradient (`from-accent via-accent-soft to-accent`) told a story with two burgundy shades; one amber has no second shade to gradient toward. Replace:
```tsx
className="bg-linear-to-r from-accent via-accent-soft to-accent bg-clip-text text-transparent"
```
with a flat accent color:
```tsx
className="text-accent"
```

- [ ] **Step 2: Simplify the ambient glow blobs (lines 742–744) to single-accent**

Old code referenced `bg-accent`/`bg-accent-warm`/`bg-accent` (three blobs, two colors — `accent-warm` is retired). Replace with two `bg-accent` blobs at the same two opacities the file already used for the first/third blob (`opacity-[0.07]`, `opacity-[0.05]`), dropping the middle "warm" blob entirely — Precision is single-accent, a second hue undermines that.

- [ ] **Step 3: Mount `CursorSpotlight`**

Add `import { CursorSpotlight } from "@/components/ui/CursorSpotlight";` and ensure the hero section's root element has `className="relative ..."` (it should already, given the absolutely-positioned glow blobs); mount `<CursorSpotlight />` as the first child of that root, before the glow blobs.

- [ ] **Step 4: Add a staggered entrance to the hero's eyebrow/headline/subhead/CTA column**

This is the spec's "tight, staggered reveal animations for content entering the viewport" applied to the one section that doesn't already go through the mid-page `Section` component's own stagger-reveal wrapper (lines 107–171) — the hero is bespoke markup. Add these variants near the top of the file (or inline in the hero block):

```tsx
const heroStagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};
const heroItem = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: DURATION.slow, ease: EASE_PRECISION } },
};
```

(`import { motion } from "framer-motion"; import { DURATION, EASE_PRECISION, usePrefersReducedMotion } from "@/lib/motion";` at the top of the file if not already imported.)

Read the hero block (lines 739–843) and wrap its outer content column (the element containing the eyebrow pill at ~756–758, the two-line headline at ~763–772, the subhead paragraph, and the CTA button row that follow it) in `<motion.div variants={heroStagger} initial={reducedMotion ? "show" : "hidden"} animate="show">`, then change each of those four direct children (eyebrow pill, headline block, subhead, CTA row) from a plain element to `<motion.div variants={heroItem}>` wrapping its existing content unchanged — this is additive (new wrapper elements + a `variants` prop), not a rewrite of what's inside them. Call `const reducedMotion = usePrefersReducedMotion();` inside the `Landing` component (it's a client component already, given its use of `useState`/framer-motion elsewhere in the file).

- [ ] **Step 5: Verify**

Run: `npm run dev`, open `/`, confirm the hero headline's second line renders solid amber (not a gradient), a cursor-tracked glow appears when moving the mouse over the hero, and the eyebrow/headline/subhead/CTA fade/slide in with a short stagger on page load. With OS "reduce motion" enabled, confirm the same content appears immediately with no stagger delay.

- [ ] **Step 6: Commit**

```bash
git add src/components/marketing/Landing.tsx
git commit -m "feat(landing): flat-amber hero headline + CursorSpotlight"
```

---

### Task 9: Rewrite `RevealHero.tsx` — new creative concept, no paper dependency

**Files:**
- Modify: `src/components/marketing/RevealHero.tsx` (full rewrite)

**Interfaces:**
- Consumes: `usePrefersReducedMotion` from `src/lib/motion.ts`
- Produces: same external contract — a `<RevealHero />` component with no props, mounted by `Landing.tsx` at the same call site (no changes needed in `Landing.tsx` for this task beyond what Task 8 already touched).

The old component interpolated background/text color from `--color-bg`/`--color-text-primary` toward the now-retired `--color-paper`/`--color-paper-ink` via `color-mix()`, and rendered the "revealed" state in Fraunces. Precision's replacement keeps the same underlying product story (raw Markdown syntax becoming clean text) but tells it entirely through **opacity, weight, and one accent color** on a constant background — no color-mix, no paper dependency, no Fraunces.

- [ ] **Step 1: Rewrite the component**

```tsx
"use client";

import { useRef } from "react";
import { useScroll, useTransform, motion } from "framer-motion";
import { usePrefersReducedMotion } from "@/lib/motion";

/**
 * "Precision Reveal" — a scroll-driven demonstration of Booklet's actual
 * product mechanic (raw Markdown syntax becoming clean, readable text),
 * told through opacity/weight/color choreography on a CONSTANT background,
 * not a color transformation toward a "paper" surface (the old "Ink & Paper"
 * concept this replaces). Syntax markers (`##`, `**`) dim to near-invisible
 * as scroll progresses; the prose they wrap gains full-opacity text-primary
 * color and, for the heading only, the brand accent — ending in a plain
 * hairline-bordered card, not a paper-toned one.
 */
const SAMPLE = {
  syntaxOpen: "## ",
  heading: "Incident Report",
  syntaxBoldOpen: "**",
  label: "Severity:",
  syntaxBoldClose: "** ",
  body: "P1, resolved in 13 minutes.",
};

export function RevealHero() {
  const ref = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });

  const progress = useTransform(scrollYProgress, [0.2, 0.6], [0, 1]);
  const syntaxOpacity = useTransform(progress, [0, 1], [1, 0]);
  const proseColor = useTransform(
    progress,
    [0, 1],
    ["var(--color-text-muted)", "var(--color-text-primary)"],
  );
  const headingColor = useTransform(
    progress,
    [0, 1],
    ["var(--color-text-muted)", "var(--color-accent)"],
  );
  const proseWeight = useTransform(progress, [0, 1], [400, 600]);

  if (reducedMotion) {
    // Render the fully-revealed end state statically — no scroll listener,
    // no interpolation, matching every other reduced-motion fallback.
    return (
      <div className="rounded-none border-y border-border-subtle px-6 py-24">
        <p className="max-w-2xl text-[clamp(20px,3.4vw,32px)] leading-normal font-semibold text-accent">
          {SAMPLE.heading}
        </p>
        <p className="mt-2 max-w-2xl text-[clamp(20px,3.4vw,32px)] leading-normal font-medium text-text-primary">
          <span className="font-semibold">{SAMPLE.label}</span> {SAMPLE.body}
        </p>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative h-[160vh]">
      <div className="sticky top-0 flex h-screen items-center overflow-hidden rounded-none border-y border-border-subtle px-6">
        <div className="max-w-2xl">
          <p className="text-[clamp(20px,3.4vw,32px)] leading-normal">
            <motion.span style={{ opacity: syntaxOpacity }} className="font-mono text-[0.75em] text-text-muted">
              {SAMPLE.syntaxOpen}
            </motion.span>
            <motion.span style={{ color: headingColor, fontWeight: proseWeight }}>
              {SAMPLE.heading}
            </motion.span>
          </p>
          <p className="mt-2 text-[clamp(20px,3.4vw,32px)] leading-normal">
            <motion.span style={{ opacity: syntaxOpacity }} className="font-mono text-[0.75em] text-text-muted">
              {SAMPLE.syntaxBoldOpen}
            </motion.span>
            <motion.span style={{ color: proseColor, fontWeight: proseWeight }}>{SAMPLE.label}</motion.span>
            <motion.span style={{ opacity: syntaxOpacity }} className="font-mono text-[0.75em] text-text-muted">
              {SAMPLE.syntaxBoldClose}
            </motion.span>
            <motion.span style={{ color: proseColor, fontWeight: proseWeight }}> {SAMPLE.body}</motion.span>
          </p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npm run dev`, open `/`, scroll through the hero section, confirm: syntax markers (`##`, `**`) fade out, the heading turns amber and gains weight, the body text darkens/thickens — all against a constant background (no color shift on the section itself). Then enable "reduce motion" in OS accessibility settings, reload, and confirm the static fully-revealed version renders immediately with no scroll-driven animation.

- [ ] **Step 3: Commit**

```bash
git add src/components/marketing/RevealHero.tsx
git commit -m "feat(landing): replace dark→paper RevealHero with Precision Reveal (no paper dependency)"
```

---

### Task 10: Redesign `ProblemMock`'s paper-tab + final CTA glow

**Files:**
- Modify: `src/components/marketing/Landing.tsx:309-421` (`ProblemMock`), `:1316-1367` (final CTA)

- [ ] **Step 1: Replace the paper-tab (lines 366–376)**

The old element was a small `bg-paper` tab rotated above the "after" card, captioned "the one deliberate 'this is now a booklet' cue." Replace it with an amber corner-accent detail that signals the same "this is the payoff state" idea without paper: a thin amber rule along the top edge of the after-card, plus a small amber-tinted pill label. Concretely, replace the `bg-paper` tab `<div>` with:

```tsx
<div className="absolute -top-2.5 left-4 rounded-full border border-accent/30 bg-accent-dim px-2.5 py-0.5 text-2xs font-medium text-accent">
  Shared as a Booklet link
</div>
```

(reusing the existing "Shared as a Booklet link" copy from the old label, since that line itself is brand-neutral — only the paper-tab visual carrier is being replaced) and add `border-t-2 border-t-accent` to the after-card's existing className so the top edge carries a thin amber accent line.

- [ ] **Step 2: Replace `shadow-glow` on the final CTA card (line 1323)**

`--shadow-glow` is retired. Change:
```tsx
className="... border-accent/15 bg-bg-elevated ... shadow-glow"
```
to:
```tsx
className="... border-accent/15 bg-bg-elevated shadow-card"
```
and mount a `<CursorSpotlight />` inside this CTA section (it already has ambient glow blobs at lines 1327–1328 — simplify those to a single `bg-accent opacity-[0.13]` blob, matching Task 8's single-accent decision, dropping the second `accent-soft` blob).

- [ ] **Step 3: Verify**

Run: `npm run dev`, open `/`, scroll to the problem section and confirm the after-card has a clean amber top-edge accent and pill label instead of a paper-colored tab; scroll to the final CTA and confirm it has a hairline border + single subtle amber glow, not the old blurred `shadow-glow`.

- [ ] **Step 4: Commit**

```bash
git add src/components/marketing/Landing.tsx
git commit -m "feat(landing): replace paper-tab and CTA glow with Precision equivalents"
```

---

### Task 11: Third-party brand-color reconciliation across marketing pages

**Files:**
- Modify: `src/components/marketing/Landing.tsx:999-1003`
- Modify: `src/app/mcp/page.tsx:25-30`
- Modify: `src/app/mcp-setup/page.tsx:357,731,858`
- Modify: `src/app/integrations/page.tsx:352,411-412`
- Modify: `src/app/changelog/page.tsx:26-31`

**Interfaces:**
- Produces: a documented, consistent policy — Anthropic's actual brand orange (`#D97757`) replaces every generic Tailwind `amber-500`/`orange-500` used specifically for **Claude** badges/pills (these previously coincidentally looked like the *old* accent-adjacent amber and now would look confusingly identical to the *new* brand accent); every other third-party color (Cursor blue, Windsurf teal, VS Code sky, Zed purple, GitHub violet, HTTP-method colors) is left untouched — those don't collide with amber and are legitimate distinguishing identity, not decoration. The `ApiBlock` code-block mockup's macOS traffic-light dots (`Landing.tsx`, literal `bg-[#ff5f57]`/`bg-[#febc2e]`/`bg-[#28c840]` hexes, already commented "intentional literal colours, not design tokens") are a deliberate non-change too — they mimic real OS chrome, aren't a Booklet brand color, and don't compete with the single accent; leave them untouched.

- [ ] **Step 1: `Landing.tsx` line 999–1003** — Claude MCP integration card icon: change `bg-orange-500/10 text-orange-500` to `bg-[#D97757]/10 text-[#D97757]`; update the adjacent comment to note this is Anthropic's actual brand color, chosen deliberately to stay distinct from Booklet's own new amber accent.

- [ ] **Step 2: `mcp/page.tsx` lines 25–30** (`EDITORS` data) — change Claude Desktop/Claude.ai entries from `bg-amber-500/15 text-amber-400` to `bg-[#D97757]/15 text-[#D97757]`; leave Cursor/Windsurf/VS Code/Zed entries unchanged.

- [ ] **Step 3: `mcp-setup/page.tsx`** — line 357 (Claude.ai plan-required banner) and line 731 (overview icon tile, currently `bg-orange-500/10 text-orange-500`) and line 858 (badge, currently `bg-amber-500/15 text-amber-400`): same substitution, `#D97757` in place of generic amber/orange.

- [ ] **Step 4: `integrations/page.tsx`** — line 352 (MCP badge, `border-amber-500/30 bg-amber-500/8 text-amber-400`) and lines 411–412 (Claude Desktop/Claude.ai "Works with" pills): same substitution.

- [ ] **Step 5: `changelog/page.tsx` `TAG_COLORS` (lines 26–31)** — "Fixed" currently `bg-amber-500/15 text-amber-400`. Reassign to `bg-violet-500/15 text-violet-400` (New stays emerald, Improved stays blue, Removed stays red) so no changelog tag visually matches the brand accent.

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit && npm run build`
Expected: passes. Manually check `/mcp`, `/mcp-setup`, `/integrations`, `/changelog`, and the Landing integrations section for the recolored badges.

- [ ] **Step 7: Commit**

```bash
git add src/components/marketing/Landing.tsx src/app/mcp/page.tsx src/app/mcp-setup/page.tsx src/app/integrations/page.tsx src/app/changelog/page.tsx
git commit -m "fix(marketing): move Claude badges to Anthropic's actual brand color, off collision with new accent"
```

---

## Milestone 3 — Secondary marketing pages: font/border consistency pass

### Task 12: Apply `font-display` consistently + migrate `border-outline`

**Files:**
- Modify: `src/app/integrations/page.tsx:106`
- Modify: `src/app/mcp/page.tsx:104`
- Modify: `src/app/privacy/page.tsx:18,32,43`
- Modify: `src/app/terms/page.tsx:17,31,42`
- Modify: `src/app/templates/page.tsx:50`
- Modify: `src/app/templates/[slug]/page.tsx:121-123`
- Modify: `src/app/explore/page.tsx:31-36`
- Modify: `src/app/explore/ExploreClient.tsx:150,185,240`
- Modify: `src/app/tags/page.tsx:25-36,40,51-71`
- Modify: `src/app/tags/[tag]/page.tsx:55-77,86-88`
- Modify: `src/app/api-docs/page.tsx:52,73`
- Modify: `src/app/mcp/page.tsx:78`
- Modify: `src/app/mcp-setup/page.tsx` (pervasive `border-outline`)

**Interfaces:**
- Produces: every page-level H1 across the marketing surface consistently carries `font-display` (now Geist Sans — a no-visual-regression rename since `about`/`pricing`/`changelog`/`api-docs` already used it); no page still references the legacy `border-outline`/`--color-outline` token.

- [ ] **Step 1: Add `font-display` to H1s currently missing it**

For each of `integrations/page.tsx:106`, `mcp/page.tsx:104`, `privacy/page.tsx:43`, `terms/page.tsx:42`, `templates/page.tsx:50`, `templates/[slug]/page.tsx:121-123`, `explore/page.tsx` (the H1 in the 31–36 header block), `tags/page.tsx:40`, `tags/[tag]/page.tsx:86-88`: append ` font-display` to the H1's existing `className` string. Do not change any other class on these elements.

- [ ] **Step 2: Migrate every remaining `border-outline` → `border-border-default` (or `border-border-subtle` for dashed/empty-state uses)**

Grep first to get the authoritative current list:

Run: `grep -rn "border-outline\|bg-outline\|ring-outline\|--color-outline" src/app src/components`

For every match in `privacy/page.tsx` (line 18 `Section` H2, line 32 header link), `terms/page.tsx` (line 17, 31), `tags/page.tsx` (lines 25–36 header, line 62–64 tag pills, line 47 dashed empty state), `tags/[tag]/page.tsx` (lines 55–77 header, 124–129 dashed empty state), `explore/ExploreClient.tsx` (line 150 tab bar, line 185 search input, line 240 dashed empty state — the last one to `border-dashed border-border-subtle`, matching the same empty-state convention used elsewhere), `api-docs/page.tsx` (line 52 `Section` H2 border, line 73 `Pre` border), `mcp/page.tsx` (line 78 header, line 200–207 config `<pre>`, line 231 use-case tag), and every occurrence in `mcp-setup/page.tsx` (`SectionAnchor`, `CopyButton`, `CodeBlock`, `InlineCode`, OS toggle, field boxes, API-key input, platform tabs, instructions panel, tools table, troubleshooting `<details>`, security note — all listed with line numbers in the earlier audit): replace `border-outline` with `border-border-default`, and dashed empty-state borders (`border-dashed border-outline`) with `border-dashed border-border-subtle` specifically (a lighter weight reads correctly for an empty/placeholder state).

- [ ] **Step 3: Confirm no consumer of `--color-outline` remains**

Run: `grep -rn "border-outline\|bg-outline\|ring-outline\|--color-outline" src/`
Expected: zero matches outside `src/app/globals.css`'s own token definition (which Task 27 removes once this is confirmed clean).

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npm run build`

- [ ] **Step 5: Commit**

```bash
git add src/app/integrations/page.tsx src/app/mcp/page.tsx src/app/mcp-setup/page.tsx src/app/privacy/page.tsx src/app/terms/page.tsx src/app/templates/page.tsx "src/app/templates/[slug]/page.tsx" src/app/explore/page.tsx src/app/explore/ExploreClient.tsx src/app/tags/page.tsx "src/app/tags/[tag]/page.tsx" src/app/api-docs/page.tsx
git commit -m "style: apply font-display consistently to marketing H1s; migrate legacy border-outline to border-border-default"
```

---

### Task 13: Redesign `TemplatePreviewCard`'s paper preview

**Files:**
- Modify: `src/components/marketing/TemplatePreviewCard.tsx:68-80`

- [ ] **Step 1: Replace the `bg-paper`/`text-paper-ink` mini-preview block**

Replace:
```tsx
{/* Mini paper-page preview — an honest excerpt of the template's own content */}
<div className="bg-paper p-4 text-paper-ink">
  {heading && (
    <p className="font-display text-[15px] font-medium leading-snug line-clamp-1">
      {heading}
    </p>
  )}
  {body.map((line, i) => (
    <p key={i} className="mt-1.5 text-xs leading-relaxed text-paper-ink-secondary line-clamp-1">
      {line}
    </p>
  ))}
</div>
```
with:
```tsx
{/* Mini document preview — an honest excerpt of the template's own content,
    on a plain hairline-bordered surface rather than the retired paper tone */}
<div className="border-b border-border-default bg-bg-soft p-4">
  {heading && (
    <p className="font-display text-[15px] font-medium leading-snug text-text-primary line-clamp-1">
      {heading}
    </p>
  )}
  {body.map((line, i) => (
    <p key={i} className="mt-1.5 text-xs leading-relaxed text-text-secondary line-clamp-1">
      {line}
    </p>
  ))}
</div>
```

- [ ] **Step 2: Verify**

Run: `npm run dev`, open `/templates`, confirm each card's mini preview now renders on a neutral `bg-soft` panel with a hairline bottom border, not a cream paper surface.

- [ ] **Step 3: Commit**

```bash
git add src/components/marketing/TemplatePreviewCard.tsx
git commit -m "feat(templates): replace paper mini-preview with hairline-bordered neutral panel"
```

---

## Milestone 4 — Editor / app

### Task 14: Rewrite `TopBar.tsx`'s `PublishReveal` + migrate its legacy `border-outline`

**Files:**
- Modify: `src/components/app/TopBar.tsx:676-726` (`PublishReveal`)
- Modify: `src/components/app/TopBar.tsx:501,508,599,664,1020,1026,1042,1254,1260,1273,1316,1384` (legacy `border-outline`/`ring-outline` → `border-border-default`)

**Interfaces:**
- Consumes: `DURATION` from `src/lib/motion.ts` (optional — inline ms constants are also fine here, matching the existing file's style of local `const ..._MS` values)
- Produces: same external trigger contract as before (whatever prop/state currently flips `RevealPhase` continues to do so) — only the phase names and the paint change.

- [ ] **Step 1: Replace the phase constants and comment (lines 676–688)**

```tsx
// ---------------------------------------------------------------------------
// Publish reveal — a brief, terminal-native flash that plays once,
// full-viewport, the moment a draft becomes published: a compact
// "compiling" pulse followed by a success tint, then a fade. Precision's
// motion identity is restraint + precision, not a color-mode transformation
// (the "Reveal"-era dark→paper crossfade this replaces) — this keeps the
// same trigger and timing shape, just repainted.
// Timing follows the same FADE_MS = 220 pattern established by AppLoader.
// ---------------------------------------------------------------------------
const REVEAL_COMPILE_MS = 160;
const REVEAL_SUCCESS_MS = 160;
const REVEAL_FADE_MS = 220;

type RevealPhase = "compiling" | "success" | "fading";
```

- [ ] **Step 2: Replace the paint (lines 715–726)**

```tsx
className="fixed inset-0 z-50 pointer-events-none flex items-center justify-center"
style={{
  backgroundColor: phase === "compiling" ? "var(--color-bg)" : "var(--color-accent-dim)",
  opacity: phase === "fading" ? 0 : 1,
  transition: `opacity ${REVEAL_FADE_MS}ms ease-out, background-color ${REVEAL_SUCCESS_MS}ms ease-out`,
}}
>
  {phase !== "fading" && (
    <span className="font-mono text-sm text-accent">
      {phase === "compiling" ? "Publishing…" : "Published ✓"}
    </span>
  )}
```

Update every reference to the old phase literals `"dark"`/`"paper"` elsewhere in this component's state machine (the `useState<RevealPhase>` initializer and whatever `setTimeout`/`setPhase` calls drive the sequence) to `"compiling"`/`"success"` respectively — read the surrounding ~20 lines before/after this block to find them, since the exact state-transition code wasn't fully quoted in this plan's research pass.

- [ ] **Step 3: Migrate this file's remaining legacy `border-outline`/`ring-outline` usages**

`TopBar.tsx` is the single heaviest remaining consumer of the legacy token: lines 501, 508, 599, 664, 1020, 1026, 1042, 1254, 1260, 1273, 1316, 1384 (per the earlier audit — line 1354's `border-accent/20` is unrelated and untouched). Replace every `border-outline`/`ring-outline` occurrence in that list with `border-border-default`/`ring-border-default` as appropriate to the surrounding class (a `ring-*` utility should become `ring-border-default` only if the original was a border-colored ring; if any of these lines turn out on inspection to be `bg-outline` rather than `border-outline`, use `bg-fill-2` instead, matching the same "outline was always standing in for a neutral surface/border" convention used throughout this plan).

- [ ] **Step 4: Verify manually**

Run: `npm run dev`, open `/app`, write a short doc, publish it, and confirm the flash reads "Publishing…" in monospace over a dark tint, then briefly "Published ✓" over an amber-tinted flash, then fades — with no paper-colored frame at any point. Confirm the `SettingsPanel` dropdown, drafts/templates drawer views, and other bordered chrome in the top bar still render a visible hairline border after the token migration.

- [ ] **Step 5: Commit**

```bash
git add src/components/app/TopBar.tsx
git commit -m "feat(editor): replace dark→paper PublishReveal with terminal-native Precision sequence"
```

---

### Task 15: Command palette (`⌘K`)

**Files:**
- Create: `src/components/app/CommandPalette.tsx`
- Modify: `src/app/app/AppClient.tsx` (mount point + keyboard listener)

**Interfaces:**
- Produces: `<CommandPalette open={boolean} onOpenChange={(open: boolean) => void} />`, a signature Precision-identity interaction surfaced in the editor.

- [ ] **Step 1: Write `CommandPalette.tsx`**

```tsx
"use client";

import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/lib/constants";
import { navigateWithViewTransition, usePrefersReducedMotion } from "@/lib/motion";

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const reducedMotion = usePrefersReducedMotion();

  function go(path: string) {
    onOpenChange(false);
    navigateWithViewTransition(() => router.push(path), reducedMotion);
  }

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Command palette"
      className="fixed left-1/2 top-24 z-50 w-full max-w-lg -translate-x-1/2 rounded-card border border-border-default bg-bg-elevated shadow-glass"
    >
      <Command.Input
        placeholder="Jump to…"
        className="w-full border-b border-border-subtle bg-transparent px-4 py-3 text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none"
      />
      <Command.List className="max-h-80 overflow-y-auto p-2">
        <Command.Empty className="px-3 py-6 text-center text-sm text-text-muted">
          No results.
        </Command.Empty>
        <Command.Group heading="Navigate" className="text-2xs uppercase tracking-wider text-text-muted px-2 py-1">
          <Command.Item
            onSelect={() => go(ROUTES.myPages)}
            className="cursor-pointer rounded-lg px-3 py-2 text-sm text-text-primary aria-selected:bg-fill-2"
          >
            My Pages
          </Command.Item>
          <Command.Item
            onSelect={() => go(ROUTES.app)}
            className="cursor-pointer rounded-lg px-3 py-2 text-sm text-text-primary aria-selected:bg-fill-2"
          >
            New page
          </Command.Item>
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
}
```

- [ ] **Step 2: Mount it in `AppClient.tsx` with a global `⌘K`/`Ctrl+K` listener**

Add local state `const [paletteOpen, setPaletteOpen] = useState(false);` and an effect:

```tsx
useEffect(() => {
  function handleKeyDown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      setPaletteOpen((open) => !open);
    }
  }
  window.addEventListener("keydown", handleKeyDown);
  return () => window.removeEventListener("keydown", handleKeyDown);
}, []);
```

Render `<CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />` alongside the existing top-level JSX returned by `AppClient`.

- [ ] **Step 3: Verify manually**

Run: `npm run dev`, open `/app`, press `⌘K` (or `Ctrl+K`), confirm the palette opens, typing filters the two items, selecting "My Pages" navigates there and closes the palette. In a browser that supports the View Transitions API (current Chrome/Edge), confirm the navigation has a brief native cross-fade rather than an instant hard cut; this is a progressive enhancement, so Safari/Firefox falling back to an instant navigation is expected, not a bug.

- [ ] **Step 4: Commit**

```bash
git add src/components/app/CommandPalette.tsx src/app/app/AppClient.tsx
git commit -m "feat(editor): add command palette (⌘K)"
```

---

### Task 16: Delete dead `TemplatesDialog.tsx`; migrate remaining editor `border-outline`

**Files:**
- Delete: `src/components/app/TemplatesDialog.tsx`
- Modify: `src/components/app/PasteInput.tsx`, `src/components/app/DraftsDialog.tsx`, `src/app/app/error.tsx` (legacy `border-outline` migration)

**Interfaces:**
- Produces: confirms and acts on the earlier research finding that `TemplatesDialog.tsx` has zero import sites anywhere in `src/`.

- [ ] **Step 1: Re-confirm zero imports before deleting**

Run: `grep -rn "TemplatesDialog" src/ --include="*.tsx" --include="*.ts"`
Expected: only the file's own `export function TemplatesDialog` declaration. If any import site exists that the earlier research missed, stop and wire it up properly instead of deleting — do not delete a component something actually renders.

- [ ] **Step 2: Delete the file**

```bash
git rm src/components/app/TemplatesDialog.tsx
```

- [ ] **Step 3: Migrate remaining `border-outline` in `app/error.tsx`, `DraftsDialog.tsx`**

`src/app/app/error.tsx:12` — `border-outline` → `border-border-default`.
`src/components/app/DraftsDialog.tsx` lines 174, 179, 207, 234 — same substitution.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npm run build`
Expected: passes (confirms nothing referenced the deleted file).

- [ ] **Step 5: Commit**

```bash
git add -A src/components/app/ src/app/app/error.tsx
git commit -m "chore(editor): remove dead TemplatesDialog; migrate remaining border-outline usages"
```

---

## Milestone 5 — Published page & related surfaces

### Task 17: `AuthLayout.tsx` full rewrite

**Files:**
- Modify: `src/components/auth/AuthLayout.tsx` (full rewrite of lines 22–60, the left editorial panel)

**Interfaces:**
- Produces: same external contract (`<AuthLayout>{children}</AuthLayout>`) — only the left panel's content changes; the right-pane form-card wrapper (line 60, `border-border-subtle bg-bg-elevated/60 ... shadow-card`) is already token-clean and needs no edit.

- [ ] **Step 1: Replace the left panel (roughly lines 22–46 — the ambient glow blobs, the `font-display font-display-hero` headline, and the `bg-paper`/`font-display-body` "Incident Report" mock card)**

```tsx
<div className="relative hidden overflow-hidden bg-bg-soft p-12 lg:flex lg:flex-col lg:justify-center">
  <div aria-hidden className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-accent opacity-[0.07] blur-[100px]" />

  <h1 className="relative max-w-md text-balance text-[clamp(28px,3vw,40px)] font-semibold leading-tight text-text-primary">
    Written in Markdown. Read by everyone else.
  </h1>

  <div className="relative mt-8 max-w-sm rounded-2xl border border-border-default bg-bg-elevated p-6 shadow-card">
    <p className="text-[15px] font-medium text-text-primary">Incident Report</p>
    <p className="mt-2 text-sm leading-relaxed text-text-secondary">
      <span className="font-semibold text-text-primary">Severity:</span> P1, resolved in 13 minutes.
    </p>
  </div>
</div>
```

This drops: the second `accent-warm` glow blob (retired token, and Precision is single-accent per Task 8/10's precedent), the Fraunces `font-display-hero`/`font-display-body` classes (plain `font-semibold`/`font-medium` weight now carries the emphasis Geist Sans provides natively), and the entire `bg-paper`/`text-paper-ink`/`text-paper-ink-secondary`/`shadow-print` treatment — replaced with the same hairline-bordered neutral card pattern used everywhere else in this redesign (`border-border-default bg-bg-elevated shadow-card`).

- [ ] **Step 2: Update the file's doc comment (lines 4–20)** to describe the new panel instead of citing "The Reveal"/`RevealHero.tsx`'s paper transformation — note it now shows a static, neutral example card, not a paper-toned "revealed" state.

- [ ] **Step 3: Verify**

Run: `npm run dev`, open `/sign-in` and `/sign-up`, confirm the left editorial panel shows a hairline-bordered neutral card (no cream/paper color) and the headline renders in Geist Sans at a clean weight.

- [ ] **Step 4: Commit**

```bash
git add src/components/auth/AuthLayout.tsx
git commit -m "feat(auth): replace paper mock card in AuthLayout with Precision hairline card"
```

---

### Task 18: Auth pages — remaining token migration

**Files:**
- Modify: `src/app/sign-in/AuthForm.tsx:7-8`

- [ ] **Step 1: Migrate `INPUT_CLASS`'s legacy border token**

```ts
const INPUT_CLASS =
  "w-full rounded-lg border border-border-default bg-bg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft";
```

(`sign-in/page.tsx`, `sign-up/page.tsx`, and `claim/page.tsx` already use only `text-accent`/`text-accent-soft`, which repaint automatically — no edits needed there.)

- [ ] **Step 2: Verify + commit**

Run: `npx tsc --noEmit`

```bash
git add src/app/sign-in/AuthForm.tsx
git commit -m "style(auth): migrate AuthForm input border off legacy outline token"
```

---

### Task 19: Password-reset feature — data layer

**Files:**
- Modify: `src/lib/db/types.ts` (add `DbPasswordResetToken`)
- Modify: `src/lib/db/auth.ts` (add token CRUD)
- Modify: `src/lib/db/index-specs.mjs` (add indexes)
- Create: `src/lib/auth/password-reset-token.ts`
- Modify: `.env.example` (add `PASSWORD_RESET_TOKEN_PEPPER`, fix stale `CLAIM_TOKEN_SECRET` comment)

**Interfaces:**
- Produces: `generatePasswordResetToken(): string`, `hashPasswordResetToken(raw: string): Promise<string>`, `createPasswordResetToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void>`, `findPasswordResetTokenByHash(tokenHash: string): Promise<DbPasswordResetToken | null>`, `deletePasswordResetToken(tokenHash: string): Promise<void>` — consumed by Task 20's routes.

- [ ] **Step 1: Add the type to `src/lib/db/types.ts`** (alongside `DbSession`)

```ts
export type DbPasswordResetToken = {
  id: string;
  user_id: string;
  token_hash: string;   // HMAC-SHA256(raw token, PASSWORD_RESET_TOKEN_PEPPER)
  created_at: string;
  expires_at: Date;     // BSON Date — TTL index, 30-minute window
};
```

- [ ] **Step 2: Write `src/lib/auth/password-reset-token.ts`** (mirrors `session-token.ts` exactly)

```ts
/**
 * Password-reset token utilities: generation and hashing. Mirrors
 * src/lib/auth/session-token.ts's generate-raw / hash-with-pepper /
 * store-hash-only pattern — the raw token is only ever emailed once and
 * lives in the `password_reset_tokens` collection as a hash, so a database
 * read alone can never produce a usable reset link. Uses its own dedicated
 * pepper (not a reuse of SESSION_TOKEN_PEPPER) so a leaked reset-token
 * pepper can't also compromise live sessions.
 */

import { createId } from "../id";

const TOKEN_LENGTH = 40;

export function generatePasswordResetToken(): string {
  return createId(TOKEN_LENGTH);
}

function getPepperKey(): Promise<CryptoKey> {
  const pepper = process.env.PASSWORD_RESET_TOKEN_PEPPER;
  if (!pepper) {
    throw new Error(
      "PASSWORD_RESET_TOKEN_PEPPER is not set. Password-reset tokens cannot be hashed or verified without it — set PASSWORD_RESET_TOKEN_PEPPER in the environment (see .env.example).",
    );
  }
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pepper),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

export async function hashPasswordResetToken(raw: string): Promise<string> {
  const key = await getPepperKey();
  const buf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
```

- [ ] **Step 3: Add DB helpers to `src/lib/db/auth.ts`** (alongside the session functions, same file)

```ts
type PasswordResetTokenDoc = Omit<DbPasswordResetToken, "id"> & { _id: string };

function toPasswordResetToken(doc: PasswordResetTokenDoc): DbPasswordResetToken {
  const { _id, ...rest } = doc;
  return { id: _id, ...rest };
}

/** Creates a reset token, first deleting any earlier still-live token for this user — only one live reset link at a time. */
export async function createPasswordResetToken(
  userId: string,
  tokenHash: string,
  expiresAt: Date,
): Promise<void> {
  const db = await getDb();
  await db.collection<PasswordResetTokenDoc>("password_reset_tokens").deleteMany({ user_id: userId });
  await db.collection<PasswordResetTokenDoc>("password_reset_tokens").insertOne({
    _id: createId(20),
    user_id: userId,
    token_hash: tokenHash,
    created_at: new Date().toISOString(),
    expires_at: expiresAt,
  });
}

export async function findPasswordResetTokenByHash(tokenHash: string): Promise<DbPasswordResetToken | null> {
  const db = await getDb();
  const doc = await db.collection<PasswordResetTokenDoc>("password_reset_tokens").findOne({ token_hash: tokenHash });
  return doc ? toPasswordResetToken(doc) : null;
}

export async function deletePasswordResetToken(tokenHash: string): Promise<void> {
  const db = await getDb();
  await db.collection<PasswordResetTokenDoc>("password_reset_tokens").deleteOne({ token_hash: tokenHash });
}
```

Add `DbPasswordResetToken` to the `import type { DbSession, DbUser } from "./types";` line at the top of the file.

- [ ] **Step 4: Add indexes to `src/lib/db/index-specs.mjs`** (after the `--- sessions ---` block)

```js
  // --- password_reset_tokens ---
  // Forgot-password flow (src/lib/auth/password-reset-token.ts). token_hash
  // is the authoritative lookup for a reset link; the TTL index expires
  // unused tokens 30 minutes after issuance, matching the email's stated
  // expiry window.
  { collection: "password_reset_tokens", spec: { token_hash: 1 }, options: { unique: true } },
  { collection: "password_reset_tokens", spec: { user_id: 1 } },
  { collection: "password_reset_tokens", spec: { expires_at: 1 }, options: { expireAfterSeconds: 0 } },
```

- [ ] **Step 5: Update `.env.example`**

Add after the `SESSION_TOKEN_PEPPER` block:
```
# Password-reset token hashing — required for the forgot-password flow.
# Dedicated pepper for hashing reset tokens (src/lib/auth/password-reset-token.ts)
# before they're stored in the `password_reset_tokens` collection — same
# fail-closed convention as SESSION_TOKEN_PEPPER: do NOT reuse any other
# secret. Generate with:
#   openssl rand -hex 32
# If unset, reset tokens cannot be hashed or verified (fails closed).
PASSWORD_RESET_TOKEN_PEPPER=

# Transactional email (Resend) — required for the forgot-password flow.
# https://resend.com — free tier covers this product's expected volume.
RESEND_API_KEY=
EMAIL_FROM_ADDRESS=Booklet <noreply@booklet.ashwinsathian.com>
```

Also fix the now-inaccurate aside in the existing `CLAIM_TOKEN_SECRET` comment (remove the trailing `, or (future) resets a forgotten one` clause — password reset ended up using its own dedicated DB-backed token, not the claim-token JWT mechanism, for the same "needs instant revocation" reasoning documented in `docs/BOOKLET_TEXTBOOK.md` §3.1 about sessions).

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit`
Expected: no type errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/db/types.ts src/lib/db/auth.ts src/lib/db/index-specs.mjs src/lib/auth/password-reset-token.ts .env.example
git commit -m "feat(auth): add password-reset-token data layer"
```

---

### Task 20: Password-reset feature — email sending + API routes

**Files:**
- Create: `src/lib/email.ts`
- Create: `src/app/api/auth/forgot-password/route.ts`
- Create: `src/app/api/auth/reset-password/route.ts`
- Modify: `src/lib/auth/schemas.ts` (add `ForgotPasswordSchema`, `ResetPasswordSchema`)
- Modify: `package.json` (add `resend`)

**Interfaces:**
- Consumes: `createPasswordResetToken`, `findPasswordResetTokenByHash`, `deletePasswordResetToken`, `setUserPassword`, `getUserByEmail` (Task 19); `destroyAllSessions` (existing, `src/lib/auth/session.ts`); `hashUserPassword` (existing, `src/lib/auth/password.ts`).
- Produces: `POST /api/auth/forgot-password { email }` → `{ ok: true, message }`; `POST /api/auth/reset-password { token, password }` → `{ ok: true }` or `{ error }`.

- [ ] **Step 1: Install `resend`**

Run: `npm install resend`

- [ ] **Step 2: Write `src/lib/email.ts`**

```ts
import { Resend } from "resend";

function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error(
      "RESEND_API_KEY is not set. Transactional email cannot be sent without it — set RESEND_API_KEY in the environment (see .env.example).",
    );
  }
  return new Resend(apiKey);
}

const FROM_ADDRESS = process.env.EMAIL_FROM_ADDRESS || "Booklet <noreply@booklet.ashwinsathian.com>";

export async function sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
  const resend = getResendClient();
  await resend.emails.send({
    from: FROM_ADDRESS,
    to,
    subject: "Reset your Booklet password",
    html: `
      <div style="font-family: -apple-system, system-ui, sans-serif; max-width: 480px; margin: 0 auto; color: #1a1a1a;">
        <p>Someone requested a password reset for this Booklet account.</p>
        <p>
          <a href="${resetUrl}" style="display:inline-block;background:#f5a623;color:#0a0a0a;padding:10px 20px;border-radius:9999px;text-decoration:none;font-weight:600;">
            Reset password
          </a>
        </p>
        <p style="color:#666;font-size:13px;">
          This link expires in 30 minutes. If you didn't request this, ignore this email — your password won't change.
        </p>
      </div>
    `,
  });
}
```

- [ ] **Step 3: Add schemas to `src/lib/auth/schemas.ts`**

```ts
export const ForgotPasswordSchema = z.object({
  email: EmailSchema,
});

export const ResetPasswordSchema = z.object({
  token: z.string().min(1).max(128),
  password: PasswordSchema,
});
```

- [ ] **Step 4: Write `src/app/api/auth/forgot-password/route.ts`**

```ts
import { NextResponse } from "next/server";
import { getUserByEmail, createPasswordResetToken } from "@/lib/db/auth";
import { generatePasswordResetToken, hashPasswordResetToken } from "@/lib/auth/password-reset-token";
import { isSameOriginRequest } from "@/lib/auth/origin-check";
import { ForgotPasswordSchema } from "@/lib/auth/schemas";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";
import { sendPasswordResetEmail } from "@/lib/email";

export const runtime = "nodejs";

const RESET_TTL_MS = 30 * 60 * 1000;

// Same response on every path — do not leak whether the email has an
// account (same user-enumeration convention as /api/auth/login).
const GENERIC_RESPONSE = { ok: true, message: "If that email has an account, a reset link is on its way." };

export async function POST(req: Request) {
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const ip = getClientIp(req.headers);
  const ipLimit = await checkRateLimit(`forgot-password__ip__${ip}`, 5);
  if (ipLimit) return ipLimit;

  const parsed = ForgotPasswordSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(GENERIC_RESPONSE, { status: 200 });
  }
  const { email } = parsed.data;

  const emailLimit = await checkRateLimit(`forgot-password__email__${email}`, 3);
  if (emailLimit) return emailLimit;

  const user = await getUserByEmail(email);
  if (user && user.password_hash && user.email) {
    const raw = generatePasswordResetToken();
    const tokenHash = await hashPasswordResetToken(raw);
    await createPasswordResetToken(user.id, tokenHash, new Date(Date.now() + RESET_TTL_MS));

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://booklet.ashwinsathian.com";
    const resetUrl = `${siteUrl}/reset-password?token=${encodeURIComponent(raw)}`;

    // Best-effort — a delivery failure must not produce a different
    // response shape/timing than the success path (user enumeration).
    await sendPasswordResetEmail(user.email, resetUrl).catch(() => {});
  }

  return NextResponse.json(GENERIC_RESPONSE, { status: 200 });
}
```

- [ ] **Step 5: Write `src/app/api/auth/reset-password/route.ts`**

```ts
import { NextResponse } from "next/server";
import { findPasswordResetTokenByHash, deletePasswordResetToken, setUserPassword } from "@/lib/db/auth";
import { hashPasswordResetToken } from "@/lib/auth/password-reset-token";
import { hashUserPassword } from "@/lib/auth/password";
import { destroyAllSessions } from "@/lib/auth/session";
import { isSameOriginRequest } from "@/lib/auth/origin-check";
import { ResetPasswordSchema } from "@/lib/auth/schemas";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/request-ip";

export const runtime = "nodejs";

const INVALID_OR_EXPIRED = { error: "This reset link is invalid or has expired." } as const;

export async function POST(req: Request) {
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const ip = getClientIp(req.headers);
  const ipLimit = await checkRateLimit(`reset-password__ip__${ip}`, 10);
  if (ipLimit) return ipLimit;

  const parsed = ResetPasswordSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(INVALID_OR_EXPIRED, { status: 400 });
  }
  const { token, password } = parsed.data;

  const tokenHash = await hashPasswordResetToken(token);
  const resetToken = await findPasswordResetTokenByHash(tokenHash);
  if (!resetToken || resetToken.expires_at.getTime() <= Date.now()) {
    return NextResponse.json(INVALID_OR_EXPIRED, { status: 400 });
  }

  const passwordHash = await hashUserPassword(password);
  await setUserPassword(resetToken.user_id, passwordHash);
  await deletePasswordResetToken(tokenHash);
  // A password reset is a strong signal of compromise recovery — kill every
  // existing session so a stolen cookie doesn't outlive the password it was
  // issued under.
  await destroyAllSessions(resetToken.user_id);

  return NextResponse.json({ ok: true }, { status: 200 });
}
```

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit`
Expected: no type errors. (Full end-to-end verification, including actually sending an email, happens in Task 21 once the UI exists — `RESEND_API_KEY` is unset in most local dev environments, which is expected: the route still needs to type-check and handle that failure gracefully via the `.catch(() => {})` on the send call.)

- [ ] **Step 7: Commit**

```bash
git add src/lib/email.ts src/app/api/auth/forgot-password/route.ts src/app/api/auth/reset-password/route.ts src/lib/auth/schemas.ts package.json package-lock.json
git commit -m "feat(auth): add forgot-password/reset-password API routes"
```

---

### Task 21: Password-reset feature — UI pages

**Files:**
- Create: `src/app/forgot-password/page.tsx`
- Create: `src/app/forgot-password/ForgotPasswordForm.tsx`
- Create: `src/app/reset-password/page.tsx`
- Create: `src/app/reset-password/ResetPasswordForm.tsx`
- Modify: `src/lib/constants.ts:3-12` (add `ROUTES.forgotPassword`, `ROUTES.resetPassword`)
- Modify: `src/app/sign-in/page.tsx` (add "Forgot password?" link)

**Interfaces:**
- Consumes: `AuthLayout` (Task 17), `Button` (Task 6), `POST /api/auth/forgot-password`, `POST /api/auth/reset-password` (Task 20).

- [ ] **Step 1: Add routes to `src/lib/constants.ts`**

```ts
export const ROUTES = {
  home: "/",
  app: "/app",
  publish: (id: string) => `/p/${id}`,
  signIn: "/sign-in",
  signUp: "/sign-up",
  forgotPassword: "/forgot-password",
  resetPassword: "/reset-password",
  myPages: "/my-pages",
  mcpSetup: "/mcp-setup",
  integrations: "/integrations",
} as const;
```

- [ ] **Step 2: Write `src/app/forgot-password/ForgotPasswordForm.tsx`**

```tsx
"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";

const INPUT_CLASS =
  "w-full rounded-lg border border-border-default bg-bg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    }).catch(() => {});
    setSubmitting(false);
    setSent(true);
  }

  if (sent) {
    return (
      <p className="text-sm text-text-secondary text-center">
        If that email has an account, a reset link is on its way. Check your inbox.
      </p>
    );
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="w-full max-w-xs space-y-3">
      <div>
        <label htmlFor="email" className="sr-only">Email</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={INPUT_CLASS}
        />
      </div>
      <Button type="submit" variant="primary" size="md" disabled={submitting} className="w-full justify-center">
        {submitting ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 3: Write `src/app/forgot-password/page.tsx`**

```tsx
import { AuthLayout } from "@/components/auth/AuthLayout";
import { buildMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import Link from "next/link";
import { ROUTES } from "@/lib/constants";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const metadata: Metadata = buildMetadata({
  title: "Forgot password",
  description: "Reset your Booklet account password.",
  pathname: "/forgot-password",
  noIndex: true,
});

export default function ForgotPasswordPage() {
  return (
    <AuthLayout>
      <div className="text-center">
        <p className="text-sm text-text-secondary">Enter your email and we'll send you a reset link.</p>
      </div>
      <ForgotPasswordForm />
      <p className="text-xs text-text-muted text-center">
        <Link href={ROUTES.signIn} className="text-accent hover:text-accent-soft transition-colors">
          Back to sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
```

- [ ] **Step 4: Write `src/app/reset-password/ResetPasswordForm.tsx`**

```tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { ROUTES } from "@/lib/constants";

const INPUT_CLASS =
  "w-full rounded-lg border border-border-default bg-bg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft";

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token, password }),
    }).catch(() => null);

    const data = (await res?.json().catch(() => ({}))) as { error?: string } | undefined;

    if (!res || !res.ok) {
      setError(data?.error ?? "Something went wrong. Please try again.");
      setSubmitting(false);
      return;
    }

    router.push(ROUTES.signIn);
  }

  if (!token) {
    return <p className="text-sm text-red-400 text-center">This reset link is missing its token.</p>;
  }

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="w-full max-w-xs space-y-3">
      <div>
        <label htmlFor="password" className="sr-only">New password</label>
        <input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={256}
          placeholder="At least 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={INPUT_CLASS}
        />
      </div>
      {error && <p role="alert" className="text-xs text-red-400">{error}</p>}
      <Button type="submit" variant="primary" size="md" disabled={submitting} className="w-full justify-center">
        {submitting ? "Please wait…" : "Reset password"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 5: Write `src/app/reset-password/page.tsx`**

```tsx
import { AuthLayout } from "@/components/auth/AuthLayout";
import { buildMetadata } from "@/lib/seo";
import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata: Metadata = buildMetadata({
  title: "Reset password",
  description: "Set a new password for your Booklet account.",
  pathname: "/reset-password",
  noIndex: true,
});

export default function ResetPasswordPage() {
  return (
    <AuthLayout>
      <div className="text-center">
        <p className="text-sm text-text-secondary">Choose a new password for your account.</p>
      </div>
      <Suspense>
        <ResetPasswordForm />
      </Suspense>
    </AuthLayout>
  );
}
```

(`useSearchParams` requires a `Suspense` boundary in the App Router — without it, `next build` fails with a "missing suspense boundary" error on this page specifically.)

- [ ] **Step 6: Add the "Forgot password?" link to `src/app/sign-in/page.tsx`**

Inside the `<AuthForm mode="sign-in" .../>` block's surrounding markup, add (directly below the form, before the existing "No account?" paragraph):

```tsx
<p className="text-xs text-text-muted text-center">
  <Link href={ROUTES.forgotPassword} className="text-accent hover:text-accent-soft transition-colors">
    Forgot your password?
  </Link>
</p>
```

- [ ] **Step 7: Verify end-to-end**

Run: `npm run dev`. Without `RESEND_API_KEY` set, submitting `/forgot-password` should still return the generic success message (the email send fails silently per the `.catch(() => {})`, but check server logs to confirm a token was actually created in Mongo — `mongosh booklet --eval 'db.password_reset_tokens.find()'`). Manually construct a reset URL using that token (`/reset-password?token=<raw-token-from-your-own-test-flow>` — you'll need to log the raw token temporarily in dev, e.g. a `console.log(raw)` in the route, and remove it before committing) and confirm submitting a new password succeeds, and that the old session cookie is now invalid (refreshing `/my-pages` redirects to sign-in).

Run: `npx tsc --noEmit && npm run build`
Expected: both pass, including the `Suspense`-wrapped `reset-password` page building cleanly.

- [ ] **Step 8: Commit**

```bash
git add src/app/forgot-password src/app/reset-password src/lib/constants.ts src/app/sign-in/page.tsx
git commit -m "feat(auth): add forgot-password/reset-password UI"
```

---

## Milestone 6 — Dashboard, published-page surfaces, admin

### Task 22: Dashboard — `MyPagesClient.tsx` and related

**Files:**
- Modify: `src/app/my-pages/MyPagesClient.tsx:455,192,207,511,792,855,863,1078`
- Modify: `src/app/my-pages/page.tsx:56`
- Modify: `src/app/my-pages/versions/[id]/page.tsx:45`
- Modify: `src/app/my-pages/analytics/[id]/page.tsx:35,71,91,100,120`

- [ ] **Step 1: Rename `hover:shadow-print` → `hover:shadow-hard` (line 455)** — matches Task 1's token rename; identical value, no visual change, just keeping the class name in sync with the renamed CSS variable.

- [ ] **Step 2: Migrate remaining `border-outline` (lines 192, 207, 792, 855, 863, 1078)** → `border-border-default` (dashed empty-state at 1078 → `border-border-subtle` per the same convention established in Task 12).

- [ ] **Step 3: `my-pages/page.tsx:56` and `versions/[id]/page.tsx:45`** — same `border-outline` → `border-border-default` migration.

- [ ] **Step 4: `analytics/[id]/page.tsx` lines 35, 71, 91, 100, 120** — every stat/section card on this page uses `border-outline bg-bg-elevated`; migrate all five to `border-border-default bg-bg-elevated`.

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit && npm run build`

- [ ] **Step 6: Commit**

```bash
git add src/app/my-pages src/app/my-pages/versions src/app/my-pages/analytics
git commit -m "style(dashboard): rename shadow-print to shadow-hard; migrate legacy border-outline"
```

---

### Task 23: Published-page surfaces, Team Spaces, published-doc default typeface

**Files:**
- Modify: `src/lib/blocks.ts:139` (default typeface)
- Modify: `src/app/p/[id]/page.tsx:282` (`border-outline`)
- Modify: `src/app/t/[slug]/admin/page.tsx:193,212,221,249` (`border-outline`)
- Modify: `src/app/u/[id]/page.tsx:100-108` (avatar hue policy)

- [ ] **Step 1: Flip the default typeface for new documents**

`src/lib/blocks.ts:139`, change `typeface: "serif",` to `typeface: "sans",` — new documents default to the Precision-consistent sans body per the approved design decision; the existing `"serif"` option (Source Serif 4, preserved in Task 2) remains fully available via the per-document toggle, and already-published documents keep whatever value they were saved with (this only changes the default for documents that have never set the field).

- [ ] **Step 2: Migrate remaining `border-outline`** in `p/[id]/page.tsx:282` and `t/[slug]/admin/page.tsx:193,212,221,249` → `border-border-default`.

- [ ] **Step 3: Avatar-hue policy on `u/[id]/page.tsx`**

The per-user HSL-generated avatar color (lines 100–108) is orthogonal to the brand accent (it's meant to differentiate users from each other, not represent the brand) — leave the HSL generation logic itself untouched, but confirm visually it doesn't clash badly with the new monochrome chrome around it. This is a verify-only step, not a code change, unless the manual check in Step 4 finds an actual clash.

- [ ] **Step 4: Verify**

Run: `npm run dev`. Publish a brand-new test document and confirm its body renders in Geist Sans by default (no `font-reading` class applied). Open an existing/older published page and confirm it still renders in Source Serif 4 if that's what it was saved with (backward compatibility). Open `/u/[some-existing-user-id]` and eyeball the avatar against the new monochrome chrome.

- [ ] **Step 5: Commit**

```bash
git add src/lib/blocks.ts "src/app/p/[id]/page.tsx" "src/app/t/[slug]/admin/page.tsx"
git commit -m "feat(published-page): default new documents to sans typeface; migrate legacy border-outline"
```

---

### Task 24: Admin restyle

**Files:**
- Modify: `src/app/admin/page.tsx`

**Interfaces:**
- Produces: no functional change — `/admin` already uses only `border-border-subtle`/`text-text-*`/one `text-red-400` error state (confirmed token-clean in research), so this task is a verification-only pass plus applying the same `font-display` heading consistency decided in Task 12, if this page has a top-level heading that currently lacks it.

- [ ] **Step 1: Check for a page-level heading and add `font-display` if present and missing**

Read the file, and if there's an `<h1>`/page title element without `font-display`, add it per the Task 12 convention.

- [ ] **Step 2: Verify**

Run: `npm run dev`, open `/admin` (requires `ADMIN_IPS`/`ADMIN_USER_IDS` to be set for your dev IP/user — check `.env.example`'s comment; if not reachable locally, confirm via `npx tsc --noEmit && npm run build` only, and note in the commit message that manual verification requires admin access this environment may not have).

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/page.tsx
git commit -m "style(admin): apply Precision heading consistency"
```

---

## Milestone 7 — New system pages

### Task 25: Root `not-found.tsx` and `global-error.tsx`

**Files:**
- Create: `src/app/not-found.tsx`
- Create: `src/app/global-error.tsx`

**Interfaces:**
- Consumes: `AppLogo`, `Button`, `ROUTES` — same primitives as everywhere else. `global-error.tsx` is a special Next.js App Router convention: it replaces the ENTIRE root layout (including `<html>`/`<body>`) when the root layout itself throws, so it cannot rely on `src/app/layout.tsx` being mounted — it must render its own full HTML document.

- [ ] **Step 1: Write `src/app/not-found.tsx`**

```tsx
import { AppLogo } from "@/components/ui/AppLogo";
import { Button } from "@/components/ui/Button";
import { ROUTES } from "@/lib/constants";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-bg px-6 text-center">
      <AppLogo />
      <div>
        <p className="font-mono text-sm text-text-muted">404</p>
        <h1 className="mt-2 font-display text-2xl font-semibold text-text-primary">Page not found</h1>
        <p className="mt-2 text-sm text-text-secondary">
          This page doesn't exist, or it was never published.
        </p>
      </div>
      <div className="flex gap-3">
        <Button variant="primary" size="md" href={ROUTES.home}>Go home</Button>
        <Button variant="secondary" size="md" href={ROUTES.app}>Write a page</Button>
      </div>
    </main>
  );
}
```

`Button` accepts an `href` prop directly and renders its own internal `next/link` `Link` (see `src/components/ui/Button.tsx:66,91-96`) — do not nest a separate `<Link>` inside it, since `Button` falls back to rendering a plain `<button>` element when `href` is absent, and an anchor nested inside a `<button>` is invalid HTML. The `Link` import above is therefore unused in this file and should be removed from the import list.

- [ ] **Step 2: Write `src/app/global-error.tsx`**

This file **must** render its own `<html>`/`<body>` — it replaces the root layout entirely, so it cannot use the fonts/providers `layout.tsx` normally supplies. Keep it deliberately minimal and dependency-free (no `AppLogo`/`Button` import, since those may depend on providers that no longer exist if the crash originated in the root layout itself):

```tsx
"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1.5rem",
          background: "#0a0a0a",
          color: "#f5f5f7",
          fontFamily: "system-ui, -apple-system, sans-serif",
          textAlign: "center",
          padding: "0 1.5rem",
        }}
      >
        <div>
          <p style={{ fontFamily: "monospace", fontSize: "0.875rem", color: "#98989f" }}>500</p>
          <h1 style={{ marginTop: "0.5rem", fontSize: "1.5rem", fontWeight: 600 }}>Something went wrong</h1>
          <p style={{ marginTop: "0.5rem", fontSize: "0.875rem", color: "#98989f" }}>
            The page failed to load. Try again, or come back later.
          </p>
        </div>
        <button
          onClick={() => reset()}
          style={{
            borderRadius: "9999px",
            background: "#f5a623",
            color: "#0a0a0a",
            fontWeight: 600,
            padding: "0.625rem 1.25rem",
            border: "none",
            cursor: "pointer",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
```

Inline styles are intentional here (not Tailwind classes) — this file is the one place in the app that must survive even if the entire CSS/token pipeline itself is the thing that broke.

- [ ] **Step 3: Verify**

Run: `npm run dev`, navigate to a nonexistent route (e.g. `/this-does-not-exist`) and confirm the new `not-found.tsx` renders. Triggering `global-error.tsx` deliberately is harder (it only fires on a root-layout-level crash) — a lighter check is acceptable: confirm `npm run build` compiles this file without type errors, and visually review the inline styles for correctness rather than force-triggering a root crash.

Run: `npx tsc --noEmit && npm run build`

- [ ] **Step 4: Commit**

```bash
git add src/app/not-found.tsx src/app/global-error.tsx
git commit -m "feat: add Precision-styled root not-found and global-error pages"
```

---

## Milestone 8 — Final token cleanup, docs, verification

### Task 26: Retire `--color-outline` legacy tokens

**Files:**
- Modify: `src/app/globals.css` (remove `--color-outline`/`--color-outline-soft` from both `:root` and `html.light`, and from the `@theme` binding block)

**Interfaces:**
- Consumes: confirmation from Task 12/16/18/22/23's `grep` checks that zero consumers remain.

- [ ] **Step 1: Final confirmation sweep**

Run: `grep -rn "border-outline\|bg-outline\|ring-outline\|--color-outline" src/`
Expected: zero matches anywhere, including `globals.css` itself once Step 2 below is done. If anything remains, go migrate it (same pattern as Task 12) before proceeding — do not remove the token definition while a consumer still references it.

- [ ] **Step 2: Delete the token definitions**

Remove the `--color-outline`/`--color-outline-soft` lines and their `@theme` bindings from `globals.css`.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npm run build`
Expected: passes with zero unknown-Tailwind-utility warnings related to `border-outline`.

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css
git commit -m "chore(theme): retire legacy --color-outline token, fully migrated to border-border-*"
```

---

### Task 27: Rewrite `BRAND.md`

**Files:**
- Modify: `BRAND.md` (full rewrite)

- [ ] **Step 1: Rewrite the document**

Replace `BRAND.md` in full as the new design-system doc-of-record. Structure it to mirror the sections a future contributor will actually look for (matching the old doc's own section shape where reasonable, so nothing that used to be documented quietly disappears): product one-liner, brand personality/voice (carry forward the retained voice rules and blocklist verbatim from this plan's Global Constraints — these were independently re-affirmed, not just inherited), the Precision colour system (every token from Task 1, with the same disclosed-contrast-math rigor the old doc used — cite the actual `check-contrast.mjs` output), typography (Geist Sans/Mono, the preserved Source-Serif-4 reading-toggle exception), motion principles (the one easing curve, the named primitives: `CursorSpotlight`, command palette, the redesigned publish sequence, view-transitions where used), the logo mark (updated description: fold-shadow is now a plain black tint, not paper), and a short "History" note stating that this document supersedes both "Ink & Paper" (2026-07-28) and "The Reveal" (2026-07-28) as of 2026-08-01, with a one-line pointer to `docs/superpowers/specs/2026-08-01-precision-redesign-design.md` for the full rationale.

- [ ] **Step 2: Self-review**

Read the new `BRAND.md` back and confirm every hex/token value it states matches what's actually in `globals.css` after Task 1/26 — a design doc that drifts from the code the day it's written defeats its own purpose.

- [ ] **Step 3: Commit**

```bash
git add BRAND.md
git commit -m "docs: rewrite BRAND.md for the Precision identity"
```

---

### Task 28: `docs/BOOKLET_TEXTBOOK.md` addendum

**Files:**
- Modify: `docs/BOOKLET_TEXTBOOK.md` §2 ("The brand: Ink & Paper")

- [ ] **Step 1: Add a short dated addendum, do not rewrite the section**

Immediately after the §2 heading, insert a callout (matching whatever admonition/blockquote convention the rest of the document already uses for similar notes — check how the document's own `>` blockquotes are formatted elsewhere before matching the style):

> **2026-08-01 update:** This section describes "Ink & Paper" and its "The Reveal" follow-on, both since superseded by the "Precision" identity (monochrome, single amber accent, Geist Sans/Mono, motion-led differentiation). See `BRAND.md` for the current system and `docs/superpowers/specs/2026-08-01-precision-redesign-design.md` for the full rationale. The history below is preserved as-written since it's an accurate record of what happened at the time, not a stale claim about the present.

This deliberately does not rewrite the 1700-line document's historical narrative — that's out of proportion to what's needed, and the document's own stated purpose is historical/technical narrative, not a live style guide (that's `BRAND.md`'s job).

- [ ] **Step 2: Commit**

```bash
git add docs/BOOKLET_TEXTBOOK.md
git commit -m "docs: flag BOOKLET_TEXTBOOK.md's brand section as superseded by Precision"
```

---

### Task 29: Extend `scripts/visual-qa.mjs` route coverage

**Files:**
- Modify: `scripts/visual-qa.mjs:18-28` (`ROUTES` array)

- [ ] **Step 1: Add the previously-uncovered unauthenticated routes**

Add to the `ROUTES` array: `/admin` (will 404/redirect without admin access in most environments — acceptable, still confirms the route doesn't crash), `/explore`, `/tags`, `/forgot-password`, `/reset-password` (will show its "missing token" state with no `?token=` param — acceptable), `/privacy`, `/terms`, `/mcp`, `/mcp-setup`, `/cli-auth` if not already present (cross-check against the existing list first — some of these may already be there).

- [ ] **Step 2: Note authenticated/parameterized routes as a follow-up, not silently skipped**

`/t/[slug]`, `/t/[slug]/admin`, `/t/join`, `/c/[id]`, `/u/[id]` each require a real team/collection/user to exist — add a comment in the script noting these are intentionally not covered by the automated sweep (same reasoning the script already uses for why `/my-pages` needs its own special-cased authenticated block rather than living in the plain `ROUTES` array) rather than silently having no record of the gap.

- [ ] **Step 3: Run it**

Run: `node scripts/visual-qa.mjs`
Expected: screenshots generated for every route in the updated list, across both `dark`/`light` themes and both viewports, with no crashes. Spot-check a handful of the generated screenshots for the new palette (no lingering paper-cream, no Fraunces).

- [ ] **Step 4: Commit**

```bash
git add scripts/visual-qa.mjs
git commit -m "test: extend visual-qa sweep to previously-uncovered routes"
```

---

### Task 30: Final full-suite verification

**Files:** none (verification only)

- [ ] **Step 1: Full grep sweep for any surviving old-brand artifact**

Run:
```bash
grep -rln "color-paper\|font-fraunces\|Fraunces\|shadow-glow\|shadow-soft\|accent-warm\|bg-paper\|text-paper" src/ BRAND.md 2>/dev/null
```
Expected: zero matches (the `Source_Serif_4`/`font-reading` references are intentionally preserved and won't match these specific strings).

- [ ] **Step 2: Type check, lint, build, test**

Run: `npx tsc --noEmit`
Run: `npm run lint` (or the project's actual lint script name — check `package.json`'s `scripts` block)
Run: `npm run build`
Run: `npm test` (or the project's actual test script name)
Expected: all pass with zero new failures relative to the pre-redesign baseline.

- [ ] **Step 3: Contrast re-verification**

Run: `node scripts/check-contrast.mjs`
Expected: all pairs pass.

- [ ] **Step 4: `prefers-reduced-motion` manual audit**

With OS-level "reduce motion" enabled, manually visit `/` (hero spotlight + Precision Reveal should both render statically, no scroll-driven animation, no cursor tracking), `/app` (command palette should still open/close but without any entrance animation beyond what `cmdk`'s own reduced-motion handling provides — verify it doesn't hard-fail), and trigger a publish (the `PublishReveal` flash should still appear per the global `@media (prefers-reduced-motion: reduce)` rule in `globals.css` collapsing its transition durations to `0.01ms`).

- [ ] **Step 5: Report final status**

Summarize: which of the full grep/build/test/contrast/motion checks passed, and any residual known gaps (e.g., if `/admin` couldn't be manually verified due to lack of local admin access — note it explicitly rather than silently claiming full coverage).
