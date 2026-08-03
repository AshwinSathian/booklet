# Publish-to-Booklet GitHub Action — extraction, hardening, and Marketplace launch

**Date:** 2026-08-04
**Status:** Approved (confirmed with user before planning)

## Problem

`packages/github-action` (`Publish to Booklet`) is a working TypeScript action — reads a Markdown
file, publishes/updates it via `booklet-api-client`, sets `id`/`url` outputs — bundled with `tsup`
to a committed `dist/main.js`, gated by CI's `github-action-dist-check` job. It has never been
tagged or released. The goal is to take it to GitHub Marketplace at a "top-shelf" bar: current
runtime, real versioning, and security hardening in line with what the best first-party and
third-party actions do in 2026 — and to fix the security/hygiene gaps that research surfaced across
the rest of the monorepo's workflows along the way.

## Research grounding

Checked 2026-08-04, via two parallel research passes (official GitHub docs, live `action.yml`s of
`actions/checkout`/`setup-node`/`upload-artifact`/`github-script`/`docker build-push-action`,
`actions/toolkit`, `actions/javascript-action` template, GitHub Changelog, zizmor/Scorecard docs,
npm docs, StepSecurity/OpenSSF material):

- **Marketplace requires `action.yml` at repo root** — a subdirectory action
  (docs.github.com/actions/creating-actions/publishing-actions-in-github-marketplace) is not
  listed, though it remains consumable via `owner/repo/path@ref`. This is the forcing function for
  extracting the action out of the `booklet` monorepo.
- **`runs.using: node20` is already behind current practice.** Per GitHub's Sept 2025 changelog
  (updated May 2026), hosted runners default to Node 24 from June 16, 2026, and Node 20 is removed
  entirely by fall 2026. `checkout`, `setup-node`, `upload-artifact`, `github-script`, and
  `docker/build-push-action` all currently declare `node24` on `main`.
- **Versioning convention**: precise semver tag (`v1.0.0`) plus a force-moved major tag (`v1`),
  per `actions/toolkit`'s `action-versioning.md` and GitHub's own
  "Releasing and maintaining actions" doc. **Immutable Releases** went GA Oct 28, 2025 — cut
  semver tags as immutable releases; keep the moving `vN` tag as a plain mutable tag (not itself
  wrapped in an immutable release), which GitHub's docs and community tagging write-ups confirm is
  the current resolution between the two mechanisms (they're complementary, not conflicting).
- **Security hardening for GitHub Actions**
  (docs.github.com/actions/security-guides/security-hardening-for-github-actions): SHA-pin every
  consumed action ("currently the only way to use an action as an immutable release"), default
  `permissions` to least privilege at workflow level with per-job escalation, never interpolate
  `${{ github.event.* }}` directly into `run:` (pass via `env:` instead).
- **zizmor** (docs.zizmor.sh) and **OpenSSF Scorecard** (scorecard.dev) are the current standard
  static-analysis/health-signal tools for GitHub Actions workflows — both cheap to run as a CI job
  for a solo-maintained repo, both flag unpinned `uses:`, excessive permissions, and dangerous
  trigger patterns.
- **npm Trusted Publishing (OIDC)** went GA July 31, 2025 (npm ≥11.5.1, Node ≥22.14.0) — removes
  the long-lived `NPM_TOKEN`/`NODE_AUTH_TOKEN` secret and yields automatic provenance. Configured
  per-package on npmjs.com (org/repo/workflow filename); cannot be scripted from inside the repo.
- **VS Code Marketplace / `VSCE_PAT`**: Azure DevOps retires classic org-scoped PATs Dec 1, 2026.
  `vsce`'s Azure-OIDC alternative (`--azure-credential`, `@vscode/vsce` ≥3.9.2) exists but is
  documented for Azure Pipelines + managed identity, not GitHub Actions individual publishers —
  treated as a flagged follow-up, not implemented in this pass.
- **Dependabot** supports a `github-actions` ecosystem that resolves and updates SHA pins together
  with their version comment (`directory: "/"`, grouping supported).

## Decisions (confirmed with user)

1. **Extract the action to a new standalone public repo, `AshwinSathian/publish-to-booklet`**,
   rather than keeping it in the monorepo subfolder (which would forgo a real Marketplace listing).
2. **Harden every workflow in the `booklet` monorepo**, not just the action's own — SHA-pinning,
   `permissions:` blocks, and related hygiene extend to `ci.yml`, `publish-cli.yml`,
   `publish-shared.yml`, `publish-vscode.yml`, and `.github/examples/publish-to-booklet.yml`.
3. **New repo name**: `publish-to-booklet`.
4. **npm OIDC rollout**: implement the workflow-side change (`id-token: write`, Node/npm version
   bump) and keep `NPM_TOKEN`/`NODE_AUTH_TOKEN` wired as-is as a fallback; deleting the token secret
   is a deliberate follow-up once the user confirms Trusted Publisher is configured on npmjs.com and
   a real publish uses OIDC.

## Design

### 1. New repo: `publish-to-booklet`

Self-contained — depends on `booklet-api-client` as an ordinary **npm registry dependency**
(already published via `publish-shared.yml`), not a workspace link. This removes any sync
relationship to the monorepo entirely; the new repo is simply the sole source of truth going
forward.

```
action.yml                  # at repo root — Marketplace requirement
src/main.ts                  # same logic as current packages/github-action/src/main.ts
dist/main.js                  # tsup CJS bundle, committed
__tests__/main.test.ts        # node:test unit tests
package.json / tsconfig.json / tsup.config.ts
README.md                      # usage, inputs/outputs, badges
LICENSE                          # MIT, copied from booklet
SECURITY.md                       # same disclosure policy/address as booklet
.gitignore
.github/workflows/
  ci.yml                          # lint/typecheck/test + check-dist (rebuild, diff, fail if stale)
  release.yml                      # on version bump to main: tag, GitHub Release, move v1
  scorecard.yml                     # OpenSSF Scorecard
  zizmor.yml                         # static analysis of this repo's own workflows → SARIF
.github/dependabot.yml               # github-actions ecosystem, weekly, grouped
```

`runs.using: "node24"`. `branding` keeps `icon: upload-cloud`, `color: blue` (both valid — not in
the excluded Feather subset).

Tests: the monorepo currently has no unit tests for `cli`/`shared` either, so this isn't filling a
convention gap — it's a deliberate step up because this package now ships externally. Using
built-in `node:test` (no new dependency, no existing test-runner convention to inherit for a repo
this small): invalid-`visibility` rejection, missing-file handling, publish-vs-update branching on
`page-id`, and the success path against a mocked `booklet-api-client`.

### 2. Versioning & release

- First release **`v1.0.0`**, cut as an immutable GitHub Release.
- Plain mutable **`v1`** tag, force-moved to the latest `v1.x.y` commit on every release —
  scripted directly in `release.yml` (mirrors the existing `publish-cli.yml`/`publish-shared.yml`
  "detect version bump on push to main" pattern already used in this codebase, rather than pulling
  in a third-party retag action).
- Listing the action on the Marketplace itself (category selection, Developer Agreement) is a
  one-time step in GitHub's release-creation web UI that cannot be scripted — left for the user
  after the repo and first release exist.

### 3. New repo's own workflow hardening

Every `uses:` SHA-pinned with a version comment. `permissions: {}` at workflow level, `contents:
read` for CI, `contents: write` only on the release job, `security-events: write` only on the
zizmor SARIF-upload step. `timeout-minutes` on every job. `concurrency` + `cancel-in-progress: true`
on `ci.yml` only — never on `release.yml`.

### 4. Monorepo changes (`booklet`)

- Delete `packages/github-action/` entirely.
- `ci.yml`: drop `github-action` from the `typecheck-packages` matrix; delete the
  `github-action-dist-check` job.
- `.gitignore`: remove the `packages/github-action/dist/` exception.
- `README.md`: point the GitHub Actions section and repo tree at
  `AshwinSathian/publish-to-booklet` instead of `packages/github-action/`.
- `.github/examples/publish-to-booklet.yml` currently demonstrates the **CLI**
  (`npx booklet-cli publish`), not the Action. Add a second example showing real Action usage
  (`uses: AshwinSathian/publish-to-booklet@v1`).

### 5. Repo-wide hardening (`booklet`'s existing workflows)

Applied to `ci.yml`, `publish-cli.yml`, `publish-shared.yml`, `publish-vscode.yml`:

- SHA-pin every `uses:` with a version comment.
- Explicit `permissions:` blocks (workflow-level restrictive default, per-job escalation).
- `timeout-minutes` on every job.
- Add `.github/dependabot.yml` (`github-actions` ecosystem, weekly, grouped).
- Add `scorecard.yml` and a `zizmor.yml` job to `booklet` itself.
- `publish-cli.yml` / `publish-shared.yml`: add `permissions: id-token: write`, bump the Node
  version used in those jobs to 22+ (npm ≥11.5.1 needed for Trusted Publishing), leave
  `NPM_TOKEN`/`NODE_AUTH_TOKEN` wired unchanged as fallback. Comment explaining the token can be
  deleted once Trusted Publisher is confirmed active on npmjs.com.
- `publish-vscode.yml`: same pinning/permissions/timeout hardening; leave a comment flagging the
  Dec 1, 2026 Azure classic-PAT retirement as a distinct follow-up (Azure OIDC support for GitHub
  Actions individual publishers is not yet mature enough to implement now).

### 6. Explicitly out of scope

- GitHub's Verified Creator badge (org-level, requires `partnerships@github.com`).
- `actions/publish-action`'s approval-gated major-tag mover — scripting the retag directly instead,
  consistent with this codebase's existing publish-workflow style.
- VSCE Azure OIDC migration (flagged only).
- Full removal of `NPM_TOKEN` (deliberately deferred to a user-triggered follow-up).

## Testing / verification

- New repo: `npm run typecheck`, `npm run build` (tsup), `node --test __tests__/`, `check-dist`
  passes (no diff after rebuild), zizmor and Scorecard workflows both green on first push.
- Monorepo: `npm run lint`, `npm run test` (root typecheck), `npm run typecheck --workspace
  <package>` for every remaining package, full `ci.yml` job set green, confirm
  `github-action-dist-check` job and matrix entry are actually gone (not just skipped).
- Manual/documented (not scriptable): configure Trusted Publisher on npmjs.com for `booklet-cli`
  and `booklet-api-client`; complete the Marketplace listing step on `publish-to-booklet`'s first
  release.
