# Changelog

All notable changes to the Booklet VS Code extension are documented here.

## [Unreleased]

- Renamed from Readable to Booklet (package, commands, config namespace,
  secret-storage key) ahead of the extension's first Marketplace publish —
  no external users were on the old identifiers yet.

## [0.2.0] — 2026-07-11

- First public Marketplace release.
- Rebranded to the new Readable mark and metadata (icon, description,
  keywords, repository link).
- API keys now stored in VS Code's secret storage (OS keychain) instead of
  plaintext `settings.json`. The `readable.apiKey` setting is gone — use
  **Set API Key**.
- Moved `readable-api-client` to a runtime dependency (previously
  listed as dev-only despite being bundled into the shipped extension).

## [0.1.0] — 2026-05-24

- Initial release: `Readable: Publish Current File`, `Readable: Publish
  Selection`, `Readable: Set API Key`.
- Configurable API base URL and default page visibility.
