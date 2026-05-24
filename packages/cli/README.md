# readable-cli

Publish Markdown pages from your terminal using [Readable](https://readable.ashwinsathian.com).

## Install

```bash
npm install -g readable-cli
```

Or use without installing:

```bash
npx readable-cli publish README.md
```

## Authentication

```bash
readable login
```

This opens your browser to authorize the CLI. Sign in (or create an account) and you're done — no copy-pasting required. Your key is saved automatically to `~/.readable/config.json`.

**CI / non-interactive environments:** pass your key directly with `--key`:

```bash
readable login --key rdbl_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

You can also set it via environment variable, which takes precedence over the config file:

```bash
export READABLE_API_KEY=rdbl_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Generate keys manually at [readable.ashwinsathian.com](https://readable.ashwinsathian.com) → My Pages → Settings → API Keys.

## Commands

### `readable publish [file]`

Publish a Markdown file as a Readable page.

```bash
readable publish README.md
readable publish NOTES.md --slug my-notes
readable publish NOTES.md --visibility unlisted
readable publish README.md --open          # opens the page in your browser
```

**Publish from stdin:**

```bash
cat CHANGELOG.md | readable publish -
echo "# Hello world" | readable publish -
```

**Update an existing page in-place:**

```bash
readable publish README.md --update <page-id>
```

**Watch mode — auto-republish on every save:**

```bash
readable publish README.md --watch
readable publish README.md --update <id> --watch
```

Options:

| Flag | Description |
|------|-------------|
| `--slug <slug>` | Set a custom URL slug (e.g. `my-readme`) |
| `--visibility <v>` | `public` (default) or `unlisted` |
| `--update <id>` | Update an existing page by ID |
| `--watch` | Watch file and re-publish on change |
| `--open` | Open the page in your browser after publishing |

---

### `readable pages list`

List all your published pages.

```bash
readable pages list
readable pages list --json   # machine-readable output
```

### `readable pages open <id>`

Open a page in your browser. Pass `--print` to print the URL without opening a browser.

```bash
readable pages open abc123             # opens browser
readable pages open abc123 --print     # prints URL only
readable pages open my-custom-slug     # works with slugs too
```

### `readable pages delete <id>`

Delete a page by ID or slug. Shows the page title and URL in the confirmation prompt.

```bash
readable pages delete abc123
readable pages delete abc123 --yes   # skip confirmation prompt
```

### `readable whoami`

Show the active API key, base URL, and where the key was loaded from (env var or config file).

### `readable logout`

Remove the saved API key from `~/.readable/config.json`.

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
| `visibility` | `"public"` \| `"unlisted"` | Defaults to public |
| `description` | string | SEO meta description (max 300 chars) |
| `author` | string | Stored as metadata (max 100 chars) |
| `date` | string | Stored as metadata, any format |

---

## Environment variables

| Variable | Description |
|----------|-------------|
| `READABLE_API_KEY` | API key — overrides `~/.readable/config.json` |
| `READABLE_API_URL` | Override API base URL (default: production) |
| `NO_COLOR` | Set to any value to disable ANSI colour output |

---

## CI / GitHub Actions

Use the `READABLE_API_KEY` secret to publish from CI:

```yaml
- name: Publish to Readable
  env:
    READABLE_API_KEY: ${{ secrets.READABLE_API_KEY }}
  run: |
    if [ -n "${{ vars.READABLE_PAGE_ID }}" ]; then
      npx readable-cli publish CHANGELOG.md --update ${{ vars.READABLE_PAGE_ID }}
    else
      npx readable-cli publish CHANGELOG.md --slug release-notes --visibility public
    fi
```

Set `READABLE_API_KEY` under Settings → Secrets → Actions. Set `READABLE_PAGE_ID` as a repository variable to reuse the same URL on every run.

See [.github/examples/publish-to-readable.yml](https://github.com/AshwinSathian/readable/blob/main/.github/examples/publish-to-readable.yml) for a complete example workflow.

---

## Links

- [readable.ashwinsathian.com](https://readable.ashwinsathian.com) — Create your account
- [npmjs.com/package/readable-cli](https://www.npmjs.com/package/readable-cli) — npm package
- [GitHub](https://github.com/AshwinSathian/readable) — Source
