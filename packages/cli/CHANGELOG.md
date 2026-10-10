# Changelog

All notable changes to `booklet-cli` are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [2.1.0] - 2026-10-10

### Added
- `booklet publish --space <slug>` publishes into a team space, and `--visibility team` restricts
  the page to that space's members.
- `booklet pages list --type <type>` and `--space <slug>`. With `--space` the list is every page
  in the space, not only yours. The table has a Type column.
- `booklet new` templates start with frontmatter (`type`, `status`, `date`, `owners`), which
  Booklet shows in the page's header strip.

### Changed
- `booklet pull` output includes the page's frontmatter (the server now keeps it).

## [2.0.0] - 2026-10-10

### Changed
- **Breaking:** requires Node.js 22 or later (was 18). Node 18 and 20 have reached end of life.
- **Breaking:** exit codes now say why a command failed: 2 usage error, 3 not authenticated or not
  allowed, 4 page not found, 5 rate limited. 1 is every other failure. Before, every failure was 1.
- **Breaking:** `pages delete` without `--yes` outside a terminal exits with code 2. It used to
  print "Aborted." and exit 0, which a script could not tell from a delete.
- **Breaking:** a new page is unlisted unless you pass `--visibility public` (the server default
  changed in Booklet 1.1.0).
- `--json` is a global option and works on every command, `publish` included. With it, errors are
  one JSON object on stderr.
- `pages list` returns every page. It used to stop at the first 20.
- `pages open` and `pages delete` find a page by ID or slug with one request instead of listing
  pages first, so they work for accounts with more than 20 pages.

### Added
- `booklet pull <id>` downloads a page's Markdown to stdout or `-o <file>`.
- `booklet new <template>` writes a starting document: `incident`, `adr`, `rfc`, `runbook` or
  `release-notes`.
- A 429 response is retried once after the server's `Retry-After`.
- `BOOKLET_NO_KEYCHAIN=1` keeps the key in the config file instead of the OS keychain.
- Exit codes are listed in `booklet --help`.

### Fixed
- `publish --visibility public` now sets the page public. Since new pages became unlisted by
  default on the server, 1.0.2 skipped the visibility update and published unlisted.

## [1.0.0] - 2026-08-04

No functional changes from 0.2.0 — version bump to mark general availability. Publishes via
npm Trusted Publishing (OIDC), verified working as of this release.

## [0.2.0] - 2026-08-04

### Added
- OS keychain credential storage (macOS Keychain, Windows Credential Manager, Linux Secret
  Service via `@napi-rs/keyring`), with automatic fallback to the existing 0600 config file when
  no keychain backend is available. Existing plaintext keys are migrated into the keychain
  automatically once available.
- `--json` on `whoami` and `pages open` (previously only `pages list` supported it).
- Top-level `--no-color` flag, in addition to the existing `NO_COLOR` env var.
- `booklet completion <bash|zsh|fish>` — prints a shell completion script.
- Examples and a docs link in top-level `--help`.

### Fixed
- `whoami` now correctly reports `BOOKLET_API_KEY (env)` as the credential source when the env
  var is set — it previously checked a stale pre-rename variable name and always reported the
  config file instead.
- Errors thrown inside async command handlers now go through the CLI's own error output and exit
  cleanly, instead of surfacing as an unhandled promise rejection with a raw Node stack trace.
- The published npm package now includes its own `LICENSE` file.

### Changed
- CI now publishes to npm via Trusted Publishing (OIDC) instead of a long-lived `NPM_TOKEN`
  secret, with automatic provenance attestations.
- `@napi-rs/keyring` is now a real (non-bundled) dependency, needed for OS keychain support —
  the CLI is no longer a literal zero-runtime-dependency package, though it remains a single JS
  entrypoint plus one native addon.

## [0.1.0] - 2026-07-28

Initial release as `booklet-cli` (renamed from `readable-cli`): browser-based login, `publish`
(including stdin and `--watch`), `pages list`/`open`/`delete`, `whoami`/`logout`.
