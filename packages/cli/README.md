# @readable/cli

Publish Markdown pages from your terminal.

## Install

```bash
npm install -g readable-cli
```

Or use without installing:

```bash
npx readable-cli publish README.md
```

## Authentication

Get your API key from [readable.ashwinsathian.com](https://readable.ashwinsathian.com) → My Pages → Settings → API Keys.

```bash
readable login
# Paste your API key when prompted, or:
readable login --key rdbl_xxxxxxxxxxxx
```

## Usage

### Publish a file

```bash
readable publish README.md
```

### Publish from stdin

```bash
cat NOTES.md | readable publish -
echo "# Hello" | readable publish -
```

### Custom slug and visibility

```bash
readable publish README.md --slug my-readme --visibility unlisted
```

### Update an existing page

```bash
readable publish README.md --update <page-id>
```

### Watch and auto-republish on save

```bash
readable publish README.md --watch
readable publish README.md --update <id> --watch
```

### List your pages

```bash
readable pages list
readable pages list --json
```

### Delete a page

```bash
readable pages delete <id>
readable pages delete <id> --yes   # skip confirmation
```

## Environment variables

| Variable            | Description                                   |
| ------------------- | --------------------------------------------- |
| `READABLE_API_KEY`  | API key (overrides `~/.readable/config.json`) |
| `READABLE_API_URL`  | API base URL (default: production)            |
| `NO_COLOR`          | Disable ANSI colour output                    |

## Frontmatter

Frontmatter in your Markdown is parsed and applied automatically:

```markdown
---
title: My Page
slug: my-page
visibility: unlisted
---

# My Page

Content here…
```
