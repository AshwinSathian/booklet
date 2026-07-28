# RFC: Closing the Obsidian Gap
> Status: Milestone 1 (private wiki-links + backlinks + graph view) IMPLEMENTED. Milestones 2–6 are roadmap, not yet built.
> Scale: Epic (multi-milestone)
> Created: 2026-07-28
> Author: Ashwin Sathian (via Claude)
> Design doc: `docs/superpowers/specs/2026-07-28-obsidian-parity-design.md`

---

## 🎯 Goals

**Problem statement.** Booklet is a Markdown-to-shareable-page *publishing* tool: paste →
live preview → publish an immutable, read-only, link-only page (`PRODUCT.md`). It has no
notion of a personal knowledge base — no linking between documents, no search, no
organization beyond a flat, single-level Collection. Obsidian and its 2026 peers (Logseq,
Tana, Reflect) own exactly that "second brain" space, and their growth over the last two
years has been driven substantially by AI layered on top of a vault (Smart Connections,
Copilot for Obsidian). The ask: close as much of that gap as makes sense **without**
changing what Booklet's published page is or does, and without taking on commitments (a
plugin-execution sandbox, paid AI inference, real-time collaboration) that don't fit a
free, single-maintainer, self-hosted product.

**What success looks like for Milestone 1:**
- A user can write `[[Another Draft]]` in any draft and get a working private cross-reference
  to another one of their own drafts, resolved by title, entirely client-side.
- The referenced draft shows a "Linked mentions" (backlinks) panel listing everything that
  references it.
- A private graph view visualizes the link structure across a user's own drafts.
- None of this is visible in, or changes the storage shape of, a published page. Published
  pages remain byte-for-byte the same contract as before this change.

## 📘 Background — competitive research summary

- **Obsidian**: local-first vault, `[[wikilinks]]` + backlinks pane + graph view as the core
  loop; ~2,000+ community plugins; "Bases" (2025) turns note collections into filterable
  database views off frontmatter properties; AI arrives almost entirely via community plugins
  (Smart Connections — vault-wide embedding search; Copilot — chat with your vault).
- **Logseq**: same local-first/linking philosophy, outliner-first.
- **Tana**: "supertags" (typed structured blocks), AI meeting capture, agent-queryable second
  brain.
- **Reflect**: AI-native journaling/meeting notes, calendar-connected, GPT-4o/Claude/Gemini
  backends.
- **Notion**: workspace-aware AI agents (Feb 2026), block/database model, collaborative.
- **Craft / Bear**: Apple-native polish, block editor (Craft) or minimalist plain Markdown
  (Bear); neither has backlinks/graph.

Sources referenced during research: techtippr.com/best-obsidian-plugins-ai,
community.obsidian.md/plugins/smart-connections, tana.inc/blog/best-second-brain-apps-2026,
alternativeto.net coverage of Obsidian 1.9.0's Bases plugin, community.obsidian.md/plugins/canvas-bases.

**Codebase audit** (see design doc for full detail): drafts (`src/lib/drafts/`) are a flat,
non-relational `localStorage` blob with no search; the parser (`src/lib/parse.ts`,
`src/lib/blocks.ts`) is a typed `Block[]`/`Inline[]` AST with clear precedent for adding new
inline/block kinds (footnote references, `> [!NOTE]` callouts); cross-page references are
completely greenfield — no `[[`, no backlink, no graph concept anywhere in the codebase.

## 🔭 Non-Goals (permanent boundaries, not phase deferrals)

- No change to the published-page contract: still immutable, no WYSIWYG, no real-time
  collaboration, no public search/directory. Enforced mechanically in Milestone 1 by
  stripping wikilinks to plain text before any publish/patch route stores `blocks`.
- No third-party plugin execution sandbox — a hosted multi-tenant app cannot safely run
  arbitrary community JS the way a local Electron app can.
- No Booklet-subsidized AI inference — any future AI feature is BYOK only.
- No public link graph or public search — every new organizational feature here is private to
  the account/browser.

## 🏗 Milestone 1 — Private wiki-links, backlinks, graph view (this change)

### System diagram

```
Editor raw markdown (draft, localStorage)
        │
        ▼
parseToBlocks()  [src/lib/parse.ts]
        │  inlineFromNodes(): after mergeAdjacentText, run
        │  splitWikilinksInInlines() over merged "text" runs
        │  → new Inline variant: {t:"wikilink", target, label?}
        ▼
Block[] (live preview only — never the stored/published shape)
        │
        ├──► BlockRenderer → InlineRenderer          (editor live preview)
        │        renders a resolved/unresolved pill,
        │        resolution against the local draft title index
        │
        └──► [on publish/patch, 4 routes] stripWikilinksFromBlocks()
                 → wikilink inlines become plain {t:"text", v: label ?? target}
                 → validateBlocks() / storage never see a "wikilink" node
                 → published page contract: UNCHANGED

Backlinks index (src/lib/wikilinks/index.ts, client-only):
  for each local draft: parse its raw → collect wikilink targets
  → reverse map target-title(lowercased) → referencing draft ids
  recomputed on demand (Drafts list is small; no persistent index needed for v1)

Graph view: force-directed layout over the same link index, opened as a dialog from the editor.
```

### Component inventory

| Component | New / Modified | Notes |
|---|---|---|
| `src/lib/blocks.ts` | Modify | Add `{ t: "wikilink"; target: string; label?: string }` to `Inline` union |
| `src/lib/parse.ts` | Modify | `splitWikilinksInInlines()` regex post-process, called at the end of `inlineFromNodes()` |
| `src/lib/wikilinks/` | New | `parse.ts` (regex + split/strip helpers), `index.ts` (backlink index over local drafts), `resolve.ts` (title matching) |
| `src/app/api/publish/route.ts`, `.../publish/[id]/route.ts`, `.../v1/publish/route.ts`, `.../v1/pages/[id]/route.ts` | Modify | Wrap `parseToBlocks(...)` with `stripWikilinksFromBlocks(...)` before `validateBlocks` |
| `src/lib/export/html.ts` | Modify | Add explicit `"wikilink"` render case (plain text) for the editor's live "Copy as HTML" path |
| `src/components/blocks/InlineRenderer.tsx` | Modify | Add `"wikilink"` case: resolved/unresolved pill, optional click-to-navigate |
| `src/components/blocks/BlockRenderer.tsx`, `Callout.tsx`, `Toggle.tsx`, `Columns.tsx` | Modify | Thread an optional `wikilinkCtx` prop through every recursive call site (same pattern as existing `headingAnchors`) |
| `src/components/app/PasteInput.tsx` | Modify | `[[` triggers a fuzzy draft-title autocomplete popup, positioned via caret-coordinate math (no editor-engine change) |
| `src/components/app/BacklinksPanel.tsx` | New | Lists drafts that reference the active draft |
| `src/components/app/GraphView.tsx` | New | Dialog with a small dependency-free force-directed layout over the link index |
| `src/app/app/AppClient.tsx` | Modify | Wire backlinks panel + graph view + wikilink resolver/navigate into the existing draft-switching flow (`onSwitchDraft`) |

### Why this doesn't drift

The load-bearing decision is **where stripping happens**: every code path that persists
`Block[]` server-side (all four publish/patch routes) strips wikilinks to plain text before
`validateBlocks()` ever sees them. `block-schema.ts`'s `InlineSchema` is deliberately **not**
updated to accept `"wikilink"` — so if the strip step were ever skipped by mistake, publish
would fail loudly (500, "please report this") rather than silently leaking the private-linking
concept into a public page. This makes the anti-drift property mechanically enforced, not
just documented.

### Testing

- Unit tests for `splitWikilinksInInlines` (plain target, piped label, unmatched brackets,
  adjacent wikilinks, wikilink inside emphasis/strong).
- Unit tests for `stripWikilinksFromBlocks` (heading, paragraph, list item + nested children,
  table cell, quote/callout/toggle/columns, footnotes — every container kind).
- Unit tests for the backlink index (resolves by exact title match case-insensitively, ignores
  self-references correctly, handles renamed/deleted drafts gracefully).
- Existing parser/renderer/publish-route test suites must continue to pass unmodified in
  behavior for documents with no `[[`.

### Rollout

No data migration: `wikilink` is a new, additive `Inline` variant; every existing draft/page
with no `[[` in it parses identically to before. No feature flag needed — the syntax is
inert (renders as literal bracket text) unless a user opts in by typing it.

## 🔭 Roadmap (Milestones 2–6, not built in this change)

2. **Editor polish** — CodeMirror 6 migration (replaces the plain `<textarea>`), opt-in Live
   Preview (marks hide off-cursor, default OFF), a real command palette, a quick-switcher.
   Deliberately sequenced after Milestone 1 so the linking/autocomplete interaction model is
   validated against the cheaper textarea-based implementation first.
3. **Organization** — nested folders (Collections currently flat/single-level), a tags editor
   UI (tags today only exist if hand-typed into YAML frontmatter), lexical (BM25-style) search
   across drafts and pages.
4. **AI-native layer** — extend the existing first-party MCP server (`mcp-server/`, currently
   `publish/update/list/delete` only) with `search_drafts`/`get_draft`/`list_backlinks` tools;
   an in-app BYOK panel unlocking an "ask your drafts" chat and semantic search.
5. **Structured views & theming** — a Bases-style sortable/filterable table view over a
   Collection, driven by existing `frontmatter_meta`; custom CSS snippets; expanded template
   gallery.
6. **Local-first storage** — File System Access API opt-in "sync this browser's drafts to a
   folder on disk" (Chromium-only; `localStorage` stays the universal fallback).

Each future milestone gets its own design pass before implementation — this document records
the sequencing rationale, not a commitment to build them on any particular schedule.
