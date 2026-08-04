# Editor Screen Revamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Elevate Booklet's `/app` editor screen to world-class within its existing textarea+overlay engine and locked "Precision" design system — a real command palette, a slash-insert menu for the callout/toggle/columns/table block types, typewriter scrolling + optional paragraph dimming in Focus Mode, and fixes for duplicated drafts-UI logic, phantom keyboard shortcuts, and dead PrimeReact wiring.

**Architecture:** No new editing engine — the existing `<textarea>` + `SyntaxOverlay` stays. New interaction surfaces (slash menu, expanded command palette) are additive layers reusing the caret-coordinate positioning already built for wikilink autocomplete. Duplicated drafts-list logic (`DraftsDialog.tsx` and `TopBar.tsx`'s `DrawerDraftsView`) is consolidated into one hook + one presentational row component, consumed by both existing entry points. All new block-insert content (slash menu items, command palette's Insert group) is driven by one shared data module so there is exactly one definition of "what Markdown does `/callout` insert," not two.

**Tech Stack:** Next.js 16 (App Router) / React 19 / TypeScript strict / Tailwind CSS v4 / `cmdk` / `framer-motion` / `@playwright/test` (both e2e and "unit" — this repo has no Jest/Vitest, see `playwright.unit.config.ts`).

## Global Constraints

- No changes to `/p/[id]` (the published reading page) or its rendering pipeline.
- No new design tokens in `src/app/globals.css`'s `@theme` block — colors, radii, font families are fixed. New CSS is limited to composing existing tokens (e.g. a new `@keyframes` using `--duration-normal` and the Precision easing curve).
- No CodeMirror/editor-engine rewrite — the `<textarea>` + `SyntaxOverlay` combination is the permanent base for this project.
- No change to documented product behavior: character limits (`STORAGE.maxInputChars` = 200,000), publish mechanics, draft storage model (`localStorage`, never transmitted pre-publish), rate limits.
- `⌘B` stays bound to "New draft" (real, documented behavior per `PRODUCT.md`) — never rebind it.
- Every new animation reuses `EASE_PRECISION` (`src/lib/motion.ts`) / `--ease-spring` and the existing duration tokens (`DURATION` in `src/lib/motion.ts`; `--duration-fast/normal/slow/deliberate` in `globals.css`). No new easing curves.
- `prefers-reduced-motion` must be respected by every new animated behavior (typewriter scrolling, slash menu, palette), consistent with how `usePrefersReducedMotion()` / `prefersReducedMotion()` are already used project-wide.
- Callout kinds are exactly `CALLOUT_KINDS = ["note", "tip", "warning", "important", "caution"]` (`src/lib/blocks.ts`) — not "info/warning/success/danger." Matching icons `callout-note` / `callout-tip` / `callout-warning` / `callout-important` / `callout-caution` already exist in `src/components/ui/Icon.tsx`.
- Toggle block syntax: `:::toggle Summary text\n<body>\n:::`. Columns block syntax: `:::columns\n<col 1>\n---\n<col 2>\n:::` (2–4 columns, split on top-level `---`). Both parsed by `src/lib/parse.ts`'s directive-container handling — do not touch the parser, only the editor-side insertion snippets.
- Design spec: `docs/superpowers/specs/2026-08-04-editor-revamp-design.md` — read it if anything below is ambiguous; it is the source of truth for scope and non-goals.

---

## Task 1: New icons for table/toggle/columns/divider

**Files:**
- Modify: `src/components/ui/Icon.tsx`

**Interfaces:**
- Produces: four new `IconName` union members — `"table"`, `"toggle"`, `"columns"`, `"divider"` — each with a `PATHS` entry, consumed by Task 4 (`insertItems.ts`) and Task 5 (`SlashMenu.tsx`).

- [ ] **Step 1: Add the four new icon names to the `IconName` union**

In `src/components/ui/Icon.tsx`, extend the union (currently ending `| "callout-caution";` at line 50):

```typescript
export type IconName =
  | "plus"
  | "minus"
  // ... existing entries unchanged ...
  | "callout-note"
  | "callout-tip"
  | "callout-warning"
  | "callout-important"
  | "callout-caution"
  | "table"
  | "toggle"
  | "columns"
  | "divider";
```

- [ ] **Step 2: Add the four new `PATHS` entries**

Immediately after the `"callout-caution"` entry in the `PATHS` map (line 99):

```typescript
  "callout-caution":   ["M5 1h6l4 4v6l-4 4H5l-4-4V5l4-4z", "M8 5v4", "M8 11h.01"],
  table:    ["M1.5 2.5h13v11h-13z", "M1.5 6.5h13M6.5 2.5v11"],
  toggle:   ["M3 3h10v10H3z", "M6.5 6l3 2-3 2"],
  columns:  ["M2 3h5v10H2z", "M9 3h5v10H9z"],
  divider:  "M2 8h12",
```

- [ ] **Step 3: Verify the icon set renders**

Run: `npm run test` (this project's `tsc --noEmit` script) — must pass with no new type errors, confirming the union/PATHS map stay in sync (a missing `PATHS` entry for a union member is a compile error since `PATHS: Record<IconName, ...>` requires every member).

Expected: PASS, no output.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/Icon.tsx
git commit -m "feat(icons): add table/toggle/columns/divider icons for the editor insert menu"
```

---

## Task 2: Fix phantom keyboard shortcuts in `ShortcutsModal`

**Files:**
- Modify: `src/components/app/PasteInput.tsx:127-156` (the `SHORTCUT_GROUPS` array)

**Interfaces:**
- No exported interface changes — this is a data-only correction.

- [ ] **Step 1: Remove the unbound Bold/Italic/Inline-code entries and correct the "Formatting" group**

`⌘B`/`⌘I`/`⌘\`` were never wired to any keydown handler (only the toolbar buttons apply bold/italic/inline-code) — `⌘B` is real, documented, global behavior for "New draft" (`PRODUCT.md`'s shortcut table; `AppClient.tsx:766-770`). The modal's copy currently claims the opposite. Replace `SHORTCUT_GROUPS`:

```typescript
const SHORTCUT_GROUPS = [
  {
    group: "Editor",
    shortcuts: [
      { keys: ["⌘", "J"], label: "Focus editor" },
      { keys: ["⌘", "K"], label: "Command palette" },
      { keys: ["⌘", "F"], label: "Find & replace" },
      { keys: ["⌘", "↵"], label: "Publish" },
      { keys: ["⌘", "B"], label: "New draft" },
      { keys: ["⌘", "D"], label: "Open drafts" },
      { keys: ["⌘", "."], label: "Toggle focus mode" },
      { keys: ["Tab"], label: "Indent (2 spaces)" },
      { keys: ["⇧", "Tab"], label: "Unindent" },
    ],
  },
  {
    group: "Insert",
    shortcuts: [
      { keys: ["/"], label: "Insert menu (at line start)" },
      { keys: ["[", "["], label: "Link to another draft" },
    ],
  },
  {
    group: "Toolbar",
    shortcuts: [
      { keys: ["H1", "H2", "H3"], label: "Heading buttons" },
      { keys: [">"], label: "Blockquote button" },
      { keys: ["-"], label: "Bullet list" },
      { keys: ["1."], label: "Ordered list" },
    ],
  },
];
```

(The "Insert" group's `/` and `[[` rows describe features landed in Tasks 5 and existing wikilink autocomplete respectively — this step lands the copy now since it's a pure data correction; the underlying `/` behavior arrives in Task 5. Since a stale forward-reference here is momentary within this same plan's execution and never shipped alone, this is acceptable — if executing tasks out of order, land Task 5 first or hold this row.)

- [ ] **Step 2: Verify no other reference to the removed copy exists**

Run: `grep -rn "Bold (wrap in\|Italic (wrap in" src/components/app/PasteInput.tsx`

Expected: matches only the toolbar's own `title` attributes (`"Bold (wrap in **)"` etc. in the `TOOLBAR` array, line 463-464) — those are correct (they describe the toolbar button itself, not a keyboard shortcut) and must NOT be removed.

- [ ] **Step 3: Commit**

```bash
git add src/components/app/PasteInput.tsx
git commit -m "fix(editor): correct ShortcutsModal to stop advertising unbound Bold/Italic/code shortcuts"
```

---

## Task 3: Remove unused PrimeReact wiring

**Files:**
- Delete: `src/app/app/primereact.css`
- Delete: `src/components/ui/PrimeStyles.tsx`
- Delete: `public/primereact-themes/dark/theme.css`
- Delete: `public/primereact-themes/light/theme.css`
- Modify: `src/app/app/layout.tsx`
- Modify: `package.json`

**Interfaces:** None — pure deletion, verified by zero remaining references.

- [ ] **Step 1: Confirm zero runtime usage before deleting anything**

Run: `grep -rl "from \"primereact\|from 'primereact" src --include="*.tsx" --include="*.ts"`

Expected: no output (empty). This matches the audit finding — if this now returns matches, STOP and re-scope this task instead of deleting.

- [ ] **Step 2: Read `src/app/app/layout.tsx` and remove the PrimeReact wiring**

Remove the `primereact.css` import and the `<PrimeStyles />` render. The file currently imports `./primereact.css` and renders `<PrimeStyles />` alongside `{children}` (per the audit — read the file first to get exact current line numbers before editing, since line numbers may have shifted). After the edit, the layout should render only `{children}` (plus whatever non-PrimeReact wrapping already exists there, e.g. any session/theme providers already present — do not remove those).

- [ ] **Step 3: Delete the four PrimeReact-only files**

```bash
git rm src/app/app/primereact.css
git rm src/components/ui/PrimeStyles.tsx
git rm public/primereact-themes/dark/theme.css
git rm public/primereact-themes/light/theme.css
rmdir public/primereact-themes/dark public/primereact-themes/light public/primereact-themes 2>/dev/null || true
```

- [ ] **Step 4: Remove `primereact` and `primeicons` from `package.json`**

They appear only in the root `package.json` (verified via `grep -rn "primereact\|primeicons" package.json packages/*/package.json mcp-server/package.json` returning matches only in the root file). Remove both lines from `dependencies`.

- [ ] **Step 5: Reinstall and verify the build**

```bash
npm install
npm run test
```

Expected: `npm install` completes cleanly (lockfile updates to drop the two packages); `npm run test` (`tsc --noEmit`) passes with no errors referencing the deleted files.

- [ ] **Step 6: Start the dev server and confirm `/app` still renders correctly**

Run: `npm run dev` (background), then load `/app` in a browser (or via Playwright) and confirm the page renders with no console errors about missing stylesheets or `PrimeStyles`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore(editor): remove unused PrimeReact wiring — zero components import it"
```

---

## Task 4: Shared insert-items data module

**Files:**
- Create: `src/lib/editor/insertItems.ts`
- Test: `tests/unit/insert-items.spec.ts`

**Interfaces:**
- Consumes: `IconName` (`@/components/ui/Icon`), `CALLOUT_KINDS`/`CalloutKind` (`@/lib/blocks`).
- Produces: `InsertSnippet` type (`{ text: string; selectFrom?: number; selectTo?: number }`), `InsertItem` type (`{ id: string; label: string; keywords: string[]; icon: IconName; textGlyph?: string; snippet: InsertSnippet }`), `INSERT_ITEMS: InsertItem[]`, `filterInsertItems(query: string): InsertItem[]`, `TABLE_SNIPPET_TEXT: string`. Consumed by Task 5 (`SlashMenu.tsx`) and Task 8 (`CommandPalette.tsx`'s Insert group).

- [ ] **Step 1: Write the failing test**

Create `tests/unit/insert-items.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";
import { INSERT_ITEMS, filterInsertItems } from "@/lib/editor/insertItems";
import { CALLOUT_KINDS } from "@/lib/blocks";

test.describe("insert items", () => {
  test("includes one item per callout kind, each producing a > [!kind] snippet", () => {
    for (const kind of CALLOUT_KINDS) {
      const item = INSERT_ITEMS.find((i) => i.id === `callout-${kind}`);
      expect(item).toBeDefined();
      expect(item!.snippet.text).toBe(`> [!${kind}]\n> `);
    }
  });

  test("toggle snippet is a valid :::toggle directive with the Summary placeholder selected", () => {
    const item = INSERT_ITEMS.find((i) => i.id === "toggle");
    expect(item).toBeDefined();
    expect(item!.snippet.text).toBe(":::toggle Summary\n\n:::\n");
    const { text, selectFrom, selectTo } = item!.snippet;
    expect(text.slice(selectFrom, selectTo)).toBe("Summary");
  });

  test("columns snippet places the cursor inside the first column body", () => {
    const item = INSERT_ITEMS.find((i) => i.id === "columns");
    expect(item).toBeDefined();
    expect(item!.snippet.text).toBe(":::columns\n\n---\n\n:::\n");
    expect(item!.snippet.selectFrom).toBe(item!.snippet.selectTo);
    expect(item!.snippet.text.slice(0, item!.snippet.selectFrom)).toBe(":::columns\n");
  });

  test("table snippet selects the 'Column 1' placeholder, matching the toolbar's insertTable behavior", () => {
    const item = INSERT_ITEMS.find((i) => i.id === "table");
    expect(item).toBeDefined();
    const { text, selectFrom, selectTo } = item!.snippet;
    expect(text.slice(selectFrom, selectTo)).toBe("Column 1");
  });

  test("filterInsertItems with an empty query returns every item", () => {
    expect(filterInsertItems("")).toHaveLength(INSERT_ITEMS.length);
  });

  test("filterInsertItems matches by label", () => {
    const results = filterInsertItems("head");
    expect(results.map((i) => i.id)).toEqual(expect.arrayContaining(["h1", "h2", "h3"]));
  });

  test("filterInsertItems matches by keyword even when the label doesn't contain the query", () => {
    const results = filterInsertItems("checkbox");
    expect(results.map((i) => i.id)).toContain("task");
  });

  test("filterInsertItems is case-insensitive", () => {
    expect(filterInsertItems("CALLOUT").length).toBeGreaterThan(0);
  });

  test("every item id is unique", () => {
    const ids = INSERT_ITEMS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx playwright test --config=playwright.unit.config.ts insert-items`

Expected: FAIL — `Cannot find module '@/lib/editor/insertItems'`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/editor/insertItems.ts`:

```typescript
import type { IconName } from "@/components/ui/Icon";
import { CALLOUT_KINDS, type CalloutKind } from "@/lib/blocks";

/**
 * A literal Markdown snippet to insert at the cursor, plus where to leave
 * the selection afterward — e.g. the table snippet selects its "Column 1"
 * placeholder so typing immediately replaces it, mirroring
 * PasteInput.tsx's existing `insertTable()` behavior. Both `selectFrom` and
 * `selectTo` default to `text.length` (cursor placed at the end, nothing
 * selected) when omitted.
 */
export type InsertSnippet = {
  text: string;
  selectFrom?: number;
  selectTo?: number;
};

/**
 * One entry in the "/" slash menu and the command palette's Insert group —
 * a single shared definition so both surfaces always agree on what
 * inserting "Callout: Warning" actually produces.
 */
export type InsertItem = {
  id: string;
  label: string;
  keywords: string[];
  icon: IconName;
  /** Short text glyph (e.g. "H1") shown instead of `icon`, matching
   * FormatToolbar's existing H1/H2/H3 text-label style. */
  textGlyph?: string;
  snippet: InsertSnippet;
};

const CALLOUT_LABELS: Record<CalloutKind, string> = {
  note: "Callout: Note",
  tip: "Callout: Tip",
  warning: "Callout: Warning",
  important: "Callout: Important",
  caution: "Callout: Caution",
};

function calloutSnippet(kind: CalloutKind): InsertSnippet {
  const text = `> [!${kind}]\n> `;
  return { text, selectFrom: text.length };
}

export const TABLE_SNIPPET_TEXT =
  "| Column 1 | Column 2 | Column 3 |\n" +
  "| --- | --- | --- |\n" +
  "| Cell | Cell | Cell |\n" +
  "| Cell | Cell | Cell |";

export const INSERT_ITEMS: InsertItem[] = [
  { id: "h1", label: "Heading 1", keywords: ["heading", "h1", "title"], icon: "markdown", textGlyph: "H1", snippet: { text: "# " } },
  { id: "h2", label: "Heading 2", keywords: ["heading", "h2"], icon: "markdown", textGlyph: "H2", snippet: { text: "## " } },
  { id: "h3", label: "Heading 3", keywords: ["heading", "h3"], icon: "markdown", textGlyph: "H3", snippet: { text: "### " } },
  { id: "bullet", label: "Bullet list", keywords: ["list", "ul", "unordered"], icon: "list", snippet: { text: "- " } },
  { id: "ordered", label: "Ordered list", keywords: ["list", "ol", "numbered"], icon: "list-ordered", snippet: { text: "1. " } },
  { id: "task", label: "Task list", keywords: ["todo", "checkbox", "task"], icon: "check", snippet: { text: "- [ ] " } },
  { id: "quote", label: "Quote", keywords: ["blockquote", "quote"], icon: "quote", snippet: { text: "> " } },
  ...CALLOUT_KINDS.map((kind): InsertItem => ({
    id: `callout-${kind}`,
    label: CALLOUT_LABELS[kind],
    keywords: ["callout", "alert", kind],
    icon: `callout-${kind}` as IconName,
    snippet: calloutSnippet(kind),
  })),
  {
    id: "toggle",
    label: "Toggle",
    keywords: ["toggle", "collapse", "details", "disclosure"],
    icon: "toggle",
    snippet: {
      text: ":::toggle Summary\n\n:::\n",
      selectFrom: ":::toggle ".length,
      selectTo: ":::toggle Summary".length,
    },
  },
  {
    id: "columns",
    label: "Columns",
    keywords: ["columns", "layout", "side by side"],
    icon: "columns",
    snippet: {
      text: ":::columns\n\n---\n\n:::\n",
      selectFrom: ":::columns\n".length,
      selectTo: ":::columns\n".length,
    },
  },
  {
    id: "table",
    label: "Table",
    keywords: ["table", "grid"],
    icon: "table",
    snippet: {
      text: TABLE_SNIPPET_TEXT,
      selectFrom: "| ".length,
      selectTo: "| ".length + "Column 1".length,
    },
  },
  {
    id: "codeblock",
    label: "Code block",
    keywords: ["code", "snippet", "fence"],
    icon: "code-block",
    snippet: { text: "```\n\n```", selectFrom: "```\n".length, selectTo: "```\n".length },
  },
  {
    id: "divider",
    label: "Divider",
    keywords: ["divider", "hr", "rule", "separator"],
    icon: "divider",
    snippet: { text: "---\n" },
  },
];

export function filterInsertItems(query: string): InsertItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return INSERT_ITEMS;
  return INSERT_ITEMS.filter(
    (item) =>
      item.label.toLowerCase().includes(q) ||
      item.keywords.some((k) => k.toLowerCase().includes(q)),
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx playwright test --config=playwright.unit.config.ts insert-items`

Expected: PASS, all 9 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/editor/insertItems.ts tests/unit/insert-items.spec.ts
git commit -m "feat(editor): add shared insert-items data module for the slash menu and command palette"
```

---

## Task 5: Shared caret-popup positioning helper (DRY refactor)

**Files:**
- Modify: `src/lib/ui/caret.ts`
- Modify: `src/components/app/PasteInput.tsx` (the `updateWikilinkTrigger` function, lines 732-772)

**Interfaces:**
- Produces: `positionPopupNearCaret(ta: HTMLTextAreaElement, caretIndex: number, width: number, height: number, margin: number): { top: number; left: number }`, exported from `src/lib/ui/caret.ts`. Consumed by `updateWikilinkTrigger` (this task) and Task 6's slash-trigger positioning.

This is a pure refactor — it must not change wikilink popup behavior. `tests/e2e/wikilink-autocomplete.spec.ts` already covers this exact positioning math and is the regression guard.

- [ ] **Step 1: Run the existing wikilink positioning e2e tests to confirm current baseline**

Run: `npm run dev` (background, port 3100 per `playwright.config.ts`'s `TEST_BASE_URL` default), then `npx playwright test wikilink-autocomplete`

Expected: PASS (3 tests), confirming the baseline before refactoring.

- [ ] **Step 2: Add `positionPopupNearCaret` to `src/lib/ui/caret.ts`**

Append to the end of `src/lib/ui/caret.ts`:

```typescript
export type PopupPosition = { top: number; left: number };

/**
 * Computes a `position: fixed` popup's {top, left}, anchored just below the
 * caret at `caretIndex` and clamped so a popup of `width`x`height` (its
 * fixed CSS size) never renders outside the viewport regardless of scroll
 * position or how close the caret is to an edge. Shared by every editor
 * popup anchored at the caret (wikilink autocomplete, the "/" insert menu)
 * so they stay pixel-identical in behavior instead of drifting apart.
 */
export function positionPopupNearCaret(
  ta: HTMLTextAreaElement,
  caretIndex: number,
  width: number,
  height: number,
  margin: number,
): PopupPosition {
  const { top, left, height: lineHeight } = getCaretCoordinates(ta, caretIndex);
  const rect = ta.getBoundingClientRect();
  const rawTop = rect.top - ta.scrollTop + top + lineHeight + 4;
  const rawLeft = rect.left - ta.scrollLeft + left;

  return {
    top: Math.min(
      Math.max(rawTop, margin),
      Math.max(margin, window.innerHeight - height - margin),
    ),
    left: Math.min(
      Math.max(rawLeft, margin),
      Math.max(margin, window.innerWidth - width - margin),
    ),
  };
}
```

- [ ] **Step 3: Switch `updateWikilinkTrigger` to use the shared helper**

In `src/components/app/PasteInput.tsx`, replace the inline position computation inside `updateWikilinkTrigger` (the block computing `rawTop`/`rawLeft` and the `setWikilinkPos` clamp math, lines 744-769) with:

```typescript
      const pos = positionPopupNearCaret(
        ta,
        ta.selectionStart,
        WIKILINK_POPUP_WIDTH,
        WIKILINK_POPUP_MAX_HEIGHT,
        WIKILINK_POPUP_VIEWPORT_MARGIN,
      );
      setWikilinkPos(pos);
```

Add the import at the top of the file: `import { getCaretCoordinates, positionPopupNearCaret } from "@/lib/ui/caret";` (replacing the existing `getCaretCoordinates`-only import — check whether `getCaretCoordinates` is still used elsewhere in the file after this change; if not, drop it from the import).

- [ ] **Step 4: Re-run the wikilink e2e tests — must still pass unmodified**

Run: `npx playwright test wikilink-autocomplete`

Expected: PASS (3 tests), identical results to Step 1. If any fail, the refactor introduced a numeric drift — compare the extracted formula against the original line-by-line before proceeding.

- [ ] **Step 5: Commit**

```bash
git add src/lib/ui/caret.ts src/components/app/PasteInput.tsx
git commit -m "refactor(editor): extract shared caret-popup positioning helper from wikilink autocomplete"
```

---

## Task 6: Slash-insert menu ("/" at cursor)

**Files:**
- Create: `src/components/app/SlashMenu.tsx`
- Test: `tests/unit/slash-trigger.spec.ts`
- Modify: `src/components/app/PasteInput.tsx`

**Interfaces:**
- Consumes: `InsertItem`/`InsertSnippet`/`filterInsertItems` (Task 4), `positionPopupNearCaret` (Task 5).
- Produces: `detectSlashTrigger(value: string, caret: number): SlashTrigger | null` and `SlashMenu` component, both exported from `src/components/app/SlashMenu.tsx`. Consumed by this task's `PasteInput.tsx` wiring and by Task 9 (toolbar "Insert block" button reuses the same trigger-less open path).

- [ ] **Step 1: Write the failing test for `detectSlashTrigger`**

Create `tests/unit/slash-trigger.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";
import { detectSlashTrigger } from "@/components/app/SlashMenu";

test.describe("detectSlashTrigger", () => {
  test("triggers at the very start of the document", () => {
    expect(detectSlashTrigger("/", 1)).toEqual({ start: 0, query: "" });
  });

  test("triggers at the start of a new line", () => {
    const value = "first line\n/head";
    expect(detectSlashTrigger(value, value.length)).toEqual({ start: 11, query: "head" });
  });

  test("triggers after a space", () => {
    const value = "some text /tab";
    expect(detectSlashTrigger(value, value.length)).toEqual({ start: 10, query: "tab" });
  });

  test("does NOT trigger mid-word (e.g. a fraction like km/h)", () => {
    const value = "the speed is 60km/h";
    expect(detectSlashTrigger(value, value.length)).toBeNull();
  });

  test("does NOT trigger once a space follows the slash (abandoned)", () => {
    const value = "/foo bar";
    expect(detectSlashTrigger(value, value.length)).toBeNull();
  });

  test("does NOT trigger once a newline follows the slash", () => {
    const value = "/foo\nbar";
    expect(detectSlashTrigger(value, value.length)).toBeNull();
  });

  test("does NOT trigger with no slash typed at all", () => {
    expect(detectSlashTrigger("no slash here", 5)).toBeNull();
  });

  test("re-triggers on a second slash later in the same line, abandoning the first", () => {
    const value = "/one /two";
    expect(detectSlashTrigger(value, value.length)).toEqual({ start: 5, query: "two" });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx playwright test --config=playwright.unit.config.ts slash-trigger`

Expected: FAIL — `Cannot find module '@/components/app/SlashMenu'`.

- [ ] **Step 3: Create `src/components/app/SlashMenu.tsx`**

```tsx
"use client";

import { Icon } from "@/components/ui/Icon";
import type { InsertItem } from "@/lib/editor/insertItems";

export type SlashTrigger = { start: number; query: string };

/**
 * Detects "cursor is inside an open, unclosed '/query' at the start of a
 * line or after whitespace" — mirrors detectWikilinkTrigger's shape and
 * reasoning (PasteInput.tsx) but for the slash-insert menu. Only fires when
 * the "/" is the first character of a line or immediately preceded by a
 * space/tab, so a mid-word "/" (e.g. "60km/h") never opens the menu. A
 * space, newline, or a second "/" inside the run closes/abandons the
 * previous trigger, matching how "]"/newline closes the wikilink trigger.
 */
export function detectSlashTrigger(value: string, caret: number): SlashTrigger | null {
  const upToCaret = value.slice(0, caret);
  const lastSlash = upToCaret.lastIndexOf("/");
  if (lastSlash === -1) return null;

  const charBefore = lastSlash === 0 ? "\n" : upToCaret[lastSlash - 1];
  if (charBefore !== "\n" && charBefore !== " " && charBefore !== "\t") return null;

  const between = upToCaret.slice(lastSlash + 1);
  if (between.includes("\n") || between.includes(" ") || between.includes("/")) return null;

  return { start: lastSlash, query: between };
}

export const SLASH_POPUP_WIDTH = 240;
export const SLASH_POPUP_MAX_HEIGHT = 288;
export const SLASH_POPUP_VIEWPORT_MARGIN = 8;

export function SlashMenu({
  items,
  top,
  left,
  selectedIndex,
  onSelect,
}: {
  items: InsertItem[];
  top: number;
  left: number;
  selectedIndex: number;
  onSelect: (item: InsertItem) => void;
}) {
  if (items.length === 0) return null;

  return (
    <div
      className="fixed z-50 w-60 max-h-72 overflow-y-auto rounded-lg border border-border-subtle bg-bg-elevated py-1 shadow-xl animate-dropdown-in"
      style={{ top, left }}
    >
      {items.map((item, i) => (
        <button
          key={item.id}
          type="button"
          // Selecting must not steal focus from the textarea mid-edit —
          // same reasoning as WikilinkAutocomplete's onMouseDown pattern.
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(item);
          }}
          className={[
            "flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-xs",
            i === selectedIndex
              ? "bg-accent/15 text-text-primary"
              : "text-text-secondary hover:bg-fill-2",
          ].join(" ")}
        >
          <span className="flex h-4 w-4 shrink-0 items-center justify-center text-text-muted">
            {item.textGlyph ? (
              <span className="font-mono text-2xs font-semibold">{item.textGlyph}</span>
            ) : (
              <Icon name={item.icon} size={13} />
            )}
          </span>
          <span className="truncate">{item.label}</span>
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run the unit test to verify it passes**

Run: `npx playwright test --config=playwright.unit.config.ts slash-trigger`

Expected: PASS, all 8 tests green.

- [ ] **Step 5: Wire the slash trigger into `PasteInput.tsx`**

Add state and handlers to the `PasteInput` component, following the exact pattern already used for `wikilinkTrigger`/`wikilinkPos`/`wikilinkSelectedIndex`:

```typescript
import { detectSlashTrigger, SlashMenu, SLASH_POPUP_WIDTH, SLASH_POPUP_MAX_HEIGHT, SLASH_POPUP_VIEWPORT_MARGIN, type SlashTrigger } from "@/components/app/SlashMenu";
import { filterInsertItems, type InsertSnippet } from "@/lib/editor/insertItems";
```

Inside `PasteInput`, alongside the existing wikilink state:

```typescript
  const [slashTrigger, setSlashTrigger] = useState<SlashTrigger | null>(null);
  const [slashPos, setSlashPos] = useState({ top: 0, left: 0 });
  const [slashSelectedIndex, setSlashSelectedIndex] = useState(0);

  const slashItems = useMemo(
    () => (slashTrigger ? filterInsertItems(slashTrigger.query) : []),
    [slashTrigger],
  );

  const updateSlashTrigger = useCallback((ta: HTMLTextAreaElement, nextValue: string) => {
    if (ta.selectionStart !== ta.selectionEnd) {
      setSlashTrigger(null);
      return;
    }
    const trigger = detectSlashTrigger(nextValue, ta.selectionStart);
    setSlashTrigger(trigger);
    setSlashSelectedIndex(0);
    if (!trigger) return;
    setSlashPos(
      positionPopupNearCaret(ta, ta.selectionStart, SLASH_POPUP_WIDTH, SLASH_POPUP_MAX_HEIGHT, SLASH_POPUP_VIEWPORT_MARGIN),
    );
  }, []);

  const insertSnippet = useCallback(
    (snippet: InsertSnippet, range?: { start: number; end: number }) => {
      const ta = ref.current;
      if (!ta) return;
      const start = range?.start ?? ta.selectionStart;
      const end = range?.end ?? ta.selectionEnd;
      const newValue = value.slice(0, start) + snippet.text + value.slice(end);
      const from = start + (snippet.selectFrom ?? snippet.text.length);
      const to = start + (snippet.selectTo ?? snippet.selectFrom ?? snippet.text.length);

      onChange(newValue);
      setSlashTrigger(null);
      requestAnimationFrame(() => {
        ta.focus();
        ta.setSelectionRange(from, to);
      });
    },
    [value, onChange],
  );

  const selectSlashItem = useCallback(
    (item: InsertItem) => {
      if (!slashTrigger) return;
      insertSnippet(item.snippet, { start: slashTrigger.start, end: slashTrigger.start + 1 + slashTrigger.query.length });
    },
    [slashTrigger, insertSnippet],
  );
```

(`import type { InsertItem } from "@/lib/editor/insertItems";` and `import { positionPopupNearCaret } from "@/lib/ui/caret";` alongside the existing caret import from Task 5.)

- [ ] **Step 6: Call `updateSlashTrigger` at the same call sites as `updateWikilinkTrigger`**

In the textarea's `onChange`, `onClick`, and `onKeyUp` handlers, add a call to `updateSlashTrigger(e.currentTarget, ...)` next to the existing `updateWikilinkTrigger(...)` call (both can run every time — they're mutually exclusive in practice since `[[` and `/` are different trigger characters, and only one popup renders because `slashTrigger`/`wikilinkTrigger` are independent state).

In `onKeyDown`, add slash-menu keyboard navigation as a second `if` block, structured exactly like the existing wikilink block (ArrowDown/ArrowUp/Enter-or-Tab/Escape), gated on `slashTrigger && slashItems.length > 0`, calling `setSlashSelectedIndex` / `selectSlashItem(slashItems[slashSelectedIndex])` / `setSlashTrigger(null)` respectively. Place it as an early check alongside (not replacing) the existing wikilink keydown block — both trigger states are mutually exclusive at runtime, so only one branch will ever actually fire.

Also add `onBlur={() => { setWikilinkTrigger(null); setSlashTrigger(null); }}` (merge into the existing `onBlur`).

- [ ] **Step 7: Render `SlashMenu` in the component's JSX**

Next to the existing `{wikilinkTrigger && <WikilinkAutocomplete .../>}` render:

```tsx
      {slashTrigger && (
        <SlashMenu
          items={slashItems}
          top={slashPos.top}
          left={slashPos.left}
          selectedIndex={slashSelectedIndex}
          onSelect={selectSlashItem}
        />
      )}
```

- [ ] **Step 8: Add `animate-dropdown-in` to `WikilinkAutocomplete` for visual consistency**

The wikilink popup currently has no entrance animation (`WikilinkAutocomplete`'s root `div`, `PasteInput.tsx:634-637`). Add `animate-dropdown-in` to its `className` so both caret-anchored popups now share the same entrance, matching `SlashMenu`.

- [ ] **Step 9: Manual browser verification**

Run: `npm run dev`, open `/app`, type `/` at the start of an empty line — the menu should appear anchored under the cursor. Type `call` — list narrows to the five callout items. Press Enter on "Callout: Warning" — `> [!warning]\n> ` should be inserted with the cursor right after `> `. Type `/` mid-sentence after a word with no space (e.g. `foo/bar`) — menu must NOT appear. Escape closes an open menu without inserting.

- [ ] **Step 10: Commit**

```bash
git add src/components/app/SlashMenu.tsx src/components/app/PasteInput.tsx tests/unit/slash-trigger.spec.ts
git commit -m "feat(editor): add slash-insert menu for headings, lists, callouts, toggle, columns, table, code, divider"
```

---

## Task 7: Toolbar "Insert block" button

**Files:**
- Modify: `src/components/app/PasteInput.tsx`

**Interfaces:**
- Consumes: `insertSnippet` (Task 6), `INSERT_ITEMS`/`filterInsertItems` (Task 4).

Rather than adding 5+ new icon buttons to `FormatToolbar` (contra `BRAND.md`'s "chrome recedes" rule), a single new button opens the same `SlashMenu`, anchored under the button instead of at the caret.

- [ ] **Step 1: Add insert-menu state to `PasteInput` for the button-triggered (non-caret) case**

```typescript
  const [toolbarSlashOpen, setToolbarSlashOpen] = useState(false);
  const [toolbarSlashPos, setToolbarSlashPos] = useState({ top: 0, left: 0 });
  const [toolbarSlashSelectedIndex, setToolbarSlashSelectedIndex] = useState(0);
  const insertBtnRef = useRef<HTMLButtonElement | null>(null);

  const openToolbarSlashMenu = useCallback(() => {
    const btn = insertBtnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    setToolbarSlashPos({ top: rect.bottom + 4, left: rect.left });
    setToolbarSlashSelectedIndex(0);
    setToolbarSlashOpen(true);
  }, []);

  const selectToolbarSlashItem = useCallback(
    (item: InsertItem) => {
      setToolbarSlashOpen(false);
      insertSnippet(item.snippet);
    },
    [insertSnippet],
  );
```

- [ ] **Step 2: Add the button to `FormatToolbar`**

`FormatToolbar` needs two new props: `onOpenInsertMenu: () => void` and `insertBtnRef: React.RefObject<HTMLButtonElement | null>`. Add a new button after the last separator, before the flex spacer (near the existing table action):

```tsx
      <button
        ref={insertBtnRef}
        type="button"
        title="Insert block (/)"
        onMouseDown={(e) => { e.preventDefault(); onOpenInsertMenu(); }}
        className="shrink-0 h-6 w-6 flex items-center justify-center rounded transition text-text-muted hover:text-text-primary hover:bg-fill-2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent-soft"
      >
        <Icon name="plus" size={12} />
      </button>
```

Update `FormatToolbar`'s call site in the main `PasteInput` JSX to pass `onOpenInsertMenu={openToolbarSlashMenu}` and `insertBtnRef={insertBtnRef}`.

- [ ] **Step 3: Render the button-triggered menu, and close it on outside click/Escape**

```tsx
      {toolbarSlashOpen && (
        <>
          <div className="fixed inset-0 z-40" onMouseDown={() => setToolbarSlashOpen(false)} />
          <SlashMenu
            items={filterInsertItems("")}
            top={toolbarSlashPos.top}
            left={toolbarSlashPos.left}
            selectedIndex={toolbarSlashSelectedIndex}
            onSelect={selectToolbarSlashItem}
          />
        </>
      )}
```

(The invisible full-screen backdrop `div` at `z-40`, below the menu's `z-50`, is the same outside-click-to-close pattern used by `ShortcutsModal`'s backdrop.)

- [ ] **Step 4: Manual browser verification**

Click the new "+" toolbar button — the full insert menu should appear anchored under the button (not at the caret). Click an item — it inserts at the current cursor position. Click outside the menu — it closes without inserting.

- [ ] **Step 5: Commit**

```bash
git add src/components/app/PasteInput.tsx
git commit -m "feat(editor): add toolbar Insert block button reusing the slash menu"
```

---

## Task 8: Shared drafts-list hook + row component

**Files:**
- Create: `src/components/app/useDraftListActions.ts`
- Create: `src/components/app/DraftRow.tsx`
- Modify: `src/components/app/DraftsDialog.tsx`

**Interfaces:**
- Consumes: `listDrafts`/`updateDraft`/`duplicateDraft`/`deleteDraft`/`DraftMeta`/`DRAFTS_STORAGE_KEYS` (`@/lib/drafts`).
- Produces: `useDraftListActions(...)` hook and `DraftRow` component, both consumed by this task (`DraftsDialog.tsx`) and Task 9 (`TopBar.tsx`'s `DrawerDraftsView`).

- [ ] **Step 1: Create `src/components/app/useDraftListActions.ts`**

This is a line-for-line extraction of the state machine already duplicated between `DraftsDialog.tsx` (lines 65-154) and `TopBar.tsx`'s `DrawerDraftsView` (lines 234-311) — same logic, generalized to not assume which UI is closing:

```typescript
"use client";

import { trackEvent } from "@/lib/analytics";
import { ANALYTICS_EVENTS, hashId } from "@/lib/analytics-events";
import {
  DRAFTS_STORAGE_KEYS,
  deleteDraft,
  duplicateDraft,
  listDrafts,
  updateDraft,
  type DraftMeta,
} from "@/lib/drafts";
import { useCallback, useEffect, useState } from "react";

export function isValidDraftTitle(title: string): boolean {
  return title.trim().length > 0;
}

/**
 * Drafts-list state machine (rename / duplicate / delete-with-confirmation)
 * shared by every surface that lists local drafts: the desktop `DraftsDialog`
 * (⌘D) and the mobile `MoreActionsDrawer`'s drafts view. Both previously
 * carried their own ~90-line copy of this exact logic — this hook is the
 * single source of truth; the two surfaces differ only in chrome (modal vs.
 * drawer), handled by their own JSX plus `DraftRow`'s `variant` prop.
 */
export function useDraftListActions({
  active,
  activeDraftId,
  onOpenDraft,
  onCreateDraft,
  onActiveDraftDeleted,
}: {
  /** Only refreshes/subscribes while true — e.g. a dialog that isn't visible
   * shouldn't listen for storage events. */
  active: boolean;
  activeDraftId: string | null;
  onOpenDraft: (id: string, origin?: "drafts_dialog") => void;
  onCreateDraft: (origin?: "drafts_dialog") => string;
  /** Called after a fallback switch/create, but only when the draft that was
   * deleted was the currently-open one — the caller uses this to close its
   * own dialog/drawer, mirroring the original inline onHide()/onClose()
   * calls this hook replaces. Not called when deleting a non-active draft. */
  onActiveDraftDeleted: () => void;
}) {
  const [drafts, setDrafts] = useState<DraftMeta[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const refresh = useCallback(() => setDrafts(listDrafts()), []);

  useEffect(() => {
    if (active) refresh();
  }, [active, refresh]);

  useEffect(() => {
    if (!active) return;
    const onStorage = (e: StorageEvent) => {
      if (e.key === DRAFTS_STORAGE_KEYS.db) refresh();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [active, refresh]);

  const cancelRename = useCallback(() => {
    setEditingId(null);
    setEditingTitle("");
  }, []);

  const beginRename = useCallback((draft: DraftMeta) => {
    setEditingId(draft.id);
    setEditingTitle(draft.title);
    setConfirmDeleteId(null);
  }, []);

  const commitRename = useCallback(() => {
    if (!editingId) return;
    const next = editingTitle.trim();
    if (!isValidDraftTitle(next)) return;
    updateDraft(editingId, { title: next });
    trackEvent(ANALYTICS_EVENTS.draft_renamed, { draft_hash: hashId(editingId) });
    cancelRename();
    refresh();
  }, [cancelRename, editingId, editingTitle, refresh]);

  const onOpen = useCallback(
    (id: string) => {
      const isActive = id === activeDraftId;
      trackEvent(ANALYTICS_EVENTS.draft_opened, { draft_hash: hashId(id), origin: "drafts_dialog", is_active: isActive });
      onOpenDraft(id, "drafts_dialog");
    },
    [activeDraftId, onOpenDraft],
  );

  const onDuplicate = useCallback((id: string) => {
    const copy = duplicateDraft(id);
    trackEvent(ANALYTICS_EVENTS.draft_duplicated, {
      draft_hash: hashId(id),
      new_draft_hash: copy ? hashId(copy.id) : "",
    });
    refresh();
  }, [refresh]);

  const onDelete = useCallback(
    (id: string) => {
      if (confirmDeleteId !== id) {
        setConfirmDeleteId(id);
        return;
      }

      const deletingActive = id === activeDraftId;
      deleteDraft(id);
      trackEvent(ANALYTICS_EVENTS.draft_deleted, { draft_hash: hashId(id), deleting_active: deletingActive });
      cancelRename();
      setConfirmDeleteId(null);

      const nextDrafts = listDrafts();
      setDrafts(nextDrafts);

      if (!deletingActive) return;

      const nextId = nextDrafts[0]?.id;
      if (nextId) {
        onOpenDraft(nextId, "drafts_dialog");
      } else {
        onCreateDraft("drafts_dialog");
      }
      onActiveDraftDeleted();
    },
    [activeDraftId, cancelRename, confirmDeleteId, onActiveDraftDeleted, onCreateDraft, onOpenDraft],
  );

  const cancelDelete = useCallback(() => setConfirmDeleteId(null), []);

  return {
    drafts,
    editingId,
    editingTitle,
    setEditingTitle,
    confirmDeleteId,
    refresh,
    beginRename,
    cancelRename,
    commitRename,
    onOpen,
    onDuplicate,
    onDelete,
    cancelDelete,
  };
}
```

- [ ] **Step 2: Create `src/components/app/DraftRow.tsx`**

Extracted from the near-identical JSX in both original components, parameterized by `variant` for the two visual differences (hover-reveal vs. always-visible action icons; `rounded-xl` vs. `rounded-lg`):

```tsx
"use client";

import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import type { DraftMeta } from "@/lib/drafts";
import { formatRelativeTimeFromIso, formatUpdatedAtLong } from "@/lib/ui/time";
import { isValidDraftTitle } from "./useDraftListActions";

function RowIconButton({
  label,
  onClick,
  children,
  danger,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <Button variant={danger ? "danger" : "ghost"} size="sm" iconOnly aria-label={label} title={label} onClick={onClick}>
      {children}
    </Button>
  );
}

export function DraftRow({
  draft,
  isActive,
  isEditing,
  editingTitle,
  onEditingTitleChange,
  isConfirmingDelete,
  variant,
  onOpen,
  onBeginRename,
  onCancelRename,
  onCommitRename,
  onDuplicate,
  onDelete,
  onCancelDeleteConfirm,
}: {
  draft: DraftMeta;
  isActive: boolean;
  isEditing: boolean;
  editingTitle: string;
  onEditingTitleChange: (v: string) => void;
  isConfirmingDelete: boolean;
  /** "dialog": rounded-xl card, actions hidden until row hover (desktop
   * pointer). "drawer": rounded-lg card, actions always visible (touch). */
  variant: "dialog" | "drawer";
  onOpen: () => void;
  onBeginRename: () => void;
  onCancelRename: () => void;
  onCommitRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  /** Dismisses the inline delete-confirmation bar without deleting —
   * distinct from `onDelete`, which the confirm bar's own "Delete" button
   * still calls (a second click there is what actually deletes, matching
   * the two-click confirm pattern the hook's `onDelete` implements). */
  onCancelDeleteConfirm: () => void;
}) {
  const updatedLong = formatUpdatedAtLong(draft.updatedAt);
  const updatedRel = formatRelativeTimeFromIso(draft.updatedAt);
  const updated = updatedRel && updatedRel !== updatedLong ? `${updatedRel} · ${updatedLong}` : updatedLong;
  const isDialog = variant === "dialog";

  return (
    <div
      className={[
        isDialog ? "group rounded-xl" : "rounded-lg",
        "border p-3 transition flex flex-col gap-2",
        isActive ? "border-accent-soft/40 bg-accent/5" : isDialog ? "border-border-default hover:border-border-default/80" : "border-border-subtle bg-bg-elevated",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {isEditing ? (
            <input
              value={editingTitle}
              onChange={(e) => onEditingTitleChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); onCommitRename(); }
                if (e.key === "Escape") { e.preventDefault(); onCancelRename(); }
              }}
              onBlur={onCommitRename}
              autoFocus
              className="w-full rounded-md border border-accent-soft bg-bg px-2 py-0.5 text-sm font-medium text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-soft"
              aria-label="Draft title"
            />
          ) : (
            <div className="truncate text-sm font-medium text-text-primary">
              {draft.title?.trim() ? draft.title : "Untitled"}
            </div>
          )}
          {updated ? <div className="mt-0.5 text-xs text-text-muted">{updated}</div> : null}
        </div>

        <div className={["flex shrink-0 items-center gap-0.5", isDialog ? "opacity-0 group-hover:opacity-100 transition" : ""].join(" ")}>
          <RowIconButton label={isEditing ? "Save rename" : "Open draft"} onClick={isEditing ? onCommitRename : onOpen}>
            <Icon name={isEditing ? "check" : "external"} size={13} />
          </RowIconButton>
          <RowIconButton label="Rename" onClick={isEditing ? onCancelRename : onBeginRename}>
            <Icon name="pencil" size={13} />
          </RowIconButton>
          <RowIconButton label="Duplicate" onClick={onDuplicate}>
            <Icon name="duplicate" size={13} />
          </RowIconButton>
          <RowIconButton label="Delete" danger onClick={onDelete}>
            <Icon name="trash" size={13} />
          </RowIconButton>
        </div>
      </div>

      {isEditing && !isValidDraftTitle(editingTitle) ? (
        <div className="text-xs text-red-400">A title is required.</div>
      ) : null}

      {isConfirmingDelete ? (
        <div className="flex items-center justify-between gap-2 rounded-lg border border-red-500/20 bg-red-500/8 px-3 py-2">
          <span className="text-xs text-red-400">Delete this draft? You can&apos;t undo this.</span>
          <div className="flex gap-1.5">
            <Button variant="secondary" size="sm" onClick={onCancelDeleteConfirm}>Cancel</Button>
            <Button variant="danger" size="sm" onClick={onDelete}>Delete</Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 3: Refactor `DraftsDialog.tsx` to use the hook and `DraftRow`**

Replace the entire body of `DraftsDialog` (currently ~250 lines of duplicated state/JSX) to consume the hook and map `drafts` to `DraftRow` with `variant="dialog"`:

```tsx
"use client";

import { trackEvent } from "@/lib/analytics";
import { ANALYTICS_EVENTS, hashId } from "@/lib/analytics-events";
import { useEffect, useRef } from "react";
import { Button } from "../ui/Button";
import { Icon } from "../ui/Icon";
import { DraftRow } from "./DraftRow";
import { useDraftListActions } from "./useDraftListActions";

export function DraftsDialog({
  visible,
  activeDraftId,
  onHide,
  onOpenDraft,
  onCreateDraft,
  onRequestImportMarkdown,
}: {
  visible: boolean;
  activeDraftId: string | null;
  onHide: () => void;
  onOpenDraft: (id: string, origin?: "drafts_dialog") => void;
  onCreateDraft: (origin?: "drafts_dialog") => string;
  onRequestImportMarkdown: () => void;
}) {
  const backdropRef = useRef<HTMLDivElement>(null);
  const actions = useDraftListActions({
    active: visible,
    activeDraftId,
    onOpenDraft,
    onCreateDraft,
    onActiveDraftDeleted: onHide,
  });

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onHide(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [visible, onHide]);

  if (!visible) return null;

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-40 flex items-center justify-center bg-bg/60 backdrop-blur-sm p-4"
      onMouseDown={(e) => { if (e.target === backdropRef.current) onHide(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="My drafts"
        className="relative w-full max-w-lg max-h-[80vh] flex flex-col rounded-card border border-border-default bg-bg-elevated shadow-glass animate-dialog-in"
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border-default/60 shrink-0">
          <span className="text-sm font-semibold">My drafts</span>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onRequestImportMarkdown}>
              <Icon name="download" size={12} />
              Import
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                const id = onCreateDraft("drafts_dialog");
                trackEvent(ANALYTICS_EVENTS.draft_created, { draft_hash: hashId(id), origin: "drafts_dialog" });
                onHide();
              }}
            >
              <Icon name="plus" size={12} />
              New draft
            </Button>
            <Button variant="ghost" size="sm" iconOnly onClick={onHide} aria-label="Close">
              <Icon name="close" size={14} />
            </Button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 px-3 py-3">
          {actions.drafts.length === 0 ? (
            <div className="rounded-xl border border-border-default/60 bg-bg-glass/40 p-5">
              <div className="text-sm font-semibold">No drafts yet.</div>
              <div className="mt-1.5 text-sm leading-relaxed text-text-secondary">
                Drafts autosave to your browser. Publishing creates a shareable link — your draft stays here, ready to edit.
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {actions.drafts.map((d) => (
                <DraftRow
                  key={d.id}
                  draft={d}
                  isActive={d.id === activeDraftId}
                  isEditing={actions.editingId === d.id}
                  editingTitle={actions.editingTitle}
                  onEditingTitleChange={actions.setEditingTitle}
                  isConfirmingDelete={actions.confirmDeleteId === d.id}
                  variant="dialog"
                  onOpen={() => { actions.onOpen(d.id); onHide(); }}
                  onBeginRename={() => actions.beginRename(d)}
                  onCancelRename={actions.cancelRename}
                  onCommitRename={actions.commitRename}
                  onDuplicate={() => actions.onDuplicate(d.id)}
                  onDelete={() => actions.onDelete(d.id)}
                  onCancelDeleteConfirm={actions.cancelDelete}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Type-check**

Run: `npm run test`

Expected: PASS. If `onCancelDeleteConfirm`/`cancelDelete` wiring from Step 2's note is incomplete, this surfaces as a type error now — fix it before proceeding.

- [ ] **Step 5: Manual browser verification**

Open `/app`, create 2+ drafts, press ⌘D — dialog opens. Rename a draft (Enter commits, Escape cancels), duplicate one, delete one (first click asks to confirm, second deletes) — all must behave exactly as before the refactor.

- [ ] **Step 6: Commit**

```bash
git add src/components/app/useDraftListActions.ts src/components/app/DraftRow.tsx src/components/app/DraftsDialog.tsx
git commit -m "refactor(editor): extract shared drafts-list hook and row component from DraftsDialog"
```

---

## Task 9: Reuse the shared hook in the mobile drawer

**Files:**
- Modify: `src/components/app/TopBar.tsx`

**Interfaces:**
- Consumes: `useDraftListActions`, `DraftRow` (Task 8).

- [ ] **Step 1: Replace `DrawerDraftsView`'s body with the shared hook + `DraftRow`**

`DrawerDraftsView` (`TopBar.tsx:219-441`) currently duplicates the same state machine `useDraftListActions` now owns. Replace its internals:

```tsx
function DrawerDraftsView({
  activeDraftId,
  onBack,
  onClose,
  onCreateDraft,
  onOpenDraft,
  onRequestImportMarkdown,
}: {
  activeDraftId: string | null;
  onBack: () => void;
  onClose: () => void;
  onCreateDraft: (origin?: "drafts_dialog") => string;
  onOpenDraft: (id: string, origin?: "drafts_dialog") => void;
  onRequestImportMarkdown: () => void;
}) {
  const actions = useDraftListActions({
    active: true,
    activeDraftId,
    onOpenDraft,
    onCreateDraft,
    onActiveDraftDeleted: onClose,
  });

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <DrawerBackButton onBack={onBack} />
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={onRequestImportMarkdown}>
            <Icon name="download" size={12} />
            Import
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              const id = onCreateDraft("drafts_dialog");
              trackEvent(ANALYTICS_EVENTS.draft_created, { draft_hash: hashId(id), origin: "drafts_dialog" });
              onClose();
            }}
          >
            <Icon name="plus" size={12} />
            New draft
          </Button>
        </div>
      </div>

      {actions.drafts.length === 0 ? (
        <div className="rounded-lg border border-border-subtle bg-bg-elevated p-5">
          <div className="text-sm font-semibold text-text-primary">No drafts yet.</div>
          <div className="mt-1.5 text-sm leading-relaxed text-text-secondary">
            Drafts autosave to your browser. Publishing creates a shareable link; your draft stays here, ready to edit.
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
          {actions.drafts.map((draft) => (
            <DraftRow
              key={draft.id}
              draft={draft}
              isActive={draft.id === activeDraftId}
              isEditing={actions.editingId === draft.id}
              editingTitle={actions.editingTitle}
              onEditingTitleChange={actions.setEditingTitle}
              isConfirmingDelete={actions.confirmDeleteId === draft.id}
              variant="drawer"
              onOpen={() => { actions.onOpen(draft.id); onClose(); }}
              onBeginRename={() => actions.beginRename(draft)}
              onCancelRename={actions.cancelRename}
              onCommitRename={actions.commitRename}
              onDuplicate={() => actions.onDuplicate(draft.id)}
              onDelete={() => actions.onDelete(draft.id)}
              onCancelDeleteConfirm={actions.cancelDelete}
            />
          ))}
        </div>
      )}
    </>
  );
}
```

Remove the now-unused `isValidTitle` local function, `DraftMeta`/`listDrafts`/etc. imports that are no longer directly used in `TopBar.tsx` (check with `grep -n "listDrafts\|duplicateDraft\|deleteDraft\|updateDraft\b" src/components/app/TopBar.tsx` after this edit — `updateDraft` may still be needed elsewhere in the file for the inline `DraftTitle` rename path; only remove imports genuinely unused after this change), and add `import { DraftRow } from "./DraftRow"; import { useDraftListActions } from "./useDraftListActions";`.

- [ ] **Step 2: Type-check**

Run: `npm run test`

Expected: PASS.

- [ ] **Step 3: Manual browser verification**

Resize the browser below 1024px (or use device emulation), open the "More" menu → "My drafts" — the drawer's drafts view must behave identically to before (rename/duplicate/delete/open), now sharing logic with the desktop dialog. Confirm deleting the active draft while the drawer is open correctly closes the drawer and switches to the next draft (or creates one if none remain) — this is the `onActiveDraftDeleted` wiring, worth checking explicitly since it's the one behavior that was previously inline and is now threaded through a callback.

- [ ] **Step 4: Commit**

```bash
git add src/components/app/TopBar.tsx
git commit -m "refactor(editor): reuse the shared drafts-list hook in the mobile drawer view"
```

---

## Task 10: Expand the command palette

**Files:**
- Modify: `src/components/app/CommandPalette.tsx`
- Modify: `src/app/app/AppClient.tsx`
- Modify: `src/components/app/PasteInput.tsx`

**Interfaces:**
- Consumes: `INSERT_ITEMS` (Task 4), `listDrafts`/`DraftMeta` (`@/lib/drafts`).
- Produces: `PasteInput` gains a new `onInsertRequested?: (insertFn: (snippet: InsertSnippet) => void) => void` prop (mirroring the existing `onFocusShortcutRequested` registration pattern), letting `AppClient` trigger an insertion from outside the component tree (the command palette isn't a descendant of `PasteInput`).

- [ ] **Step 1: Expose an imperative insert function from `PasteInput`**

In `PasteInput.tsx`, register the already-built `insertSnippet` function (from Task 6) with the parent via the same pattern `onFocusShortcutRequested` already uses:

```typescript
  useEffect(() => {
    if (onInsertRequested) {
      onInsertRequested((snippet) => insertSnippet(snippet));
    }
  }, [onInsertRequested, insertSnippet]);
```

Add `onInsertRequested?: (insertFn: (snippet: InsertSnippet) => void) => void;` to `PasteInput`'s props type, next to the existing `onFocusShortcutRequested`.

- [ ] **Step 2: Expand `CommandPalette.tsx`**

```tsx
"use client";

import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { INSERT_ITEMS, type InsertSnippet } from "@/lib/editor/insertItems";
import { listDrafts, type DraftMeta } from "@/lib/drafts";
import { ROUTES } from "@/lib/constants";
import { navigateWithViewTransition, usePrefersReducedMotion } from "@/lib/motion";

export function CommandPalette({
  open,
  onOpenChange,
  onNew,
  onPublish,
  onUpdatePage,
  canPublish,
  isPublishing,
  publishedOwned,
  activeDraftId,
  onSwitchDraft,
  focusMode,
  onToggleFocusMode,
  onInsertSnippet,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNew: () => void;
  onPublish: () => void;
  onUpdatePage: () => void;
  canPublish: boolean;
  isPublishing: boolean;
  publishedOwned: boolean;
  activeDraftId: string | null;
  onSwitchDraft: (id: string) => void;
  focusMode: boolean;
  onToggleFocusMode: () => void;
  onInsertSnippet: (snippet: InsertSnippet) => void;
}) {
  const router = useRouter();
  const reducedMotion = usePrefersReducedMotion();
  const [drafts, setDrafts] = useState<DraftMeta[]>([]);

  // Refresh the drafts list every time the palette opens, not on every
  // keystroke — listDrafts() reads and JSON-parses the whole localStorage
  // blob (see src/lib/drafts/store.ts), which is unnecessary work per
  // keystroke when cmdk already filters client-side over a static list.
  useEffect(() => {
    if (open) setDrafts(listDrafts());
  }, [open]);

  const recentDrafts = useMemo(() => drafts.slice(0, 8), [drafts]);

  function go(path: string) {
    onOpenChange(false);
    navigateWithViewTransition(() => router.push(path), reducedMotion);
  }

  function createNewPage() {
    onOpenChange(false);
    onNew();
  }

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Command palette"
      className="fixed left-1/2 top-24 z-50 w-full max-w-lg -translate-x-1/2 rounded-card border border-border-default bg-bg-elevated shadow-glass"
    >
      <Command.Input
        placeholder="Jump to a draft, or run a command…"
        className="w-full border-b border-border-subtle bg-transparent px-4 py-3 text-sm text-text-primary placeholder:text-text-muted/50 focus:outline-none"
      />
      <Command.List className="max-h-96 overflow-y-auto p-2">
        <Command.Empty className="px-3 py-6 text-center text-sm text-text-muted">
          No results.
        </Command.Empty>

        {recentDrafts.length > 0 && (
          <Command.Group heading="Drafts" className="text-2xs uppercase tracking-wider text-text-muted px-2 py-1">
            {recentDrafts.map((d) => (
              <Command.Item
                key={d.id}
                value={d.title || "Untitled"}
                onSelect={() => { onOpenChange(false); onSwitchDraft(d.id); }}
                className="flex items-center gap-2 cursor-pointer rounded-lg px-3 py-2 text-sm text-text-primary aria-selected:bg-fill-2"
              >
                <Icon name="markdown" size={13} className="shrink-0 text-text-muted" />
                <span className="truncate">{d.title || "Untitled"}</span>
                {d.id === activeDraftId && (
                  <span className="ml-auto shrink-0 text-2xs text-text-muted">Current</span>
                )}
              </Command.Item>
            ))}
          </Command.Group>
        )}

        <Command.Group heading="Actions" className="text-2xs uppercase tracking-wider text-text-muted px-2 py-1">
          <Command.Item
            value="New draft"
            keywords={["create", "blank"]}
            onSelect={() => { onOpenChange(false); onNew(); }}
            className="cursor-pointer rounded-lg px-3 py-2 text-sm text-text-primary aria-selected:bg-fill-2"
          >
            New draft
          </Command.Item>
          {canPublish && !isPublishing && (
            <Command.Item
              value={publishedOwned ? "Update page" : "Publish"}
              keywords={["publish", "share", "update"]}
              onSelect={() => { onOpenChange(false); publishedOwned ? onUpdatePage() : onPublish(); }}
              className="cursor-pointer rounded-lg px-3 py-2 text-sm text-text-primary aria-selected:bg-fill-2"
            >
              {publishedOwned ? "Update page" : "Publish"}
            </Command.Item>
          )}
          <Command.Item
            value={focusMode ? "Exit focus mode" : "Enter focus mode"}
            keywords={["focus", "distraction", "zen"]}
            onSelect={() => { onOpenChange(false); onToggleFocusMode(); }}
            className="cursor-pointer rounded-lg px-3 py-2 text-sm text-text-primary aria-selected:bg-fill-2"
          >
            {focusMode ? "Exit focus mode" : "Enter focus mode"}
          </Command.Item>
        </Command.Group>

        <Command.Group heading="Insert" className="text-2xs uppercase tracking-wider text-text-muted px-2 py-1">
          {INSERT_ITEMS.map((item) => (
            <Command.Item
              key={item.id}
              value={item.label}
              keywords={item.keywords}
              onSelect={() => { onOpenChange(false); onInsertSnippet(item.snippet); }}
              className="flex items-center gap-2.5 cursor-pointer rounded-lg px-3 py-2 text-sm text-text-primary aria-selected:bg-fill-2"
            >
              <span className="flex h-4 w-4 shrink-0 items-center justify-center text-text-muted">
                {item.textGlyph ? (
                  <span className="font-mono text-2xs font-semibold">{item.textGlyph}</span>
                ) : (
                  <Icon name={item.icon} size={13} />
                )}
              </span>
              {item.label}
            </Command.Item>
          ))}
        </Command.Group>

        <Command.Group heading="Navigate" className="text-2xs uppercase tracking-wider text-text-muted px-2 py-1">
          <Command.Item
            onSelect={() => go(ROUTES.myPages)}
            className="cursor-pointer rounded-lg px-3 py-2 text-sm text-text-primary aria-selected:bg-fill-2"
          >
            My Pages
          </Command.Item>
          <Command.Item
            onSelect={createNewPage}
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

(`cmdk`'s `Command.Item` supports a `keywords: string[]` prop used by its built-in filter alongside `value` — confirmed against the library's own docs; no custom `filter` function is needed here.)

- [ ] **Step 3: Wire the new props in `AppClient.tsx`**

Add a ref to hold the registered insert function, mirroring `focusFnRef`:

```typescript
  const insertFnRef = useRef<null | ((snippet: InsertSnippet) => void)>(null);
```

(Import `type { InsertSnippet } from "@/lib/editor/insertItems";`.)

Pass the registration callback to `PasteInput` (alongside the existing `onFocusShortcutRequested`):

```tsx
            onInsertRequested={(fn) => { insertFnRef.current = fn; }}
```

Update the `CommandPalette` render call:

```tsx
      <CommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        onNew={onNew}
        onPublish={() => void onPublish()}
        onUpdatePage={() => void onUpdatePage()}
        canPublish={canPublish}
        isPublishing={status === "publishing"}
        publishedOwned={lastPublishedOwned}
        activeDraftId={activeDraftId}
        onSwitchDraft={(id) => onSwitchDraft(id, "unknown")}
        focusMode={focusMode}
        onToggleFocusMode={() => setFocusMode((f) => !f)}
        onInsertSnippet={(snippet) => insertFnRef.current?.(snippet)}
      />
```

- [ ] **Step 4: Type-check**

Run: `npm run test`

Expected: PASS.

- [ ] **Step 5: Manual browser verification**

Press ⌘K. Confirm: recent drafts are listed and switching one works; typing part of a draft's title filters to it; "New draft" / "Enter focus mode" / "Publish" (or "Update page" once a page exists) all work and close the palette; typing "callout" surfaces the five callout Insert items and selecting one inserts at the last cursor position in the editor; "My Pages" still navigates as before.

- [ ] **Step 6: Commit**

```bash
git add src/components/app/CommandPalette.tsx src/app/app/AppClient.tsx src/components/app/PasteInput.tsx
git commit -m "feat(editor): expand command palette into a real quick-switcher (drafts, actions, insert, navigate)"
```

---

## Task 11: Focus Mode — typewriter scrolling

**Files:**
- Modify: `src/components/app/PasteInput.tsx`
- Modify: `src/app/app/AppClient.tsx`

**Interfaces:**
- `PasteInput` gains a `focusMode?: boolean` prop.

- [ ] **Step 1: Pass `focusMode` down from `AppClient`**

In `AppClient.tsx`'s `<PasteInput .../>` render call, add `focusMode={focusMode}`.

- [ ] **Step 2: Add the `focusMode` prop and a typewriter-scroll function to `PasteInput`**

```typescript
import { usePrefersReducedMotion } from "@/lib/motion";
```

Add `focusMode?: boolean;` to the props type. Inside the component:

```typescript
  const reducedMotion = usePrefersReducedMotion();

  const maybeTypewriterScroll = useCallback(
    (ta: HTMLTextAreaElement) => {
      if (!focusMode) return;
      const { top, height } = getCaretCoordinates(ta, ta.selectionStart);
      const target = Math.max(0, Math.min(top - ta.clientHeight * 0.42 + height / 2, ta.scrollHeight - ta.clientHeight));
      ta.scrollTo({ top: target, behavior: reducedMotion ? "auto" : "smooth" });
    },
    [focusMode, reducedMotion],
  );
```

(`getCaretCoordinates` is already imported from `@/lib/ui/caret` per the existing wikilink code — reused here, not reimplemented.)

- [ ] **Step 3: Call it from the same interaction points already tracked for wikilink/slash triggers**

In the textarea's `onChange`, `onClick`, and the `onKeyUp` cursor-movement branch, add `maybeTypewriterScroll(e.currentTarget)` alongside the existing `updateWikilinkTrigger`/`updateSlashTrigger` calls. Also call it once when Focus Mode is toggled on, so entering focus mode immediately centers the current line — in `AppClient.tsx`, this can be handled by `PasteInput` itself via a `useEffect`:

```typescript
  useEffect(() => {
    if (focusMode && ref.current) maybeTypewriterScroll(ref.current);
    // Only re-center on the focusMode transition itself, not on every
    // keystroke (typing already re-centers via the handlers above).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusMode]);
```

- [ ] **Step 4: Manual browser verification**

Open `/app`, write several lines of text so the textarea scrolls, then press ⌘. to enter Focus Mode — the current line should smoothly scroll to roughly the vertical center. Continue typing — the caret line should stay centered as new lines are added. Move the cursor with arrow keys/clicks — centering should follow. Toggle `prefers-reduced-motion` in devtools and repeat — the recentering should happen instantly (no smooth animation) but still occur. Exit Focus Mode (⌘.) — no more forced centering; normal scroll behavior resumes.

- [ ] **Step 5: Commit**

```bash
git add src/components/app/PasteInput.tsx src/app/app/AppClient.tsx
git commit -m "feat(editor): add typewriter scrolling to Focus Mode"
```

---

## Task 12: Focus Mode — optional paragraph dimming

**Files:**
- Create: `src/lib/editor/prefs.ts`
- Test: `tests/unit/editor-prefs.spec.ts`
- Modify: `src/components/app/SyntaxOverlay.tsx`
- Modify: `src/components/app/PasteInput.tsx`
- Modify: `src/components/app/TopBar.tsx`
- Modify: `src/app/app/AppClient.tsx`

**Interfaces:**
- Produces: `getEditorPrefs(): EditorPrefs`, `setEditorPrefs(patch: Partial<EditorPrefs>): EditorPrefs`, `type EditorPrefs = { paragraphDimming: boolean }` from `src/lib/editor/prefs.ts`.

This is a local-only editor preference (not a `DocSettings` field — it must never touch the published-document shape, per the design spec's non-goals).

- [ ] **Step 1: Write the failing test**

Create `tests/unit/editor-prefs.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";

// getEditorPrefs/setEditorPrefs read/write localStorage directly, so these
// run against a minimal in-memory localStorage stub rather than a browser —
// consistent with this repo's other tests/unit specs, which test pure logic
// without a DOM.
test.describe("editor prefs", () => {
  test.beforeEach(() => {
    const store = new Map<string, string>();
    (globalThis as unknown as { localStorage: Storage }).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, v); },
      removeItem: (k: string) => { store.delete(k); },
      clear: () => store.clear(),
      key: () => null,
      length: 0,
    } as Storage;
  });

  test("defaults paragraphDimming to false when nothing is stored", async () => {
    const { getEditorPrefs } = await import("@/lib/editor/prefs");
    expect(getEditorPrefs().paragraphDimming).toBe(false);
  });

  test("setEditorPrefs persists and getEditorPrefs reads it back", async () => {
    const { getEditorPrefs, setEditorPrefs } = await import("@/lib/editor/prefs");
    setEditorPrefs({ paragraphDimming: true });
    expect(getEditorPrefs().paragraphDimming).toBe(true);
  });

  test("setEditorPrefs merges rather than replacing unrelated keys", async () => {
    const { getEditorPrefs, setEditorPrefs } = await import("@/lib/editor/prefs");
    setEditorPrefs({ paragraphDimming: true });
    const result = setEditorPrefs({});
    expect(result.paragraphDimming).toBe(true);
  });

  test("malformed stored JSON falls back to defaults instead of throwing", async () => {
    localStorage.setItem("booklet:editorPrefs", "{not json");
    const { getEditorPrefs } = await import("@/lib/editor/prefs");
    expect(() => getEditorPrefs()).not.toThrow();
    expect(getEditorPrefs().paragraphDimming).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx playwright test --config=playwright.unit.config.ts editor-prefs`

Expected: FAIL — `Cannot find module '@/lib/editor/prefs'`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/editor/prefs.ts`:

```typescript
/**
 * Local-only editor preferences — distinct from `DocSettings`
 * (src/lib/blocks.ts), which describes a *published document's*
 * presentation and is part of the publish contract. These never leave the
 * browser and never touch a published page.
 */
export type EditorPrefs = {
  /** Focus Mode: dim every paragraph except the one the cursor is in.
   * Off by default so existing Focus Mode users aren't surprised by a
   * behavior change. */
  paragraphDimming: boolean;
};

const STORAGE_KEY = "booklet:editorPrefs";

const DEFAULT_PREFS: EditorPrefs = {
  paragraphDimming: false,
};

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

export function getEditorPrefs(): EditorPrefs {
  if (!isBrowser()) return DEFAULT_PREFS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<EditorPrefs>;
    return { ...DEFAULT_PREFS, ...parsed };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function setEditorPrefs(patch: Partial<EditorPrefs>): EditorPrefs {
  const next = { ...getEditorPrefs(), ...patch };
  if (isBrowser()) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Best-effort — same non-fatal posture as the drafts store's own
      // localStorage writes (src/lib/drafts/store.ts).
    }
  }
  return next;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx playwright test --config=playwright.unit.config.ts editor-prefs`

Expected: PASS, all 4 tests green.

- [ ] **Step 5: Extend `SyntaxOverlay` to support dimming lines outside the active paragraph**

Add a new optional prop and rendering logic to `src/components/app/SyntaxOverlay.tsx`:

```typescript
export const SyntaxOverlay = forwardRef<HTMLDivElement, { value: string; dimOutsideParagraphAt?: number | null }>(
  function SyntaxOverlay({ value, dimOutsideParagraphAt }, contentRef) {
    const lines = useMemo(() => value.split("\n"), [value]);

    // When set, computes the [start, end] line-index range of the paragraph
    // containing the caret (a "paragraph" is a run of non-blank lines) —
    // every line outside that range renders dimmed. Recomputed only when
    // the caret's line or the text itself changes, not on every render.
    const activeRange = useMemo(() => {
      if (dimOutsideParagraphAt == null) return null;
      const upTo = value.slice(0, dimOutsideParagraphAt);
      const caretLine = upTo.split("\n").length - 1;
      let start = caretLine;
      while (start > 0 && lines[start - 1]?.trim() !== "") start--;
      let end = caretLine;
      while (end < lines.length - 1 && lines[end + 1]?.trim() !== "") end++;
      return [start, end] as const;
    }, [dimOutsideParagraphAt, value, lines]);

    return (
      <div
        aria-hidden
        className={[
          "pointer-events-none absolute inset-0 overflow-hidden",
          "scrollbar-stable",
          "whitespace-pre-wrap break-words",
          "font-mono text-sm leading-[1.65]",
          "px-5 py-4",
          "text-text-primary",
        ].join(" ")}
      >
        <div ref={contentRef}>
          {lines.map((line, i) => {
            const dimmed = activeRange ? i < activeRange[0] || i > activeRange[1] : false;
            return (
              <div key={i} className={dimmed ? "opacity-40 transition-opacity duration-normal" : "transition-opacity duration-normal"}>
                {tokenizeLine(line).map((tok, j) =>
                  tok.syntax ? (
                    <span key={j} className="text-text-muted/60">{tok.text}</span>
                  ) : (
                    <span key={j}>{tok.text}</span>
                  ),
                )}
                {line === "" ? " " : null}
              </div>
            );
          })}
        </div>
      </div>
    );
  },
);
```

- [ ] **Step 6: Wire it into `PasteInput`**

`paragraphDimming` is a prop (like `focusMode` from Task 11), not state `PasteInput` reads for itself — `AppClient` owns the single source of truth (loaded from `getEditorPrefs()` and live-updated by the `SettingsPanel` toggle in Step 7/8 below), and both `PasteInput` and `TopBar`/`SettingsPanel` must observe the same value. Add `paragraphDimming?: boolean;` to `PasteInput`'s props type, next to `focusMode?: boolean;`.

Add state for the current caret index (only tracked when needed) and pass it through:

```typescript
  const [caretIndex, setCaretIndex] = useState(0);
```

Update `caretIndex` at the same interaction points as the other caret-driven handlers (`onChange`, `onClick`, the cursor-movement branch of `onKeyUp`) with `setCaretIndex(e.currentTarget.selectionStart)`.

Pass to `SyntaxOverlay`:

```tsx
          <SyntaxOverlay
            ref={overlayContentRef}
            value={deferredValue}
            dimOutsideParagraphAt={focusMode && paragraphDimming ? caretIndex : null}
          />
```

- [ ] **Step 7: Add the toggle to `SettingsPanel` in `TopBar.tsx`**

`TopBar` needs two new props: `paragraphDimming: boolean` and `onParagraphDimmingChange: (v: boolean) => void`, threaded to `SettingsPanel`. Add a new section to `SettingsPanel`, visually separated from the `DocSettings`-bound controls above it (a labeled subsection makes clear this is an editor preference, not a published-page setting):

```tsx
        <div className="pt-1 border-t border-border-subtle">
          <div className="mb-1.5 mt-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
            Focus mode
          </div>
          <SegmentedControl
            value={paragraphDimming ? "on" : "off"}
            options={[
              { label: "Dim off-paragraph text: Off", value: "off" },
              { label: "On", value: "on" },
            ]}
            onChange={(v) => onParagraphDimmingChange(v === "on")}
          />
        </div>
```

(Adjust label text to fit `SegmentedControl`'s existing width conventions — check its rendered width against the other two-option rows above it in the same panel and shorten to `"Off"`/`"On"` with a preceding `<div>` caption `"Dim inactive paragraphs"` above the control, matching the panel's existing caption-then-control pattern exactly, rather than embedding the description in the option label itself.)

- [ ] **Step 8: Wire the new state through `AppClient.tsx`**

Add `import { getEditorPrefs, setEditorPrefs } from "@/lib/editor/prefs";` alongside the file's other `@/lib/...` imports.

```typescript
  const [paragraphDimming, setParagraphDimming] = useState(false);

  useEffect(() => {
    setParagraphDimming(getEditorPrefs().paragraphDimming);
  }, []);

  const onParagraphDimmingChange = useCallback((v: boolean) => {
    setParagraphDimming(v);
    setEditorPrefs({ paragraphDimming: v });
  }, []);
```

Pass `paragraphDimming` and `onParagraphDimmingChange={onParagraphDimmingChange}` to `<TopBar .../>`, and pass `paragraphDimming={paragraphDimming}` down to `<PasteInput .../>` (the prop added in Step 6) — `AppClient` is the single source of truth, loaded once from `getEditorPrefs()` on mount and updated live whenever `SettingsPanel`'s toggle fires, so `PasteInput` and `TopBar` always observe the same value.

- [ ] **Step 9: Type-check**

Run: `npm run test`

Expected: PASS.

- [ ] **Step 10: Manual browser verification**

Open Settings → toggle "Dim inactive paragraphs" on. Enter Focus Mode. Write 2–3 paragraphs separated by blank lines — only the paragraph containing the cursor should render at full opacity; the others dim. Click into a different paragraph — dimming should follow. Toggle the setting off — dimming stops immediately. Refresh the page — the toggle's last value should persist (localStorage).

- [ ] **Step 11: Commit**

```bash
git add src/lib/editor/prefs.ts tests/unit/editor-prefs.spec.ts src/components/app/SyntaxOverlay.tsx src/components/app/PasteInput.tsx src/components/app/TopBar.tsx src/app/app/AppClient.tsx
git commit -m "feat(editor): add opt-in paragraph dimming to Focus Mode"
```

---

## Task 13: Empty-state copy upgrade

**Files:**
- Modify: `src/components/app/PasteInput.tsx`

- [ ] **Step 1: Enhance the existing first-run banner copy**

The empty-state banner already exists (`PasteInput.tsx:816-831`) — enhance its copy to surface the new surfaces this plan adds, keeping it to the one-line-plus-button shape the brand voice rules call for (`BRAND.md`: "one idea per section," no fluff):

```tsx
        {isEmpty && (
          <div className="shrink-0 flex items-center justify-between gap-3 border-b border-border-subtle bg-accent-dim/40 px-4 py-2 animate-fade-in">
            <span className="text-xs text-text-secondary">
              Write your first line — or press <kbd className="font-mono">⌘K</kbd> for commands, <kbd className="font-mono">/</kbd> to insert a block.
            </span>
            {onInsertSample && (
              <button
                type="button"
                onClick={onInsertSample}
                className="shrink-0 text-xs font-semibold text-accent transition hover:text-accent-soft"
              >
                Insert sample
              </button>
            )}
          </div>
        )}
```

- [ ] **Step 2: Manual browser verification**

Create a brand-new empty draft — the banner should read the updated copy and disappear the instant any character is typed or a file is imported (unchanged existing behavior, only the copy changed).

- [ ] **Step 3: Commit**

```bash
git add src/components/app/PasteInput.tsx
git commit -m "feat(editor): teach the slash menu and command palette in the empty-draft hint"
```

---

## Task 14: Mobile Write/Preview transition polish

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/components/app/AppShell.tsx`

**Interfaces:** None new — this is a CSS-only entrance-animation upgrade, keeping the existing always-mounted-both-panes/`hidden`-class mechanism exactly as-is (no mount/unmount risk to textarea focus, scroll position, or preview state).

- [ ] **Step 1: Add a new `paneIn` keyframe to `globals.css`**

Near the existing `@keyframes dialogIn` / `dropdownIn` / `fadeIn` block (`globals.css:305-315`), add:

```css
@keyframes paneIn {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: none; }
}
```

Near the existing `--animate-dialog-in` / `--animate-dropdown-in` / `--animate-fade-in` token block (`globals.css:382-386`), add:

```css
  --animate-pane-in: paneIn 180ms cubic-bezier(0.16, 1, 0.3, 1) both;
```

(180ms matches `--duration-normal`; the easing is `--ease-spring` — no new duration or easing value introduced, per the Global Constraints.)

- [ ] **Step 2: Use it in `AppShell.tsx`**

Replace `animate-fade-in` with `animate-pane-in` on both pane wrapper `div`s (the two `className` arrays currently containing `pane === "edit" ? "flex-1 animate-fade-in" : "hidden lg:flex"` and `pane === "preview" ? "flex-1 animate-fade-in" : "hidden lg:flex"`).

- [ ] **Step 3: Manual browser verification**

At a viewport below 1024px, switch between the Write/Preview tabs repeatedly — the incoming pane should fade in with a slight upward settle instead of a flat fade, matching the feel of the app's dialogs/dropdowns. Confirm switching tabs still preserves textarea scroll position and cursor (nothing about the mount strategy changed, only the CSS class).

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css src/components/app/AppShell.tsx
git commit -m "feat(editor): give the mobile Write/Preview tab switch a designed entrance instead of a flat fade"
```

---

## Task 15: Accessibility pass + regression coverage

**Files:**
- Modify: `package.json` (new devDependency)
- Create: `tests/e2e/accessibility.spec.ts`
- Create: `tests/e2e/slash-menu.spec.ts`
- Create: `tests/e2e/command-palette.spec.ts`
- Modify: various (aria-label fixes found during the audit, if any)

- [ ] **Step 1: Install `@axe-core/playwright` as a dev dependency**

```bash
npm install --save-dev @axe-core/playwright
```

This is a well-established, dev-only, zero-runtime-footprint addition (used only by Playwright test files) that gives durable, automated protection against accessibility regressions on the editor screen going forward — not a one-off manual check.

- [ ] **Step 2: Write the axe scan test**

Create `tests/e2e/accessibility.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("editor accessibility", () => {
  test("no automatically-detectable a11y violations in dark mode", async ({ page }) => {
    await page.goto("/app");
    await page.waitForSelector("textarea");
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });

  test("no automatically-detectable a11y violations in light mode", async ({ page }) => {
    await page.goto("/app");
    await page.waitForSelector("textarea");
    // ThemeToggle lives inside the Settings panel gear icon in TopBar.
    await page.getByRole("button", { name: "Settings" }).click();
    await page.getByRole("button", { name: /light/i }).click().catch(async () => {
      // Fall back to toggling via localStorage + reload if the exact
      // accessible name differs from this guess — the assertion below is
      // what matters, not how we got into light mode.
      await page.evaluate(() => localStorage.setItem("theme", "light"));
      await page.reload();
      await page.waitForSelector("textarea");
    });
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([]);
  });

  test("the slash menu and command palette are keyboard-reachable and labeled", async ({ page }) => {
    await page.goto("/app");
    const textarea = page.locator("textarea").first();
    await textarea.click();
    await page.keyboard.type("/head");
    await expect(page.getByText("Heading 1", { exact: true })).toBeVisible();
    await page.keyboard.press("Escape");

    await page.keyboard.press("Control+k");
    await expect(page.getByPlaceholder(/jump to a draft/i)).toBeVisible();
    await page.keyboard.press("Escape");
  });
});
```

- [ ] **Step 3: Run the accessibility tests and fix anything they find**

Run: `npm run dev` (background), then `npx playwright test accessibility`

Expected: initially may FAIL — if it does, read each violation's `id`/`nodes` output and fix the underlying markup (most likely candidates given the audit: missing `aria-label` on any new icon-only button that doesn't already get one from `title`/`aria-label` props consistent with the rest of the codebase's `Button`/`IconBtn` usage — every new button added in Tasks 6, 7, and 10 already includes `title`/`aria-label` per the code above, so this should be close to a clean pass; fix anything genuinely surfaced, don't pre-emptively rewrite passing markup).

Re-run until PASS.

- [ ] **Step 4: Write `tests/e2e/slash-menu.spec.ts`**

```typescript
import { test, expect } from "@playwright/test";

test.describe("slash-insert menu", () => {
  test("opens on '/' at the start of a line and inserts a callout", async ({ page }) => {
    await page.goto("/app");
    const textarea = page.locator("textarea").first();
    await textarea.click();
    await textarea.fill("Intro paragraph.\n");
    await page.keyboard.type("/warn");

    await expect(page.getByText("Callout: Warning", { exact: true })).toBeVisible();
    await page.keyboard.press("Enter");

    await expect(textarea).toHaveValue(/Intro paragraph\.\n> \[!warning\]\n> $/);
  });

  test("does not open mid-word", async ({ page }) => {
    await page.goto("/app");
    const textarea = page.locator("textarea").first();
    await textarea.click();
    await textarea.fill("60km/h");

    await expect(page.getByText("Divider", { exact: true })).not.toBeVisible();
  });

  test("closes on Escape without inserting", async ({ page }) => {
    await page.goto("/app");
    const textarea = page.locator("textarea").first();
    await textarea.click();
    await page.keyboard.type("/tab");
    await expect(page.getByText("Table", { exact: true })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByText("Table", { exact: true })).not.toBeVisible();
    await expect(textarea).toHaveValue("/tab");
  });

  test("the toolbar Insert button opens the menu anchored under the button", async ({ page }) => {
    await page.goto("/app");
    await page.locator("textarea").first().click();
    await page.getByTitle("Insert block (/)").click();
    await expect(page.getByText("Divider", { exact: true })).toBeVisible();
  });
});
```

- [ ] **Step 5: Run and verify**

Run: `npx playwright test slash-menu`

Expected: PASS (4 tests). If the regex assertion in the first test doesn't match due to a whitespace/escaping mismatch, adjust it to the actual inserted value rather than loosening the assertion's intent.

- [ ] **Step 6: Write `tests/e2e/command-palette.spec.ts`**

```typescript
import { test, expect, type Page } from "@playwright/test";

async function seedSecondDraft(page: Page, title: string, id = "seeded-palette-draft-1") {
  await page.evaluate(
    ({ title, id }) => {
      const raw = localStorage.getItem("booklet:draftsDb");
      const db = raw ? JSON.parse(raw) : { schemaVersion: 2, drafts: {} };
      const now = new Date().toISOString();
      db.drafts[id] = {
        id, v: 2, createdAt: now, updatedAt: now, title,
        raw: `# ${title}\n\nSome content.`,
        settings: { spacing: "comfortable", width: "normal", code: "collapse" },
      };
      localStorage.setItem("booklet:draftsDb", JSON.stringify(db));
    },
    { title, id },
  );
}

test.describe("command palette", () => {
  test("lists and switches to another draft by fuzzy title match", async ({ page }) => {
    await page.goto("/app");
    await seedSecondDraft(page, "Quarterly Roadmap");

    await page.keyboard.press("Control+k");
    await page.keyboard.type("Roadmap");
    await expect(page.getByText("Quarterly Roadmap", { exact: true })).toBeVisible();
    await page.getByText("Quarterly Roadmap", { exact: true }).click();

    await expect(page.locator("textarea").first()).toHaveValue(/Quarterly Roadmap/);
  });

  test("runs the 'New draft' action and closes the palette", async ({ page }) => {
    await page.goto("/app");
    await page.keyboard.press("Control+k");
    await page.getByText("New draft", { exact: true }).click();
    await expect(page.getByPlaceholder(/jump to a draft/i)).not.toBeVisible();
  });

  test("Insert group inserts a block at the editor's last cursor position", async ({ page }) => {
    await page.goto("/app");
    const textarea = page.locator("textarea").first();
    await textarea.click();
    await textarea.fill("Existing text.");
    await textarea.press("End");

    await page.keyboard.press("Control+k");
    await page.keyboard.type("Divider");
    await page.getByText("Divider", { exact: true }).click();

    await expect(textarea).toHaveValue("Existing text.---\n");
  });
});
```

- [ ] **Step 7: Run and verify**

Run: `npx playwright test command-palette`

Expected: PASS (3 tests). If the third test's exact concatenation differs from the actual insertion point behavior, adjust the assertion to match the real (not assumed) output — the point of the test is to lock in whatever the actual cursor-insertion behavior is, not to force a specific string blindly.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json tests/e2e/accessibility.spec.ts tests/e2e/slash-menu.spec.ts tests/e2e/command-palette.spec.ts
git commit -m "test(editor): add axe accessibility scan and e2e coverage for the slash menu and command palette"
```

---

## Task 16: Full verification pass

**Files:** None (verification only).

- [ ] **Step 1: Type-check**

Run: `npm run test`

Expected: PASS, zero errors.

- [ ] **Step 2: Lint**

Run: `npm run lint`

Expected: PASS, zero errors (warnings acceptable only if they pre-exist and are unrelated to this plan's changes — check with `git stash` + re-run if unsure whether a warning predates this work).

- [ ] **Step 3: Full unit suite**

Run: `npm run test:unit`

Expected: PASS, all specs green — including every new spec from Tasks 4, 6, 12 and every pre-existing spec (`wikilinks-parse`, `wikilinks-index`, `wikilinks-layout`, etc.), confirming Task 5's refactor and every other change introduced no regressions elsewhere.

- [ ] **Step 4: Full e2e suite**

Run: `npm run dev` (background), then `npx playwright test`

Expected: PASS, all specs green — `console-errors.spec.ts`, `happy-paths.spec.ts`, `wikilink-autocomplete.spec.ts`, and the new `accessibility.spec.ts` / `slash-menu.spec.ts` / `command-palette.spec.ts`.

- [ ] **Step 5: Manual QA pass in a real browser**

Following the design spec's Testing Approach section (`docs/superpowers/specs/2026-08-04-editor-revamp-design.md`), exercise every new surface end-to-end in both light and dark themes, at both desktop and mobile viewport widths: slash menu (open/filter/insert/dismiss for every item type including toggle and columns), the expanded command palette (draft switch, every action, every insert item), Focus Mode (typewriter scrolling, paragraph dimming toggle), the empty-state hint, the mobile pane transition, and both drafts entry points (⌘D dialog, mobile drawer) for rename/duplicate/delete. Fix anything that reads as unpolished rather than merely "not broken" — this is the point in the process where the design spec explicitly invites taking a well-judged extra step if something better surfaces during testing, as long as it stays inside the spec's principles and non-goals.

- [ ] **Step 6: No commit for this task** — it is verification-only. If Step 5 surfaces fixes, make them as small follow-up commits against the relevant task's files, each with its own focused commit message.

---

## Post-plan (not part of this implementation plan, handled separately)

Per the session's broader instructions (outside this plan's scope): after this plan is fully executed and verified, the design spec and this plan document themselves get removed as part of a repo-wide cleanup of planning/spec artifacts, and the final result gets committed and pushed. That cleanup is a separate, final step in the parent conversation — not a task in this plan, since this plan's own file is one of the things that cleanup removes.
