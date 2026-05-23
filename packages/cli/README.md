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

Get your API key from [readable.ashwinsathian.com](https://readable.ashwinsathian.com) → My Pages → Settings → API Keys. Keys look like `rdbl_xxxx…` (45 chars).

```bash
readable login
# Paste your API key when prompted, or pass it directly:
readable login --key rdbl_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Your key is saved to `~/.readable/config.json`. You can also set it via environment variable — useful for CI:

```bash
export READABLE_API_KEY=rdbl_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## Commands

### `readable publish [file]`

Publish a Markdown file as a Readable page.

```bash
readable publish README.md
readable publish NOTES.md --slug my-notes
readable publish NOTES.md --visibility unlisted
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

---

### `readable pages list`

List all your published pages.

```bash
readable pages list
readable pages list --json   # machine-readable output
```

### `readable pages delete <id>`

Delete a page by ID.

```bash
readable pages delete abc123xyz
readable pages delete abc123xyz --yes   # skip confirmation prompt
```

### `readable pages open <id>`

Print the URL of a page.

```bash
readable pages open abc123xyz
```

### `readable whoami`

Show the active API key and base URL.

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
---

# Release Notes v2

Content here…
```

Supported frontmatter fields: `title`, `slug`, `visibility`.

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
  run: npx readable-cli publish CHANGELOG.md --update ${{ vars.READABLE_PAGE_ID }}
```

See [.github/examples/publish-to-readable.yml](https://github.com/AshwinSathian/readable/blob/main/.github/examples/publish-to-readable.yml) for a full example.

---

## Links

- [readable.ashwinsathian.com](https://readable.ashwinsathian.com) — Create your account
- [npmjs.com/package/readable-cli](https://www.npmjs.com/package/readable-cli) — npm package
- [GitHub](https://github.com/AshwinSathian/readable) — Source
