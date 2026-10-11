---
title: CLI commands
description: Every booklet-cli command and option, the environment variables it reads, and its exit codes.
order: 4
---

The package is `booklet-cli`; the command it installs is `booklet`. It needs Node.js 22 or later. [CLI](/docs/guides/cli) is the guide.

## Global options

| Option | Meaning |
| --- | --- |
| `--json` | Print the result as JSON on stdout, and errors as JSON on stderr |
| `--no-color` | No colour in the output |

## publish

`booklet publish [file]` publishes a Markdown file. `-` reads from stdin.

| Option | Meaning |
| --- | --- |
| `--slug <slug>` | Custom address |
| `--visibility <v>` | `unlisted` (default), `public`, or `team` with `--space` |
| `--space <slug>` | Publish into this team space. New pages only |
| `--update <id>` | Update this page instead of creating one |
| `--watch` | Publish again each time the file changes |
| `--open` | Open the page in the browser afterwards |

## new

`booklet new <template>` writes a template file to edit. Templates: `incident`, `postmortem`, `adr`, `rfc`, `runbook`, `release-notes`. A folder in the output path is created if it is missing.

| Option | Meaning |
| --- | --- |
| `-o, --output <file>` | File to write. Default `<template>.md` |
| `--force` | Overwrite the file if it exists |

## pull

`booklet pull <id>` prints a page's Markdown. `id` is a page ID or slug.

| Option | Meaning |
| --- | --- |
| `-o, --output <file>` | Write to this file instead of stdout |

## pages

| Command | Meaning |
| --- | --- |
| `booklet pages list` | List your pages. `--query <text>`, `--tag <tag>`, `--type <type>`, `--space <slug>` |
| `booklet pages open <id>` | Open a page in the browser. `--print` prints the URL instead |
| `booklet pages move <id>` | `--space <slug>` moves it into a space, `--no-space` takes it out, `--visibility <v>` sets visibility in the same step |
| `booklet pages delete <id>` | Delete a page. `-y, --yes` skips the confirmation |

## login, logout, whoami

| Command | Meaning |
| --- | --- |
| `booklet login` | Approve in the browser and save a key. `--key <key>` saves a key you have, `--api-url <url>` points at another Booklet, `--force` signs in again |
| `booklet logout` | Remove the saved key |
| `booklet whoami` | Show the active key and base URL |

## completion

`booklet completion <shell>` prints a completion script for `bash`, `zsh` or `fish`.

## Environment

| Variable | Meaning |
| --- | --- |
| `BOOKLET_API_KEY` | The API key. Wins over a saved key |
| `BOOKLET_API_URL` | Base URL of the Booklet to talk to, for a self-hosted copy |
| `BOOKLET_NO_KEYCHAIN` | Set to `1` to keep the saved key in `~/.booklet/config.json` and not in the OS keychain |
| `NO_COLOR` | Set to turn colour off in the output |

## Exit codes

| Code | Meaning |
| --- | --- |
| 0 | Success |
| 1 | Failure: network error, server error, rejected request |
| 2 | Usage error: unknown command or option, missing argument |
| 3 | Not authenticated, or not allowed |
| 4 | Page not found |
| 5 | Rate limited |
