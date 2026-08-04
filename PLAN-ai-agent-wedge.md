# Plan: Reposition around the AI-agent/CI-publishing wedge
> Status: IMPLEMENTED (2026-08-04) — commits 0529884, 16a8a1e, 7526692 on main. Phases 1-4
> executed as planned, with two adjustments made during Phase 5 review: the hero secondary CTA
> links to the on-page #api section instead of /mcp-setup (the original destination didn't cover
> the CI half of its own claim), and getPagesByUser caps query/tag at 200 chars (not scoped in
> the original plan, added for consistency with this codebase's other input-size guards).
> Scale: Standard
> Estimated effort: ~3 days equivalent
> Created: 2026-08-04
> Author: AshwinSathian (via Claude)

## Goal

When this is done: (1) the homepage, `PRODUCT.md`, `README.md`, `/mcp-setup`, and
`packages/cli/README.md` all lead with "your AI assistant or CI pipeline publishes
living docs" as the primary framing, with the existing human-share flow kept as a
full supporting section rather than deleted; (2) an agent or CI job can find an
existing page by title/tag through the REST API, the CLI, and the MCP server
(`list_pages`/`booklet pages list` accept an optional query/tag filter) instead of
only ever listing everything; (3) two launch-readiness documents exist
(`docs/launch/mcp-directory-submissions.md`, `docs/launch/show-hn-draft.md`) with
concrete, ready-to-use content the founder can act on without further drafting;
and (4) the full test/lint/build/typecheck suite across all four workspaces (root,
`packages/cli`, `packages/shared`, `mcp-server`) stays green throughout.

## Background

This follows a research phase (three independent lenses — engineering, hands-on
product usage, and market/TAM) that converged on: Booklet is well-built but has
never had its distribution tested (zero registered users, 91 anonymous pages ever,
no launch attempted in ~6 months of solo engineering), the "Markdown → shareable
link" niche alone has no standalone commercial precedent, and the most credible
wedge for a solo, no-budget maintainer is the CLI+REST API+GitHub Action+MCP-server
bundle already built around the publishing core — positioned as "your AI assistant
or CI pipeline maintains and publishes your docs," not "paste Markdown for a
human reader" (today's actual homepage headline).

Since that research, in separate sessions, all 7 concrete bugs found during the
product-usage audit were fixed and verified (typecheck, 288/288 unit tests, lint,
and `next build` all independently re-verified clean as of this plan, plus
`packages/cli` and `mcp-server` build/typecheck clean as separate workspaces), and
substantial infrastructure work landed: the MCP server was migrated to the
official `@modelcontextprotocol/sdk` with Zod schemas, resources, and prompts; the
CLI gained OS-keychain credential storage, shell completion, and OIDC-based
Trusted Publishing; and the GitHub Action was extracted to its own public repo
(`AshwinSathian/publish-to-booklet`), no longer part of this monorepo. Critically,
the fix restoring `Reactions`/`ShareButtons` for anonymous pages
(`src/app/p/[id]/page.tsx`, commit `73f73c5`) is a precondition for this plan: it's
the only virality loop in the product, and a launch driving anonymous publishes
(the likely outcome) would otherwise be tested with that loop silently disabled.

This plan covers the remaining, not-yet-done items from the "reposition around the
wedge" list: positioning/messaging, one genuine product gap (agents can't find an
existing page without listing everything), and launch-readiness materials.
Measurement does not need new work — `src/app/admin/page.tsx` +
`src/lib/db/admin-metrics.ts` already break down weekly publishes by source
(`cli`/`github-action`/`vscode`/`mcp`/`api`/`browser`, via
`src/lib/request-source.ts`), which is exactly what's needed to see whether a
launch actually moves agent/CI-driven publish volume.

## Non-Goals

- **Not implementing `search_drafts`/`get_draft`/`list_backlinks` as scoped in
  `PLAN-obsidian-parity.md` Milestone 4.** Drafts never leave the browser —
  `PRODUCT.md`: "Drafts are 100% private until publish... never transmitted to any
  server" — and MCP tools run server-side with no access to a user's
  `localStorage`. Building this as literally scoped would require either a new
  drafts-sync mechanism (an Epic-scale change, effectively Milestone 6's
  local-first sync pulled forward) or silently breaking the stated privacy
  guarantee. This plan substitutes search/filter over the user's *published*
  pages instead (Phase 1) — real, server-side data that solves the actual
  underlying need (an agent finding the right existing doc to update).
- **Not touching `AshwinSathian/publish-to-booklet`** (the extracted GitHub Action
  repo) — not available in this working directory; its own README/positioning is
  follow-up work in a separate session against that repo.
- **Not building new measurement/analytics infrastructure** — the admin dashboard
  already covers this; Phase 4 only confirms it's sufficient for a launch window,
  it doesn't add to it.
- **Not executing the launch** — posting to Show HN/Reddit/Product Hunt and
  submitting to MCP directories (mcp.so, Smithery, glama.ai, `awesome-mcp-servers`)
  are manual actions requiring the founder's own accounts and judgment on timing.
  This plan produces ready-to-use drafts, not the act of publishing them.
- **Not a visual/brand redesign** — copy and information-architecture changes
  only, reusing existing components (`Landing.tsx`'s `ApiBlock`, `Section`,
  `PrimaryButton`, etc.) and design tokens as-is.
- **Not changing auth, pricing, or quota logic** — out of scope for a positioning
  and discoverability change.

## Technical Design

### Overview

Four workstreams, in dependency order:

```
Phase 1 (product gap)        Phase 2/3 (positioning copy)      Phase 4 (launch docs)
──────────────────────       ─────────────────────────────      ──────────────────────
getPagesByUser(query,tag)    mcp-setup: why + 5 prompt templates docs/launch/*.md
  → /api/v1/pages ?q=&tag=   CLI README: lead with CI wedge      (written LAST, quotes
  → shared client            Landing.tsx hero/subtitle/eyebrow    the finalized copy
  → mcp-server list_pages    page.tsx JSON-LD                     from Phase 2/3)
  → CLI `pages list`         PRODUCT.md one-sentence version
                              README.md hero tightening
        │                              │                                │
        └──────────────┬───────────────┘                                │
                        ▼                                                ▼
              Phase 5: verify (full suite, 4 workspaces) → review → commit → push
```

### Key Components

| Component | File / Path | Change Type | Notes |
|-----------|-------------|--------------|-------|
| Page listing query | `src/lib/db/index.ts` (`getPagesByUser`) | Modify | Add optional `query` (case-insensitive substring on `title`) and `tag` (exact match on `frontmatter_meta.tags`) filter params |
| REST API | `src/app/api/v1/pages/route.ts` | Modify | Accept optional `?q=` / `?tag=`, pass through to `getPagesByUser` |
| Shared client | `packages/shared/src/client.ts` (`listPages`) | Modify | Accept optional `query`/`tag` params, serialize to query string |
| MCP schema | `mcp-server/src/schemas.ts` (`ListPagesInputSchema`) | Modify | Add optional `query`/`tag` fields with `.describe()` text an LLM can act on |
| MCP tool | `mcp-server/src/tools.ts` (`handleListPages`) | Modify | Pass `query`/`tag` through; result header notes the active filter so the agent knows it's not seeing everything |
| CLI | `packages/cli/src/commands/pages.ts` | Modify | `booklet pages list --query <text> --tag <tag>`, same flags pattern as existing `--json` |
| MCP setup page | `src/app/mcp-setup/page.tsx` | Modify | New "why publish from your AI assistant" section before the per-client setup steps; surface the 5 existing `mcp-server/src/prompts.ts` templates (`incident_report`, `adr`, `release_notes`, `rfc`, `runbook`) with example prompts |
| CLI docs | `packages/cli/README.md` | Modify | Lead with the CI-publishing use case; feature the GitHub Actions example already in the main `README.md` |
| Homepage copy | `src/components/marketing/Landing.tsx` | Modify | Rewrite eyebrow/subtitle; add a secondary CTA row under the fold ("or let your agent publish it"); `ApiBlock` section (already CI/agent-adjacent) gets a stronger lead-in |
| Homepage SEO | `src/app/page.tsx` (JSON-LD) | Modify | `featureList`/`description` gain agent/CI-publishing entries, additive not replacing |
| Product doc | `PRODUCT.md` | Modify | One-sentence version + a new, earlier section on publishing from AI assistants/CI |
| README | `README.md` | Modify | Tighten/reorder the existing hero paragraph (already names the CLI/API/MCP bundle — this is a sharpening pass, not a rewrite) |
| Launch prep | `docs/launch/mcp-directory-submissions.md` | New | Ready-to-submit blurbs for mcp.so, Smithery, glama.ai, and an `awesome-mcp-servers` PR entry |
| Launch prep | `docs/launch/show-hn-draft.md` | New | Drafted Show HN post + a success-bar framework (placeholders for the founder's own numbers) |

### Data Model Changes

None. `frontmatter_meta.tags` already exists on `DbPage` (`src/lib/db/types.ts`) and
is already populated from YAML frontmatter (`src/lib/frontmatter.ts`); this plan
only adds a read-path filter over an existing field.

### API / Interface Changes

`GET /api/v1/pages` gains two optional, backward-compatible query params: `q`
(string, matched case-insensitively as a substring against `title`) and `tag`
(string, exact match against any entry in `frontmatter_meta.tags`). Omitting both
preserves today's exact behavior byte-for-byte — every existing caller (My Pages
dashboard, current CLI `pages list`, current MCP `list_pages` calls) is
unaffected.

### Key Decisions

1. **Search over published pages, not drafts.** Rationale: drafts are
   architecturally client-only (see Non-Goals); published pages already live
   server-side in the `pages` collection and solve the same underlying need —
   letting an agent find "my release notes page" without listing everything.
   Alternative considered: implement `search_drafts` by having the client upload
   drafts to a new server-side index — rejected, it silently breaks
   `PRODUCT.md`'s stated privacy guarantee for a feature nobody asked to have that
   guarantee weakened for.
2. **Homepage keeps the human-share narrative as a full section, not a deleted
   one.** Rationale: the market research found the *niche* (markdown → shareable
   link, standalone) has no commercial precedent — it did not find that the
   underlying paste→publish mechanic is worthless. Every page still works exactly
   the same way regardless of which story leads. Repositioning is about emphasis
   and what's above the fold, not removing working, tested copy
   (`ProblemMock`, the alternatives-callout grid, `ApiBlock`).
3. **Launch materials are drafts, not automated submissions.** Rationale: mcp.so,
   Smithery, and glama.ai require manual web-form or human-reviewed-PR submission
   (no stable API to script against), and a Show HN post gets exactly one first
   impression — timing and final wording are the founder's call, not something to
   automate away.

## Alternatives Considered

| Option | Pros | Cons | Why Rejected |
|--------|------|------|--------------|
| Build `search_drafts`/`get_draft`/`list_backlinks` exactly as `PLAN-obsidian-parity.md` Milestone 4 scoped it | Matches an existing roadmap doc, no new design needed | Requires drafts to reach the server, contradicting the "100% private until publish" guarantee `PRODUCT.md` makes explicitly | Architecturally incompatible with a documented product guarantee |
| Full homepage redesign from scratch | Clean slate, no legacy constraints | Discards validated, working sections (`ProblemMock`, alternatives grid, `ApiBlock`) that don't need to change for a positioning shift | Unnecessary cost/risk for a copy change, not a redesign |
| Script automated submission to MCP directories via their APIs | Faster, no manual work | mcp.so/Smithery/glama.ai submission is manual web-form or human-reviewed-PR, not a stable API; scripting a workaround risks looking spammy and getting rejected | Not technically reliable, and the wrong step to automate regardless |

## Work Breakdown

### Phase 1: Server-side page search/filter (~0.5d)
- [ ] `getPagesByUser` accepts optional `query`/`tag`, applies a case-insensitive
      regex on `title` and an exact match on `frontmatter_meta.tags` — AC: unit
      test covers query match, tag match, combined query+tag, no match, and
      confirms omitting both returns identical results to today's behavior.
- [ ] `/api/v1/pages` GET parses `?q=`/`?tag=`, ignores empty/whitespace-only
      values — AC: route-level test (or extension of existing API tests) covers
      a request with both params, one param, neither param, and an empty-string
      param behaving as "no filter."
- [ ] `packages/shared`'s `listPages()` accepts `{ query?, tag? }` and serializes
      them into the querystring — AC: typecheck passes; a unit test (or the
      existing shared-client test pattern) confirms the querystring is built
      correctly for all four param combinations.
- [ ] `mcp-server`'s `ListPagesInputSchema` gains optional `query`/`tag` with
      `.describe()` text; `handleListPages` passes them through and prefixes the
      result with the active filter (e.g. "Pages matching "release notes":") —
      AC: `mcp-server` typecheck passes; a unit test confirms the filter-active
      header only appears when a filter was supplied.
- [ ] `booklet pages list` gains `--query <text>`/`--tag <tag>` flags, same
      option pattern as the existing `--json` — AC: `packages/cli` typecheck and
      build pass; `--help` output shows the new flags.

### Phase 2: MCP setup page & CLI README repositioning (~0.5d)
- [ ] `/mcp-setup` gains a "why publish from your AI assistant" section above the
      per-client setup steps, surfacing the 5 existing prompt templates
      (`incident_report`, `adr`, `release_notes`, `rfc`, `runbook`) with one
      example natural-language prompt each — AC: page renders with no console
      errors (verified via Playwright), all 5 templates are visible without
      needing to expand anything.
- [ ] `packages/cli/README.md`'s top section leads with the CI-publishing use
      case and links to the GitHub Actions example — AC: the first two
      paragraphs after the title mention CI/automation before the `npm install`
      instructions.

### Phase 3: Homepage & core docs repositioning (~1d)
- [ ] `Landing.tsx` hero eyebrow/subtitle rewritten to foreground the agent/CI
      angle; a secondary CTA row added under the primary "Open the editor" CTA
      (e.g. "or publish straight from Claude →" linking to `/mcp-setup`) — AC:
      headline (`"Written in Markdown. Read by everyone else."`) is unchanged per
      Key Decision 2; existing "Open the editor" primary CTA and its
      `trackEvent("open_editor_clicked", ...)` call are unchanged; page renders
      with no console errors, no layout shift beyond the added row (verified via
      Playwright).
- [ ] `src/app/page.tsx`'s JSON-LD `featureList` gains agent/CI-publishing
      entries (additive) — AC: `next build` succeeds, structured data still
      validates as well-formed JSON-LD (no removed fields, only added ones).
- [ ] `PRODUCT.md`'s one-sentence version updated; a new section on
      publishing from AI assistants/CI added ahead of the existing "The Editor"
      section — AC: existing sections (Editor, Publishing, Page Lifespan, etc.)
      remain unchanged in content, only reordered/prefixed.
- [ ] `README.md`'s hero paragraph tightened to lead with the automation angle
      — AC: the existing feature bullet list and Quick Start section are
      unchanged; only the opening 1-2 paragraphs are rewritten.

### Phase 4: Launch-readiness materials (~0.5d)
- [ ] `docs/launch/mcp-directory-submissions.md` written with ready-to-paste
      descriptions for mcp.so, Smithery, glama.ai, and an `awesome-mcp-servers`
      PR entry, each tailored to that listing's actual format (checked against
      each site's current submission guidelines) — AC: file exists, each of the
      4 entries has a title, one-line description, and longer blurb ready to
      paste with no further editing needed.
- [ ] `docs/launch/show-hn-draft.md` written with a full drafted post and a
      success-bar framework — AC: file exists with a complete title + body draft
      referencing the finalized Phase 2/3 copy, plus an explicit "define before
      launching" table with placeholder rows for sign-ups/organic publishes/
      observation window that the founder fills in with real numbers before
      posting.

### Phase 5: Verify, review, commit, push (~0.5d)
- [ ] Full regression pass — AC: `npm run test` (typecheck), `npm run lint`,
      `npx playwright test --config=playwright.unit.config.ts` (all existing +
      new unit tests), and `npm run build` all exit 0 from repo root; `npm run
      typecheck`/`build` also exit 0 in `packages/cli`, `packages/shared`, and
      `mcp-server` individually.
- [ ] Manual smoke test — AC: dev server run locally, homepage and `/mcp-setup`
      visually confirmed via Playwright with no console errors; `GET
      /api/v1/pages?q=...` hit directly with a real API key and confirmed to
      return a filtered result matching an actual page title.
- [ ] Self/tool-assisted code review pass against the full diff — AC: findings
      addressed or explicitly deferred with reasoning noted in the commit
      message, same bar as the existing bug-fix commits on this branch.
- [ ] Commit(s) created with clear, scoped messages (positioning changes and the
      search-filter feature as separate commits, consistent with this repo's
      existing commit granularity) — AC: `git log` shows the new commits;
      `git status` is clean.
- [ ] Push to `origin/main` — AC: `git push` succeeds; confirmed with the user
      before running, since this is a shared, externally-visible action.

## Milestones

| Milestone | Deliverable | Acceptance Criteria | Estimate |
|-----------|-------------|----------------------|----------|
| M1: Search works everywhere | `?q=`/`?tag=` live in REST API, shared client, MCP tool, CLI | An agent can call `list_pages` with a query and get back only matching pages; `booklet pages list --query x` works from a terminal | Phase 1 complete |
| M2: Setup surfaces are convincing | `/mcp-setup` and CLI README both explain *why*, not just *how* | A first-time reader of either page understands the agent/CI use case without visiting the homepage first | Phase 2 complete |
| M3: Homepage leads with the wedge | Homepage, `PRODUCT.md`, `README.md` all foreground automation | Eyebrow/subtitle/secondary-CTA changes live; JSON-LD updated; docs updated | Phase 3 complete |
| M4: Launch is one decision away | Two launch docs exist, ready to act on | Founder can post/submit without drafting anything further, only filling in the success-bar numbers | Phase 4 complete |
| M5: Shipped | Everything merged to `main`, verified green | All Phase 5 ACs met | Phase 5 complete |

## Testing Strategy

- **Unit tests**: `getPagesByUser` filter logic (query/tag/combined/none/no-match)
  in a new or extended `tests/unit/` spec; MCP `handleListPages` filter-header
  behavior in `mcp-server`'s own test setup (mirroring the existing
  `mcp-slug.spec.ts`/`mcp-origin.spec.ts` pattern); CLI flag parsing covered by
  existing `cli-config.spec.ts`-style conventions if the `pages` command has
  precedent, otherwise a smoke-level check that `--help` lists the new flags.
- **Integration tests**: none new required — no new cross-service flow is
  introduced; the search feature reuses the existing auth/rate-limit path in
  `/api/v1/pages`.
- **Manual verification**: Playwright-driven check of the homepage and
  `/mcp-setup` (visual + console-error check); a real `curl`/`fetch` against
  `/api/v1/pages?q=` with a seeded API key against local Mongo, confirming the
  filter actually narrows results.
- **Regression check**: all 288 existing unit tests, the existing e2e suite
  (`tests/e2e/happy-paths.spec.ts`, `tests/e2e/console-errors.spec.ts`,
  `tests/e2e/wikilink-autocomplete.spec.ts`), and `npm run lint` / `npm run test`
  (typecheck) / `npm run build` must all stay green exactly as verified before
  this plan was written.

## Risks & Mitigations

| Risk | Likelihood | Impact | Score | Mitigation |
|------|------------|--------|-------|------------|
| Homepage rewrite regresses the existing (small but real) human-share audience's experience or SEO | Med | Med | 4 | Keep the human-share section intact per Key Decision 2; only add/reorder, never remove the primary CTA or existing JSON-LD fields; verify via Playwright before commit |
| Query/tag filtering touches the shared pages-list path used by My Pages dashboard, REST API, CLI, and MCP — a mistake could break an existing integration | Low | High | 3 | Purely additive optional params; default (no filter) is byte-identical to current behavior; regression-tested before/after against the full existing suite |
| Launch materials (Phase 4) go stale or misquote copy if written before Phase 2/3 land | Low | Low | 1 | Sequenced last in the Work Breakdown specifically to quote finalized copy |

## Dependencies

- **Internal**: `src/app/admin/page.tsx` + `src/lib/db/admin-metrics.ts` (reused
  as-is for post-launch measurement, not modified this plan); `mcp-server/src/prompts.ts`'s
  5 existing templates (surfaced, not modified); `src/lib/frontmatter.ts`'s
  existing `tags` field (read, not modified).
- **External**: none new — no new third-party libraries. MCP directory
  submissions (Phase 4 content only, not automated) depend on mcp.so's,
  Smithery's, and glama.ai's own manual/human-reviewed submission processes,
  which are outside this plan's control.
- **Blocked by**: none. All prerequisite bug fixes (notably the anonymous-page
  virality-loop restore, `73f73c5`) are already verified shipped on `main` as of
  this plan.

## Open Questions

- [ ] Should the homepage's visual headline itself (`"Written in Markdown. Read
      by everyone else."`) change, or stay as-is with only the eyebrow/subtitle/
      secondary-CTA changing? This plan defaults to **keeping the headline**
      (Phase 3, Key Decision 2) since replacing tested, working copy is a bigger
      bet than a positioning pass needs to make — confirm with the founder if a
      full headline replacement is actually wanted before Phase 3 starts.
- [ ] What are the real success-bar numbers (sign-ups, organic anonymous
      publishes, observation window) for the eventual launch? This is the
      founder's own risk tolerance, not something this plan can output —
      Phase 4 drafts the framework with placeholders, owner: founder, by: before
      the launch post is actually submitted.

## Follow-up Work (Out of Scope)

- Updating `AshwinSathian/publish-to-booklet`'s own README/positioning (separate
  repo, needs its own session).
- Actually executing the launch — posting the Show HN draft, submitting to MCP
  directories — once Phase 4's materials exist and the founder sets real numbers
  for the open success-bar question above.
- `PLAN-obsidian-parity.md` Milestone 6 (local-first File System Access sync) —
  the actual prerequisite if "search across drafts" (not just published pages)
  is wanted later; explicitly not pulled forward by this plan (see Non-Goals).
- Revisiting homepage copy again once real launch data exists, rather than
  guessing further in the absence of any traffic.
