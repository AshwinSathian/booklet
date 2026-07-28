# Closing the Obsidian gap — design

> Status: approved. Implementation tracked in `PLAN-obsidian-parity.md`.

## Why this exists

Booklet's own positioning docs (`PRODUCT.md`, `docs/BOOKLET_TEXTBOOK.md`) describe it as a
Markdown-to-shareable-page **publishing** tool: paste → live preview → publish an immutable,
read-only, link-only page. It is explicitly *not* a personal-knowledge-management vault —
`PRODUCT.md`'s "What Booklet Does Not Do" table rules out real-time collaboration, editing
after publish, rich-text/WYSIWYG, and search/directory as intentional anti-goals.

Obsidian is a different species of product: a local-first, continuously-editable vault of
interlinked Markdown files, with bidirectional links, a graph view, ~2,000+ community plugins,
and (since 2025) a first-party "Bases" database layer. Its 2026 growth was driven largely by
AI plugins (Smart Connections' embedding search, Copilot's vault-chat) layered on that vault.

Direct feature-for-feature parity is not coherent with Booklet's identity or its
single-maintainer, self-hosted, "free forever" constraints. The part of the gap that *is*
closeable without touching the published-page contract is the **pre-publish drafting layer**
— entirely local/private, and (per the codebase audit below) completely greenfield today.

## Non-negotiable constraints (carried into every phase)

- The published-page contract does not change: still immutable, still no WYSIWYG, still no
  real-time collaboration, still no public search/directory.
- No third-party plugin execution sandbox (arbitrary code execution in a hosted multi-tenant
  app is a security/maintenance burden out of scope for a single-maintainer product).
- No paid AI inference subsidized by Booklet — any AI feature is BYOK (bring your own key),
  consistent with the current "free forever, no paid plans" direction.
- All new linking/search/graph features are private to the account (or to the local browser,
  for anonymous users) — never public discovery.

## Codebase audit findings (as of 2026-07-28)

- **Drafts** (`src/lib/drafts/`): `DraftDoc` (`types.ts`) has no `tags`, no `collectionId`, no
  relational field of any kind. Stored as one JSON blob in `localStorage`
  (`booklet:draftsDb`). No search/filter capability anywhere (`DraftsDialog.tsx` lists every
  draft, unfiltered).
- **Editor** (`src/components/app/PasteInput.tsx`): a plain `<textarea>`. No source-side
  syntax highlighting. The formatting toolbar and find/replace both operate directly on
  `HTMLTextAreaElement.selectionStart/selectionEnd`.
- **Parser** (`src/lib/parse.ts`, `src/lib/blocks.ts`): a `unified`/`remark` pipeline producing
  a custom, serializable `Block[]`/`Inline[]` AST — not raw mdast. New inline/block kinds are
  added by extending the discriminated unions plus a handful of well-known call sites
  (parser, `block-schema.ts`, `BlockRenderer.tsx`); there is precedent for exactly this in the
  footnote-reference and GitHub-style callout (`> [!NOTE]`) features.
- **Cross-page references**: confirmed entirely greenfield — no `[[`, no backlink concept, no
  page-graph anywhere in the parser, DB schema, or UI.
- **Search**: none exists anywhere (client or server) — any search is new work.

## What we're building now (Milestone 1 of the roadmap)

Private, vault-style wiki-links between a user's own drafts — the single highest-leverage,
lowest-drift item, confirmed in discussion. Scope:

1. **Syntax**: `[[Draft Title]]` and `[[Draft Title|Custom label]]`, detected via a
   regex post-process over merged text runs inside `inlineFromNodes` (the same style already
   used for the `> [!NOTE]` callout marker) — not a new remark plugin dependency.
2. **New `Inline` variant**: `{ t: "wikilink"; target: string; label?: string }` in
   `src/lib/blocks.ts`.
3. **Drafting-time only**: wikilinks are a live-preview/editor feature. At publish time,
   every one of the four publish/patch routes strips `wikilink` inlines down to plain text
   (`label ?? target`, no brackets, no link) before `validateBlocks`/storage — the published
   page's stored `Block[]` never contains a `wikilink` node, so the server-side schema
   (`block-schema.ts`) and the published-page contract are completely unchanged. This is the
   mechanism that keeps this feature from drifting into "public cross-page linking," which was
   explicitly out of scope.
4. **Resolution + backlinks**: computed entirely client-side over the local
   `localStorage` draft DB (title-based matching, like Obsidian resolves by filename) — works
   fully offline, for anonymous and signed-in users alike. A reverse index (backlinks) is
   derived from the same pass, shown in a new panel in the editor.
5. **Autocomplete**: typing `[[` in the editor opens a fuzzy picker over the user's own draft
   titles, using caret-position math against the existing textarea (no editor-engine swap —
   deferred, see below).
6. **Graph view**: a private, force-directed visualization of the wikilink index, scoped to
   one account/browser, opened from the editor.

## Deliberately deferred (future milestones, not this change)

- **CodeMirror 6 migration** + opt-in Live Preview (syntax marks hide off-cursor) — the
  highest-risk, highest-effort item (rewrites `FormatToolbar`/`FindReplaceBar`'s direct
  textarea DOM manipulation); belongs in its own reviewable change once wikilinks prove out
  the interaction model against the current textarea.
- Folders/nested Collections, a tags UI, and full-text search across drafts.
- The AI-native layer (MCP read/search tools, BYOK "ask your drafts" chat).
- Bases-style structured table views over Collections.
- File System Access API opt-in local-folder sync.

These remain on the roadmap in `PLAN-obsidian-parity.md` but are out of scope for this change.
