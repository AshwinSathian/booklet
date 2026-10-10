# booklet-cli

[![npm version](https://img.shields.io/npm/v/booklet-cli)](https://www.npmjs.com/package/booklet-cli)
[![npm downloads](https://img.shields.io/npm/dw/booklet-cli)](https://www.npmjs.com/package/booklet-cli)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](https://github.com/AshwinSathian/booklet/blob/main/packages/cli/LICENSE)

Publish Markdown from your terminal, a CI pipeline, or a script — as [Booklet](https://booklet.ashwinsathian.com) pages
with a permanent, shareable URL.

Built for automation first: `--key`/`BOOKLET_API_KEY` for non-interactive auth, `--update <id>` to
republish in place instead of minting a new URL every run, `--json` on every command, and
[exit codes](#exit-codes) a script can branch on. The most common use is a CI job that keeps a changelog or release-notes page current —
see [CI / GitHub Actions](#ci--github-actions) below. It works the same way from a terminal, of
course; `booklet publish README.md` is still the whole command.

## Install

```bash
npm install -g booklet-cli
```

Or use without installing:

```bash
npx booklet-cli publish README.md
```

## Authentication

```bash
booklet login
```

This opens your browser to authorize the CLI. Sign in (or create an account) and you're done, no copy-pasting required. Your key is saved securely — see [Credential storage](#credential-storage) below for where.

**CI / non-interactive environments:** pass your key directly with `--key`:

```bash
booklet login --key bklt_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

You can also set it via environment variable, which takes precedence over the config file:

```bash
export BOOKLET_API_KEY=bklt_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Generate keys manually at [booklet.ashwinsathian.com](https://booklet.ashwinsathian.com) → My Pages → Settings → API Keys.

## Commands

### `booklet publish [file]`

Publish a Markdown file as a Booklet page.

```bash
booklet publish README.md
booklet publish NOTES.md --slug my-notes
booklet publish NOTES.md --visibility unlisted
booklet publish README.md --open          # opens the page in your browser
```

**Publish from stdin:**

```bash
cat CHANGELOG.md | booklet publish -
echo "# Hello world" | booklet publish -
```

**Update an existing page in-place:**

```bash
booklet publish README.md --update <page-id>
```

**Watch mode:** auto-republish on every save

```bash
booklet publish README.md --watch
booklet publish README.md --update <id> --watch
```

Options:

| Flag | Description |
|------|-------------|
| `--slug <slug>` | Set a custom URL slug (e.g. `my-readme`) |
| `--visibility <v>` | `unlisted` (default: reachable by link, not listed or indexed) or `public` (listed on Explore) |
| `--update <id>` | Update an existing page by ID |
| `--watch` | Watch file and re-publish on change |
| `--open` | Open the page in your browser after publishing |

---

### `booklet pull <id>`

Download a page's Markdown, by ID or slug. It goes to stdout unless you pass `-o`.

```bash
booklet pull abc123                  # prints the Markdown
booklet pull abc123 -o page.md       # writes it to a file
booklet pull my-custom-slug --json   # the page object, including `raw`
```

Edit the file and send it back with `booklet publish page.md --update abc123`.

### `booklet new <template>`

Write a starting document to `<template>.md` in the current directory. Templates: `incident`,
`adr`, `rfc`, `runbook`, `release-notes`. It does not need an API key.

```bash
booklet new adr                      # writes adr.md
booklet new incident -o 2026-10-outage.md
booklet publish adr.md
```

An existing file is left alone unless you pass `--force`.

### `booklet pages list`

List all your published pages. Useful in a script to find the right page ID before calling
`booklet publish --update <id>`, instead of hardcoding it.

```bash
booklet pages list
booklet pages list --json                 # machine-readable output
booklet pages list --query "release"      # only pages whose title contains this text
booklet pages list --tag runbook          # only pages with this exact frontmatter tag
```

### `booklet pages open <id>`

Open a page in your browser. Pass `--print` to print the URL without opening a browser, or
`--json` for the full page object.

```bash
booklet pages open abc123             # opens browser
booklet pages open abc123 --print     # prints URL only
booklet pages open abc123 --json      # prints the page object as JSON
booklet pages open my-custom-slug     # works with slugs too
```

### `booklet pages delete <id>`

Delete a page by ID or slug. Shows the page title and URL in the confirmation prompt.

```bash
booklet pages delete abc123
booklet pages delete abc123 --yes   # skip confirmation prompt
```

Outside a terminal (a script, a CI job) there is nobody to answer the prompt, so `--yes` is
required there; without it the command exits with code 2 and deletes nothing.

### `booklet whoami`

Show the active API key, base URL, and where the key was loaded from (env var, OS keychain, or
config file).

### `booklet logout`

Remove the saved API key from wherever it's stored (OS keychain and/or `~/.booklet/config.json`).

### Shell completion

```bash
# bash
booklet completion bash >> ~/.bash_completion

# zsh (add to a directory in your $fpath)
booklet completion zsh > "${fpath[1]}/_booklet"

# fish
booklet completion fish > ~/.config/fish/completions/booklet.fish
```

---

## Frontmatter support

YAML frontmatter in your Markdown is parsed and applied automatically:

```markdown
---
title: My Release Notes
slug: release-notes-v2
visibility: public
description: Summary of changes in v2.
author: Ashwin Sathian
date: 2026-05-24
---

# Release Notes v2

Content here…
```

Supported frontmatter fields:

| Field | Type | Notes |
|-------|------|-------|
| `title` | string | Overrides the extracted H1 title (max 200 chars) |
| `slug` | string | Custom URL slug (max 60 chars) |
| `visibility` | `"public"` \| `"unlisted"` | Defaults to unlisted |
| `description` | string | SEO meta description (max 300 chars) |
| `author` | string | Stored as metadata (max 100 chars) |
| `date` | string | Stored as metadata, any format |

---

## JSON output

Every command takes `--json`. The result is then one JSON value on stdout and nothing else, so it
can be piped straight into `jq`:

```bash
URL=$(booklet publish notes.md --json | jq -r .url)
```

| Command | JSON on stdout |
|---------|----------------|
| `publish` | `{ "id", "url", "updated" }` |
| `pull <id>` | the page, including `raw`; with `-o`: `{ "id", "url", "file" }` |
| `new <template>` | `{ "template", "file" }` |
| `pages list` | an array of pages |
| `pages open <id>` | the page (the browser is not opened) |
| `pages delete <id>` | `{ "deleted", "id" }` |
| `whoami` | `{ "authenticated", "key", "base", "source" }` |
| `login`, `logout` | `{ "authenticated", "base", "pages" }`, `{ "logged_out" }` |

On failure stdout stays empty and stderr gets `{ "error", "exit_code", "status" }`.

## Exit codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Failure: network error, server error, or a request the server rejected |
| 2 | Usage error: unknown command or option, missing argument |
| 3 | Not authenticated, or not allowed |
| 4 | Page not found |
| 5 | Rate limited |

When the API answers 429 the CLI waits for the server's `Retry-After` (up to 60 seconds) and tries
once more. Exit code 5 means the second attempt was limited too.

---

## Environment variables

| Variable | Description |
|----------|-------------|
| `BOOKLET_API_KEY` | API key, overrides `~/.booklet/config.json` |
| `BOOKLET_API_URL` | Override API base URL (default: production) |
| `BOOKLET_NO_KEYCHAIN` | Set to any value to skip the OS keychain and keep the key in `~/.booklet/config.json` (containers, CI) |
| `NO_COLOR` | Set to any value to disable ANSI colour output (or pass `--no-color`) |

---

## Credential storage

`booklet login` saves your API key to your OS's credential store when available — macOS
Keychain, Windows Credential Manager, or Linux Secret Service. On macOS, the first `booklet`
command that touches the keychain may show a one-time system prompt asking to allow access;
choosing "Always Allow" avoids repeat prompts.

If no keychain backend is available (common on headless Linux/CI), the key is stored in
`~/.booklet/config.json` instead, with owner-only file permissions (`0600`). `booklet whoami`
always shows exactly where your active key came from.

`booklet logout` removes the key from wherever it's stored.

---

## CI / GitHub Actions

Use the `BOOKLET_API_KEY` secret to publish from CI:

```yaml
- name: Publish to Booklet
  env:
    BOOKLET_API_KEY: ${{ secrets.BOOKLET_API_KEY }}
  run: |
    if [ -n "${{ vars.BOOKLET_PAGE_ID }}" ]; then
      npx booklet-cli publish CHANGELOG.md --update ${{ vars.BOOKLET_PAGE_ID }}
    else
      npx booklet-cli publish CHANGELOG.md --slug release-notes --visibility public
    fi
```

Set `BOOKLET_API_KEY` under Settings → Secrets → Actions. Set `BOOKLET_PAGE_ID` as a repository variable to reuse the same URL on every run.

See [.github/examples/publish-to-booklet.yml](https://github.com/AshwinSathian/booklet/blob/main/.github/examples/publish-to-booklet.yml) for a complete example workflow.

---

## Links

- [booklet.ashwinsathian.com](https://booklet.ashwinsathian.com): create your account
- [npmjs.com/package/booklet-cli](https://www.npmjs.com/package/booklet-cli): npm package
- [GitHub](https://github.com/AshwinSathian/booklet): source
