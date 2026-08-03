# Booklet CLI hardening — design

**Date:** 2026-08-04
**Status:** Approved (see "Decisions" below — confirmed with user before planning)

## Problem

`packages/cli` (`booklet-cli`, published to npm as `booklet-cli@0.1.0`) is a Commander-based CLI
for publishing Markdown to Booklet. It's already well-built — browser OAuth-style login with CSRF
state, 0600/0700 file permissions on the config, `NO_COLOR` support, stdin/`-` support, watch
mode, JSON output for `pages list`, zero runtime deps via bundling — but an audit against current
CLI standards and an actual `npm pack` of the published tarball surfaced concrete gaps before the
next publish.

## Research grounding

Checked 2026-08-04:

- [clig.dev](https://clig.dev) (Command Line Interface Guidelines) — the canonical cross-vendor
  reference for help text, output formatting, errors, flags, interactivity, config precedence,
  environment variables, robustness, future-proofing, and secrets handling.
- Commander.js docs (Context7, `/tj/commander.js`) — `parseAsync` vs `parse` semantics,
  `exitOverride`/`program.error`, TypeScript patterns.
- npm 2025/2026 supply-chain standards: **Trusted Publishing** (OIDC, GA July 2025) removes
  long-lived `NPM_TOKEN` secrets and yields automatic provenance attestations; requires
  `permissions: id-token: write` in the workflow plus a one-time link on npmjs.com between the
  package and the publishing workflow.
- Credential storage: `keytar` (the historical Node keychain binding) is archived/deprecated.
  `@napi-rs/keyring` (Rust/napi, actively maintained, no `libsecret` requirement on Linux/WSL) is
  its recommended successor — confirmed via its own npm metadata, GitHub issues from Azure SDK/MSAL
  migrating off keytar to it, and the `cli/cli` (GitHub CLI) discussion on token storage, which
  converges on "OS keychain first, permissioned file as fallback" as the standard tiered approach.

## Findings (the actual audit)

**Real bugs:**
1. `packages/cli/src/commands/auth.ts:223` — `whoami`'s `fromEnv` check reads
   `process.env.READABLE_API_KEY`, a stale name from before the Readable→Booklet rename. The
   actual credential lookup (`config.ts`) correctly uses `BOOKLET_API_KEY`; only the *display*
   is wrong, so `whoami` always reports the config file as the source even when the env var is
   what's actually active.
2. `packages/cli/src/index.ts:19` — `program.parse(process.argv)` is used while every action
   handler is `async`. Commander does not await a sync `.parse()`'s async actions, so an error
   thrown after any `await` becomes an unhandled promise rejection: a raw Node stack trace to the
   user instead of the CLI's own `error()`/exit path.
3. `npm pack --dry-run --workspace packages/cli` (run for real, dist built) confirms the shipped
   tarball has no LICENSE file. `package.json` declares `"license": "MIT"`, but npm only
   auto-includes a LICENSE that lives in the *published package's own root* — `packages/cli/`
   has none; only the monorepo root does.

**Security / supply chain:**
4. `.github/workflows/publish-cli.yml` publishes with a long-lived `NPM_TOKEN` repo secret
   instead of Trusted Publishing.
5. No CHANGELOG for a package with real version history (0.1.0 → 0.1.5 pre-rename, per git log).

(A root `SECURITY.md` was found during implementation prep — it already covers `booklet-cli`
disclosure, so no `SECURITY.md` work is needed in this pass. Initial audit assumed it was
missing; corrected here before planning.)

**clig.dev conformance gaps:**
7. No shell completion generation (`booklet completion <shell>`) — standard on gh/vercel/stripe/aws.
8. `--json` exists only on `pages list`, not `whoami` or `pages open`.
9. Only the `NO_COLOR` env var is respected; no `--no-color` flag.
10. Top-level `--help` has no examples block or docs/support link.
11. No differentiated exit codes (everything is a bare `process.exit(1)`).

## Decisions (confirmed with user)

1. **Full pass** — fix the bugs, harden the publish pipeline, add the missing clig.dev-standard
   UX. Not a bugs-only patch.
2. **Add OS keychain support**, accepting that it breaks the CLI's current zero-runtime-dependency
   single-file bundle. `@napi-rs/keyring` becomes a real (external, not bundled) dependency.
   Explicit trade-off, not an oversight — documented in `tsup.config.ts` and the design here.
3. **Migrate to npm Trusted Publishing.** The workflow YAML change ships in this pass; the
   npmjs.com-side linking step is manual and only the repo owner can do it (no npm registry
   access from this environment). The workflow will not successfully publish until that link
   exists — treated as a known, communicated gap, not silently broken.

**Explicitly out of scope**, decided during design to avoid scope creep:
- Rewriting the command framework (Commander is fine; no reason to move to oclif/yargs).
- Update-notifier (adds a network call to every invocation for marginal benefit; `npm install -g`
  already handles updates; clig.dev itself is lukewarm on this pattern).
- Man pages (low value for an `npx`-first tool).
- Telemetry of any kind (would need an explicit opt-in consent flow per clig.dev; not requested).
- Multi-profile config support (today's single active credential per machine is unchanged).

## Architecture

### 1. Bug fixes
- `auth.ts` `whoami`: `process.env.READABLE_API_KEY` → `process.env.BOOKLET_API_KEY`.
- `index.ts`: `program.parse(process.argv)` → wrapped `parseAsync`, with a top-level catch that
  prints `✗ <message>` via the existing `fmt.ts` `error()` helper for anything Commander/the
  action handlers didn't already handle, plus a "please file a bug at <repo>/issues" pointer for
  errors that don't look like expected `BookletApiError`/validation failures, then
  `process.exit(1)`.
- `packages/cli/LICENSE`: copy of the root MIT license text into the package directory so it's
  included in the published tarball (npm auto-includes LICENSE files from a package's own root
  regardless of the `files` field).

### 2. Credential storage — keychain-first, file-fallback

New `packages/cli/src/keychain.ts`:
```ts
// Thin wrapper isolating the @napi-rs/keyring dependency so config.ts
// never has to know whether the keychain call succeeded or not.
export async function keychainGet(): Promise<string | null>
export async function keychainSet(key: string): Promise<boolean>   // false = unsupported, caller must fall back
export async function keychainDelete(): Promise<void>              // no-op if nothing stored/unsupported
```
Uses `AsyncEntry` from `@napi-rs/keyring` (service `booklet-cli`, account `default`). Every call
is wrapped in try/catch — any throw (no backend on headless Linux, `--omit=optional` install,
unsupported OS/arch, `NoEntry`) is treated as "unavailable," never propagated as a hard failure.
Reads get a short `AbortSignal.timeout` (a few seconds) so a wedged keyring daemon can't hang
every single command invocation; writes during explicit `login`/`logout` do not, since those may
need to wait on an OS-level permission prompt (e.g., macOS's one-time Keychain access dialog for
an unsigned binary — documented in the README).

`config.ts` becomes the single point of truth for credential precedence:
- `getApiKey()`: `BOOKLET_API_KEY` env → `keychainGet()` → legacy plaintext `apiKey` field in
  `~/.booklet/config.json` (migration path for anyone who logged in before this change, and the
  permanent path on platforms without a keychain backend).
- `setApiKey(key)`: try `keychainSet()`; on success, also strip any legacy plaintext `apiKey`
  field from the config file (migrate away from it). On failure, fall back to today's behavior —
  write it to the 0600 file.
- `clearApiKey()` (used by `logout`): best-effort `keychainDelete()` **and** strip the plaintext
  field if present, so logout is a full credential removal regardless of where it was stored.
- `apiBase` is not a secret and stays in the plaintext config file exactly as today.

`whoami` reports source as one of: `BOOKLET_API_KEY (env)` / `OS keychain` / `~/.booklet/config.json`
(the last one now implicitly means "legacy or no keychain backend detected").

Build/packaging: `tsup.config.ts`'s `noExternal` list drops `@napi-rs/keyring` (native bindings
cannot be bundled into one JS file) — it's marked external and becomes a real `dependencies` entry
in `package.json`, which pulls in the correct platform-specific optional package (`@napi-rs/keyring-*`)
the same way `esbuild`/`sharp` do. The tsup config's "zero runtime deps, single file" comment is
corrected to state the trade-off explicitly rather than left stale and wrong.

### 3. Publish pipeline & compliance
- `publish-cli.yml`: add `permissions: id-token: write`, remove the `NODE_AUTH_TOKEN` env and the
  `NPM_TOKEN` secret reference from the publish step (OIDC trusted publishing handles auth).
  Comment explaining the npmjs.com-side manual linking step and that publishes will fail until
  it's done.
- `packages/cli/CHANGELOG.md`, Keep-a-Changelog format, seeded with a `0.1.0` entry describing
  what shipped, ready for this pass's version bump to append to.

### 4. CLI UX conformance
- `pages open` and `whoami` gain `--json` (mirrors `pages list`'s existing flag and output shape:
  raw `JSON.stringify(..., null, 2)` to stdout, nothing else printed).
- Top-level `--no-color` flag on the `program`, consulted by `fmt.ts` alongside the existing
  `NO_COLOR` env var (either one disables ANSI output).
- `booklet completion <bash|zsh|fish>` command: hand-written completion scripts (no extra
  dependency) covering the top-level command/subcommand names and their flags — good enough for
  the CLI's actual surface (3 top-level commands, `pages` with 3 subcommands, ~15 flags total);
  a full dynamic completion engine would be over-engineering for this size of command tree.
- Top-level help gets an examples block (`program.addHelpText('after', ...)`) with 2-3 common
  invocations and a link to the GitHub repo, per clig.dev's "lead with examples, provide a support
  path" guidance.
- Exit codes: keep it to two — `1` for command/API failures (unchanged, already used everywhere),
  `2` for usage errors surfaced through the new top-level catch (mirrors the common Unix
  convention scripts already expect; not inventing a larger taxonomy nobody consumes).

## Testing

Follows the monorepo's existing convention: `tests/unit/*.spec.ts` run via the root
`playwright.unit.config.ts` (Playwright's test runner used as a plain Node/TS test runner — see
its own comment for why). No sibling package (`shared`, `vscode`, `github-action`) has its own
test setup; this pass doesn't introduce one for `cli` either.

New files:
- `tests/unit/cli-config.spec.ts` — credential precedence (env > keychain > file), the
  keychain-failure fallback path, the legacy-field migration/strip behavior, and `apiBase`
  handling. `@napi-rs/keyring` is mocked (via the `keychain.ts` wrapper's exported functions, or
  Node's module mocking) so these tests don't touch a real OS keychain and pass identically in
  CI/headless environments.
- `tests/unit/cli-fmt.spec.ts` — table rendering, `NO_COLOR`/`--no-color` suppressing ANSI codes.

CI: no new job. CLI unit tests fold into the existing `unit-tests` job in `ci.yml` (it already
runs `npm run test:unit` against `tests/unit/**`); `typecheck-packages` already typechecks
`packages/cli` per-package.

## Rollout

Version bump (`packages/cli/package.json`) to reflect this pass once implemented — actual number
decided at implementation time following semver (this is bug fixes + backward-compatible
additions + one dependency-model change, i.e. a minor bump, not a major one — no existing flag,
command, or output shape is removed or changed incompatibly). The `publish-cli.yml` trigger
(`paths: packages/cli/package.json`) means bumping it is what actually fires the publish once
merged to `main` — left to the user to confirm before that push, since it's a real, externally
visible npm release.
