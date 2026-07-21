# RFC: Rich Markdown Blocks
> Status: IMPLEMENTED — Phases 1–4 complete (commit 5c92395, 2026-07-22). Phase 5 (stat/dashboard blocks) deliberately deferred — gated on adoption data from `rich_block_kinds` usage tracking, not built speculatively.
> Scale: Epic
> Target start: 2026-07-28
> Created: 2026-07-21
> Author: Ashwin Sathian (via Claude)

---

## 🎯 Goals

**Problem statement.** Readable's Markdown dialect today covers headings, paragraphs, lists, blockquotes, code, tables, images, Mermaid-family diagrams, and math (`src/lib/blocks.ts:25-35`) — a "flat" document model with no progressive disclosure, no side-by-side layout, and no diagram options beyond Mermaid. A May 2026 essay by Anthropic engineer Thariq Shihipar ("The Unreasonable Effectiveness of HTML") argued that AI-generated review documents (specs, plans, PR write-ups, audits) increasingly need this kind of structure, and that HTML — not Markdown — is the right vehicle for it. A prior proposal to accept raw HTML as a first-class peer to Markdown on Readable was evaluated and **rejected**: Readable's publish flow allows fully anonymous, unauthenticated publishing to a public URL gated only by a 12/minute IP rate limit (`src/app/api/publish/route.ts:32`), and its renderer deliberately never uses `dangerouslySetInnerHTML` on user content — raw HTML nodes are stripped by design (`src/lib/parse.ts:206,210-218`). Accepting arbitrary HTML/JS would reopen an XSS and phishing/malware-hosting surface that the current architecture was explicitly built to avoid, and would contradict the "Write in Markdown" brand identity.

This RFC asks a narrower question: **can the specific, legitimate value in Thariq's argument — progressive disclosure, visual hierarchy, side-by-side comparison, richer diagrams — be delivered as new Markdown-native block types**, parsed into Readable's existing typed `Block` AST and rendered with the existing React-only (never-`dangerouslySetInnerHTML`) renderer, with zero increase in attack surface?

**What success looks like in 3 months:**
- Three new Markdown-native block types (callout, toggle, columns) are shipped, documented, and rendering correctly on published pages.
- At least one additional static-SVG diagram language beyond Mermaid is available.
- Adoption is measurable (% of new publishes using at least one new block type), and the decision to build further (stat/dashboard blocks) is made from that data, not from the original essay.
- No security regression: the "never `dangerouslySetInnerHTML` on user content" invariant holds, verified by test.

## 📘 Background

**Feasibility research (already completed, not re-derived here):** Thariq's essay contains 20 example artifacts. Direct inspection of all 20 source files shows exactly 8 are static (no JS execution needed) — using only semantic HTML (`<table>`, `<details>`), inline SVG, and CSS grid/flex/color — while the other 12 (sliders, drag-and-drop kanban boards, a `contenteditable` "prompt tuner", click-to-inspect panels, animation sandboxes) are genuinely interactive single-purpose web apps, not documents. The top-voted Hacker News objection (thread on the essay) was that HTML breaks human/LLM co-authoring and git-diffability — a real cost, not just a security one. Ecosystem research confirms the **static** 40% has proven, adopted, non-HTML Markdown-native prior art: GitHub/Obsidian's `> [!NOTE]` blockquote-marker convention for callouts; `remark-directive`-based triple-colon containers (`:::name`) used by Astro Starlight and the VitePress/Docusaurus family for toggles, tabs, and custom containers; and fenced-code-block dispatch (the same pattern Mermaid already uses) for additional diagram languages that compile deterministically to static SVG (Graphviz/D2), as opposed to ones needing server-side rendering (PlantUML) or a hosted conversion service (Kroki). The **interactive** 60% has no Markdown-native equivalent anywhere in the ecosystem, because it isn't a documents problem — it's a mini-app-authoring problem, which is exactly the raw-HTML/JS-execution surface already rejected.

**Current architecture (verified in code, not inferred):**
- `Block`/`Inline` union: `src/lib/blocks.ts:1-35`. `PublishedDoc` persists the **parsed** `blocks: Block[]` as source of truth; `raw` Markdown is optional, best-effort, and may be truncated or absent (`src/lib/blocks.ts:56-62`, `src/app/api/publish/route.ts:82` truncates to `STORAGE.maxInputChars`). Reads never re-parse — `getDoc` (`src/lib/storage.ts:33-37`) returns the stored `Block[]` directly.
- Parser: `src/lib/parse.ts`. `blocksFromChildren()` is one flat `switch` over mdast node types (`parse.ts:120-202`); unrecognized node types are silently dropped (`default: break`, `parse.ts:196-197`). Diagram-language special-casing already exists and is the pattern to replicate: the `"code"` case checks `DIAGRAM_LANGS.has(lang)` and emits `{t:"diagram",...}` instead of `{t:"code",...}` (`parse.ts:157-170`, set defined `blocks.ts:72-86`). Raw HTML nodes are actively stripped via `visit(tree, "html", removeRawHtmlNodes)` (`parse.ts:206,210-218`) — **this must not change**.
- Renderer: `src/components/blocks/BlockRenderer.tsx`, one `switch (b.t)` per block kind (`:73-325`), `default: return null` (`:323-324`). Heavy per-block renderers (`CodeBlock`, `DiagramBlock`, `MathDisplay`) are loaded via `next/dynamic(..., {ssr:false})` (`:10-12`) to keep KaTeX/highlight.js/Mermaid out of the SSR bundle. Every existing `dangerouslySetInnerHTML`/`innerHTML` use in the codebase is on system- or library-generated content only — JSON-LD, computed theme CSS, KaTeX output, highlight.js output, and Mermaid's rendered SVG (`DiagramBlock.tsx:45`, via `mermaid.initialize({ securityLevel: "strict" })` at `:38`) — never raw user markup.
- TOC/anchors: `src/lib/toc.ts`. `buildToc()` independently re-walks `Block[]` (not the renderer, not the mdast tree) to generate the sidebar table of contents and heading anchor IDs, consumed at `src/app/p/[id]/page.tsx:159-161,238,246-249,256` and the embed page equivalent. **It only recurses into `quote` block children today** (`toc.ts:89-91`) — it does not recurse into list items or any other container. This is a real, silent gap: any future container block type that isn't added to this walk will render correctly but its nested headings will vanish from the sidebar TOC with no error.
- Validation: the publish API (`src/app/api/publish/route.ts:45-59`) checks only that `payload.blocks` is a non-empty array and that the serialized payload fits `STORAGE.maxDocBytes` — there is **no per-block shape validation** (no Zod schema for `Block`, confirmed by search). This is an existing gap, not something this RFC introduces, but expanding the `Block` union is a natural forcing function to close it (see Phase 1).
- Dependencies today: `remark-gfm`, `remark-math`, `remark-parse`, `unified`, `unist-util-visit`, `mermaid` — no `remark-directive`, no `rehype-*`, no HTML sanitizer of any kind (none needed today, since raw HTML is stripped, not rendered).

## 🔭 Non-Goals

- **Not** accepting raw HTML or raw inline SVG passthrough in any form, including for "inert" tags like literal `<details>`. Every new capability is its own typed `Block`, parsed from Markdown-native syntax — never from literal HTML tags in user input. `removeRawHtmlNodes` stays exactly as-is.
- **Not** supporting any block that requires client-side JS interactivity beyond the existing dynamic-import rendering pattern — no click handlers, sliders, drag-and-drop, `contenteditable`, or embedded arbitrary widgets, ever. This is a permanent boundary, not a phase-1 deferral: see Alternatives Considered.
- **Not** introducing a server-side diagram-rendering service (Kroki-style) or any diagram language that requires server-side execution (PlantUML's typical Java renderer). Diagram support is client-side-WASM-compile-to-static-SVG only.
- **Not** retroactively migrating already-published documents. New `Block` kinds are additive and safe for new publishes only; old documents render exactly as before, following the existing defensive-rendering precedent (`BlockRenderer.tsx:166-169`'s legacy `ListItem` shape guard), not a data migration.
- **Not** committing to stat/dashboard/progress-bar blocks in this RFC. No Markdown-native prior art exists for these anywhere in the ecosystem (unlike callouts, toggles, columns, and diagrams, which all have proven conventions) — see Phase 5.
- **Not** building editor-UI affordances (toolbar buttons, insert menus) for the new syntax in Phases 1-4 — see Open Questions.

## 🏗 Architecture

### System Diagram

```
Markdown source (editor, textarea)
        │
        ▼
unified().use(remarkParse, remarkGfm, remarkMath, remarkDirective)   ← NEW: remarkDirective
        │  (mdast tree; raw "html" nodes stripped, unchanged)
        ▼
blocksFromChildren()  [src/lib/parse.ts]
        │  existing switch on node.type, extended with:
        │   - "blockquote" → inspect first-line marker → {t:"callout",...} | {t:"quote",...}
        │   - "containerDirective" (name="toggle") → {t:"toggle",...}
        │   - "containerDirective" (name="columns") → {t:"columns",...}
        │   - "code" with new DIAGRAM_LANGS_V2 entries → {t:"diagram", lang:"graphviz", code}
        ▼
Block[]  (persisted as-is in PublishedDoc.blocks — src/lib/blocks.ts:56-62)
        │
        ▼
BlockRenderer switch(b.t)  [src/components/blocks/BlockRenderer.tsx]
        │   - new cases: "callout" → <Callout>, "toggle" → <Toggle> (native <details> JSX,
        │     not HTML passthrough), "columns" → <Columns> (CSS grid)
        │   - "diagram" case extended: DiagramBlock dispatches by lang family (mermaid vs graphviz)
        ▼
buildToc()  [src/lib/toc.ts]  ← walk() generalized to recurse into ANY block with nested
        │      children (quote | callout | toggle | columns), not just "quote"
        ▼
Rendered page + sidebar TOC
```

### Component Inventory

| Component | New / Modified | Notes |
|---|---|---|
| `src/lib/blocks.ts` | Modify | Add `callout`, `toggle`, `columns` to `Block` union; extend `DIAGRAM_LANGS` (or add a parallel set) for the new diagram family |
| `src/lib/parse.ts` | Modify | Blockquote-marker detection for callouts; wire `remark-directive`; new `containerDirective` cases |
| `src/lib/block-schema.ts` | New | Zod discriminated-union schema mirroring `Block`, used to validate `POST /api/publish` payloads |
| `src/lib/toc.ts` | Modify | Generalize `walk()`'s container recursion (currently `quote`-only) to a shared set of "container" block kinds |
| `src/components/blocks/BlockRenderer.tsx` | Modify | New `switch` cases for `callout` / `toggle` / `columns`; extend `diagram` case for the new language family |
| `src/components/blocks/Callout.tsx` | New | Renders `{t:"callout", kind, blocks}` — icon + colored left-border treatment per `kind` (note/tip/warning/important/caution), matches existing `quote` visual pattern |
| `src/components/blocks/Toggle.tsx` | New | Renders `{t:"toggle", summary, blocks}` as native `<details>/<summary>` JSX elements (not raw HTML string injection) |
| `src/components/blocks/Columns.tsx` | New | Renders `{t:"columns", columns: Block[][]}` as a CSS grid, no JS |
| `src/components/blocks/DiagramBlock.tsx` | Modify | Dispatch by language family; lazy-load a Graphviz WASM compiler alongside the existing Mermaid path, same `next/dynamic(ssr:false)` pattern |
| `src/lib/svg-sanitize.ts` | New | Strips `<script>`, `on*` attributes, and `<foreignObject>` from any diagram-compiler SVG output before `innerHTML` assignment — closes the one real new attack surface this RFC introduces (see Risks) |
| `package.json` | Modify | Add `remark-directive`; add a Graphviz-in-WASM package (name TBD, see Open Questions) |

### Data Model Changes

```ts
// src/lib/blocks.ts — additions to the Block union
| { t: "callout"; kind: "note"|"tip"|"warning"|"important"|"caution"; blocks: Block[] }
| { t: "toggle"; summary: string; blocks: Block[] }
| { t: "columns"; columns: Block[][] }  // fixed 2-4 columns, validated at parse time
```
No changes to `PublishedDoc`, `DocSettings`, or `ListItem`. `BLOCKS.version` (`src/lib/constants.ts:47`) is not bumped — this is additive, schema-on-read, consistent with the existing `ListItem` legacy-shape precedent. Old documents contain none of these `t` values and are unaffected.

### API / Interface Changes

None to the public contract shape (`POST /api/publish` still accepts `{ blocks, settings?, raw? }`). The only change is a new **server-side validation step** (Phase 1, see Risks #4) rejecting payloads whose `blocks` don't match the (now-expanded) schema — currently no such validation exists at all.

### Infrastructure Changes

None. Every new capability renders client-side via the existing `next/dynamic(ssr:false)` lazy-load pattern; no new server, no new outbound network call reachable from the publish path, no change to the MongoDB schema beyond new fields inside the existing `blocks` JSON blob.

## 🔀 Alternatives Considered

| Option | Description | Pros | Cons | Verdict |
|---|---|---|---|---|
| **Raw HTML at parity with Markdown** | Accept and render arbitrary user HTML (the original proposal) | Matches Thariq's argument literally; zero new syntax to learn | Reopens XSS/phishing surface on an anonymous, unauthenticated, rate-limit-only publish flow; requires either a permanent sanitizer arms race or a rendering-architecture rewrite; contradicts brand identity | **Rejected** (prior turn) |
| **MDX/JSX authoring** | Let users write React components inline (Mintlify/Docusaurus model) | Very expressive; large existing ecosystem | Requires a build/compile step per document — incompatible with Readable's zero-build, instant-publish, client-side-editor model; still permits arbitrary script execution once a component can accept props/children generically | **Rejected** — same attack surface as raw HTML, worse fit for the architecture |
| **Server-side diagram rendering (Kroki-style)** | Single hosted service converts ~25 diagram languages to SVG/PNG | Broad language coverage with minimal client bundle cost | Anonymous rate-limited publish flow would be making outbound calls to a third-party (or self-hosted) service per publish — SSRF/availability/DoS surface (the codebase already treats this class of risk seriously: `src/lib/ssrf-guard.ts` exists specifically to guard outbound fetches elsewhere) | **Rejected** for the diagram feature specifically |
| **Do nothing — stay flat-Markdown-only** | Decline to build any of this | Zero engineering cost, zero new risk, zero brand dilution | Cedes long-form review-document use cases to competitors if the underlying pattern (AI-generated docs needing structure) turns out to be real and durable, not a fad; leaves zero response to a legitimate (if narrow and unvalidated) signal | **Considered, not chosen** — but noted as the only zero-risk option; if Phase 1/2 adoption data comes back near-zero, reverting to this is the fallback, not a failure |
| **New Markdown-native block types (this RFC)** | Callouts, toggles, columns, additional static-SVG diagrams — all parsed into the existing typed `Block` AST | Delivers the ~40% of Thariq's use cases that are genuinely about documents, not apps; zero new script-execution surface; reuses proven prior art and Readable's existing extension pattern (`DIAGRAM_LANGS`) | New syntax to learn; `remark-directive`'s underlying spec isn't yet a ratified CommonMark standard; adoption is unvalidated | **Chosen** |

## ⚖️ Tradeoffs

- **Unvalidated demand.** This entire effort is a response to one external essay and viral debate, not to a Readable user request, support ticket, or churn signal. We are explicitly building ahead of evidence. Mitigation is structural, not rhetorical: Phase 2 (callouts) is the cheapest possible test of real demand before Phases 3-4 (directive containers, diagram compiler) commit more engineering time, and Phase 5 is not committed at all.
- **New syntax burden.** `:::toggle[...]` / `:::columns` are not muscle-memory the way `**bold**` is, and are Readable-specific conventions (directive syntax is real prior art, but exact directive *names* are not standardized anywhere). Authors coming from GitHub/Obsidian will recognize `> [!NOTE]` immediately; they will not recognize `:::toggle`.
- **Bundle size.** A second diagram compiler (Graphviz-in-WASM) adds client bundle weight. Mitigated by the same lazy-load pattern already used for Mermaid/KaTeX/highlight.js, but not eliminated — first paint of a page containing a Graphviz diagram will fetch a new WASM asset.
- **A second SVG-injection trust boundary.** Mermaid's `securityLevel: "strict"` (`DiagramBlock.tsx:38`) already establishes that diagram-source-to-SVG-to-`innerHTML` is a trust boundary Readable manages, not avoids. Adding a second compiler multiplies this boundary rather than eliminating it — accepted, but only with an explicit sanitization step (Phase 4, Risk #3) rather than assuming the new library is safe by default.

## 😱 Risks

| Risk | Likelihood | Impact | Score | Mitigation | Owner |
|---|---|---|---|---|---|
| New diagram compiler's SVG output permits embedded `<script>`/event-handler content (e.g. Graphviz DOT supports HTML-like labels that can carry arbitrary markup) | Med | High | **6 — Priority** | `src/lib/svg-sanitize.ts` strips `<script>`, `on*` attributes, `<foreignObject>` from compiler output before `innerHTML` assignment, mirroring the guarantee `securityLevel:"strict"` gives Mermaid today; add a unit test fixture using an HTML-label DOT injection attempt and assert the sanitized output contains none of the above | Implementer, Phase 4 |
| TOC/anchor recursion isn't extended for new container block kinds — headings inside a callout/toggle/columns render fine but silently vanish from the sidebar TOC | Med | Med | **4 — Mitigate** | Generalize `toc.ts`'s `walk()` to recurse into a named set of "container" kinds instead of hardcoding `quote`; add a regression test asserting a heading nested inside each new container kind appears in `buildToc()` output | Implementer, Phase 1/3 |
| No server-side validation of `Block` shape exists today; expanding the union without adding validation risks persisting malformed/unexpected shapes that later crash the renderer for viewers | Low–Med | Med | **4 — Mitigate** | Add a minimal Zod discriminated-union schema (`src/lib/block-schema.ts`) validating `POST /api/publish` payloads in Phase 1, before any new `Block` kinds are introduced | Implementer, Phase 1 |
| Near-zero real-world adoption of the new syntax (the "unvalidated demand" tradeoff materializes) | Med | Med | **4 — Mitigate** | Instrument block-kind usage on publish (lightweight counter alongside `recordPublishEvent`); ship the zero-dependency callout syntax first specifically to get a cheap read on demand before Phase 3/4 spend | Product, ongoing from Phase 2 |
| `remark-directive`'s underlying "generic directive" syntax proposal is not a ratified CommonMark/GFM standard and could evolve or fragment industry-wide | High | Low | **3 — Mitigate** | Readable owns its own parser and renderer end-to-end (not dependent on external spec compliance for interop); document `:::toggle` / `:::columns` as Readable's own contract, independent of upstream proposal changes | Implementer, Phase 3 |
| Bundle-size/perf regression from the added WASM diagram library | Med | Low | **2 — Note** | Follow the existing `next/dynamic(ssr:false)` lazy-load precedent (no impact on pages without a diagram block); measure bundle diff before merging Phase 4 | Implementer, Phase 4 |

## 🔗 Dependencies

- **Upstream**: none — this builds entirely on existing `src/lib/parse.ts` / `src/lib/blocks.ts` / `src/components/blocks/*` infrastructure.
- **Downstream**: MCP server / CLI / GitHub Action / VS Code extension (all consume `packages/shared`'s `/api/v1` contract) are unaffected — no API shape change, only new valid `Block.t` values that older clients simply won't generate.
- **External**: `remark-directive` (new npm dependency, license/maintenance check required before Phase 3 — see Open Questions); a Graphviz-in-WASM package, name TBD (see Open Questions).

## 📅 Phases & Milestones

### Phase 1: Foundation (~1w)
**Goal**: De-risk the two cross-cutting gaps (TOC recursion, missing payload validation) before any new user-facing syntax ships, so later phases are additive only.
**Deliverable**: `toc.ts` generalized to recurse into a named container-kind set; `src/lib/block-schema.ts` Zod schema validating publish payloads; both merged and deployed with zero user-visible change.
**Tasks**:
- [ ] Refactor `toc.ts`'s `walk()` to recurse into any block kind present in a `CONTAINER_KINDS` set (starting with just `"quote"`, identical behavior to today) rather than a hardcoded `if (b.t === "quote")` check — AC: existing TOC output is byte-identical for all current fixtures; a new unit test in `tests/unit/toc.spec.ts` asserts this
- [ ] Add `src/lib/block-schema.ts` with a Zod discriminated union matching the current `Block` type exactly (no new kinds yet) — AC: a fixture payload with an invalid/unknown block shape is rejected by `POST /api/publish` with a 400, and all existing valid payloads still succeed
- [ ] Wire schema validation into `src/app/api/publish/route.ts` after the existing size/length checks — AC: `curl`-ing a malformed `blocks` array returns 400, not 500 or silent acceptance
**Exit criteria**: Full existing test suite green; no behavior change observable to any current user; both new files have unit test coverage.

### Phase 2: Callouts (~4d)
**Goal**: Ship the cheapest possible new block type to get a real read on demand before committing to directive-based containers.
**Deliverable**: `> [!NOTE|TIP|WARNING|IMPORTANT|CAUTION]` blockquote syntax renders as a styled callout on published pages.
**Tasks**:
- [ ] Add `{t:"callout", kind, blocks}` to the `Block` union and `block-schema.ts` (`src/lib/blocks.ts`) — AC: type-checks, schema accepts all 5 kinds and rejects a 6th
- [ ] Detect the `[!KIND]` marker on a blockquote's first line in `parse.ts`'s `"blockquote"` case, falling back to plain `{t:"quote",...}` for anything that doesn't match — AC: unit test table covering all 5 kinds, case-insensitivity, and a fallback case (`> [!bogus]` renders as a normal quote)
- [ ] Build `src/components/blocks/Callout.tsx` (icon + left-border color per kind, matching the existing `quote` visual language at `BlockRenderer.tsx:218-240`) and wire the `"callout"` case into `BlockRenderer.tsx` — AC: all 5 kinds render distinctly in both light and dark theme
- [ ] Add `"callout"` to `toc.ts`'s `CONTAINER_KINDS` — AC: a heading nested inside a callout appears in the sidebar TOC (regression test from Phase 1)
- [ ] Add a lightweight publish-time counter for block-kind usage (near `recordPublishEvent`, `src/app/api/publish/route.ts:93`) — AC: a published doc containing a callout increments a `callout` counter, queryable for the Phase 3 go/no-go decision
**Exit criteria**: A user can type `> [!NOTE]\nSome text` in the editor, see it render as a callout in live preview, publish it, and see it render identically on the public page; zero change to any document that doesn't use the new syntax.

### Phase 3: Toggle & Columns (~1.5w)
**Goal**: Deliver progressive disclosure and side-by-side comparison — the two most-cited static use cases from Thariq's examples beyond what callouts cover.
**Deliverable**: `:::toggle[Summary]` ... `:::` and `:::columns` ... `:::` directive syntax, rendering as native `<details>` and CSS grid respectively.
**Tasks**:
- [ ] Add `remark-directive` dependency; verify license (MIT expected) and maintenance status — AC: `package.json` updated, `npm ls remark-directive` resolves cleanly, no peer-dependency conflicts with `unified@11`
- [ ] Add `containerDirective` handling in `parse.ts` for `name === "toggle"` and `name === "columns"`, emitting `{t:"toggle", summary, blocks}` / `{t:"columns", columns}` respectively; any other/unrecognized directive name falls through to being dropped (matching today's `default: break` behavior for unknown node types) — AC: unit tests for both directives, plus an unrecognized-directive-name fallback test
- [ ] Build `src/components/blocks/Toggle.tsx` (native `<details>/<summary>` JSX — never HTML-string injection) and `src/components/blocks/Columns.tsx` (CSS grid, 2-4 columns, single-column stack on mobile) — AC: both render correctly at 3 breakpoints (mobile/tablet/desktop) in both themes
- [ ] Wire both into `BlockRenderer.tsx` and `toc.ts`'s `CONTAINER_KINDS` — AC: a heading nested inside a toggle inside a columns block (arbitrary nesting) still appears correctly in the sidebar TOC with a correct anchor
- [ ] Extend the Phase 2 usage counter to cover `toggle` and `columns` — AC: queryable alongside callout data
**Exit criteria**: Both directive types render correctly under arbitrary nesting (a toggle inside a callout, a callout inside a column); all Phase 1/2 regression tests still pass; no existing document's rendering changes.

### Phase 4: Additional Diagram Language (~1w)
**Goal**: Extend diagram support beyond Mermaid using the existing `DIAGRAM_LANGS` dispatch pattern, without any server-side rendering dependency.
**Deliverable**: `dot`/`graphviz`-fenced code blocks render as sanitized static SVG.
**Tasks**:
- [ ] Spike and select a specific Graphviz-in-WASM package (see Open Questions) — AC: a short written comparison (bundle size, last-publish date, browser compat) checked into the PR description
- [ ] Add a `graphviz`/`dot` language family to the diagram dispatch in `parse.ts`/`blocks.ts` (new set, or extend `DIAGRAM_LANGS`) — AC: a `dot`-fenced block produces `{t:"diagram", lang:"dot", code}` exactly as Mermaid does today
- [ ] Extend `DiagramBlock.tsx` to dispatch by language family (Mermaid path unchanged; new lazy-loaded Graphviz path follows the identical `next/dynamic(ssr:false)` pattern) — AC: a page with only Mermaid diagrams shows no change in bundle size
- [ ] Implement `src/lib/svg-sanitize.ts` and apply it to the Graphviz compiler's SVG output before `innerHTML` assignment — AC: a DOT source using an HTML-like label containing `<script>`/`onclick` produces sanitized SVG with none of it present (Risk #1's test)
**Exit criteria**: `dot`-fenced blocks render correctly; the injection test passes; bundle-size diff for pages without a `dot` block is zero; no new outbound network call exists anywhere in the new code path (verified by code review — grep the new files for `fetch`/`http`).

### Phase 5: Stat/Dashboard Blocks — Deferred, Not Committed
**Goal (if pursued)**: Cover the remaining static use case (KPI tiles, progress/status indicators) from Thariq's examples.
**Why not committed now**: Unlike callouts/toggles/columns/diagrams, no Markdown-native syntax convention exists anywhere in the ecosystem for this — it would be greenfield syntax design, not adoption of proven prior art, which is a materially higher-risk bet layered on top of an already-unvalidated-demand feature.
**Gate to proceed**: Only if Phases 2-4's usage counters show real adoption (proposed default threshold: >5% of new publishes in a rolling 30-day window use at least one of callout/toggle/columns/new-diagram) — see Open Questions for who owns finalizing this number.

## 🧪 Testing Strategy

- **Unit tests** (`tests/unit/`, Playwright-based per existing convention — see `tests/unit/slug.spec.ts`, `tests/unit/ssrf-guard.spec.ts` for style):
  - `tests/unit/parse-blocks.spec.ts` (new): callout marker detection (all 5 kinds, case-insensitivity, fallback-to-quote for unrecognized markers), directive parsing for `toggle`/`columns` (including unrecognized-directive fallback and arbitrary nesting), existing block-type parsing regression coverage
  - `tests/unit/toc.spec.ts` (new): generalized container recursion — heading inside `quote` (regression), `callout`, `toggle`, `columns`, and a heading nested through two levels of mixed containers
  - `tests/unit/svg-sanitize.spec.ts` (new): the HTML-label DOT injection fixture from Risk #1 — asserts no `<script>`, `on*`, or `<foreignObject>` survives sanitization
  - `tests/unit/block-schema.spec.ts` (new): valid payloads for every `Block` kind pass; a malformed/unknown-shape payload is rejected
- **Integration tests**: extend `tests/e2e/happy-paths.spec.ts` with a publish flow using one document containing at least one of each new block type (callout, toggle, columns, new diagram), asserting the published page renders all of them and the sidebar TOC includes headings nested inside each
- **Regression check**: `tests/e2e/console-errors.spec.ts` must stay green against the new fixture document (no console errors/warnings from the new renderer components); full existing test suite (`npm run test:unit`, `npm run test`) must pass unchanged
- **Manual verification**: visual QA of all new block types in light/dark theme and serif/sans typeface modes (`DocSettings.typeface`, matching `BlockRenderer.tsx`'s existing `isSerifMode` treatment) at mobile/tablet/desktop breakpoints
- **Security-specific**: confirm via code search that no new file introduces `dangerouslySetInnerHTML` on user-supplied content, and that the Graphviz SVG path only calls `innerHTML` on sanitizer output, never on raw compiler output directly

## ⚙️ Operations

- **Observability**: lightweight block-kind usage counters added alongside the existing `recordPublishEvent` call (`src/app/api/publish/route.ts:93`) — no new metrics infrastructure, reuses the existing event-recording path
- **Alerts**: none new — errors in the new parser/renderer paths surface through the existing `logError` pattern already used throughout `route.ts`
- **Runbook**: none new — no new operational service or infrastructure introduced
- **On-call implications**: none — no new failure mode requires paging; worst case for a bad diagram/directive parse is `default: return null` (nothing renders for that block), consistent with existing behavior for any malformed block

## ❓ Open Questions

- [ ] Which Graphviz-in-WASM package to adopt (candidates include `@viz-js/viz`; needs a bundle-size/maintenance spike) — owner: implementer, target resolution: start of Phase 4
- [ ] Should editor-UI affordances (toolbar buttons/insert menu for the new syntax) be built alongside Phases 2-3, or deferred as a fast-follow? Syntax-only shipping is faster but risks under-measuring true demand if users never discover the feature exists — owner: product, target resolution: before Phase 2 starts
- [ ] What adoption threshold should gate Phase 5 — the RFC proposes 5% of new publishes over a rolling 30-day window as a starting default, but this is a product call, not an engineering one — owner: product, target resolution: before Phase 4 completes
- [ ] Is `remark-directive`'s current license/maintenance status acceptable for a production dependency — owner: implementer, target resolution: start of Phase 3

## 🗂 Appendix

- Thariq Shihipar, "The Unreasonable Effectiveness of HTML" (personal site, May 2026) — 20 examples inspected directly; 8 static / 12 interactive split; taxonomy: Exploration & Planning, Code Review & Understanding, Design, Prototyping, Illustrations & Diagrams, Decks, Research & Learning, Reports, Custom Editing Interfaces
- Hacker News discussion of the above — top objections: co-authoring/diffability loss, token cost, security surface, accessibility, and a widely-endorsed capability breakdown (Markdown already covers tables/SVG/code/images; cannot do CSS-driven design data or JS-driven interaction/canvas even with inline-HTML extensions)
- Prior art surveyed: GitHub Alerts / Obsidian Callouts (blockquote-marker convention), Docusaurus Admonitions / Astro Starlight Asides (`remark-directive`-based triple-colon containers), MkDocs Material's `???` foldable admonition (closest non-HTML toggle precedent), VitePress/MkDocs tab conventions, Pandoc's unified diagram-filter approach (Mermaid/Graphviz/PlantUML/D2 via fenced code blocks)
- Prior RFC/turn: raw-HTML-at-parity proposal, rejected on security (anonymous unauthenticated publish flow) and brand-identity grounds — this RFC is the scoped-down follow-up
