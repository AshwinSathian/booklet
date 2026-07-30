# booklet-cli

Publish Markdown pages from your terminal using [Booklet](https://booklet.ashwinsathian.com).

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

This opens your browser to authorize the CLI. Sign in (or create an account) and you're done, no copy-pasting required. Your key is saved automatically to `~/.booklet/config.json`.

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
| `--visibility <v>` | `public` (default) or `unlisted` |
| `--update <id>` | Update an existing page by ID |
| `--watch` | Watch file and re-publish on change |
| `--open` | Open the page in your browser after publishing |

---

### `booklet pages list`

List all your published pages.

```bash
booklet pages list
booklet pages list --json   # machine-readable output
```

### `booklet pages open <id>`

Open a page in your browser. Pass `--print` to print the URL without opening a browser.

```bash
booklet pages open abc123             # opens browser
booklet pages open abc123 --print     # prints URL only
booklet pages open my-custom-slug     # works with slugs too
```

### `booklet pages delete <id>`

Delete a page by ID or slug. Shows the page title and URL in the confirmation prompt.

```bash
booklet pages delete abc123
booklet pages delete abc123 --yes   # skip confirmation prompt
```

### `booklet whoami`

Show the active API key, base URL, and where the key was loaded from (env var or config file).

### `booklet logout`

Remove the saved API key from `~/.booklet/config.json`.

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
| `BOOKLET_API_KEY` | API key, overrides `~/.booklet/config.json` |
| `BOOKLET_API_URL` | Override API base URL (default: production) |
| `NO_COLOR` | Set to any value to disable ANSI colour output |

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
