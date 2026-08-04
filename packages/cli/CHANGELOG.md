# Changelog

All notable changes to `booklet-cli` are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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
