---
title: Quickstart
description: Publish a first page from the editor, then from the terminal. Neither needs more than a couple of minutes.
order: 1
---

Booklet turns a Markdown document into a web page with a link. This page gets you to a published page two ways: in the browser, and from a terminal.

## Publish from the editor

1. Open [the editor](/app). You do not need an account.
2. Write some Markdown, or pick a template from the command menu (press `⌘K`, or `Ctrl+K`). The preview beside the editor is the page your reader will get.
3. Press **Publish**, or `⌘↵`.

You get a link like `https://booklet.ashwinsathian.com/p/Ab3k91QxZp`. A new page is **unlisted**: anyone with the link can read it, and search engines are told not to index it.

Without an account you can publish 10 pages a month, each is kept for 90 days, and a page cannot be edited after it is published. A free account removes all three limits. See [Limits](/docs/reference/limits).

## Publish from the terminal

The CLI needs an account and an API key.

1. [Create an account](/sign-up), then create a key under [Settings, API keys](/settings/api-keys). The key starts with `bklt_` and is shown once.
2. Give the key to the CLI and publish a file:

```bash
export BOOKLET_API_KEY=bklt_your_key
npx booklet-cli publish README.md
```

The command prints the page's URL. To change the page later without changing its link, pass the page ID back:

```bash
npx booklet-cli publish README.md --update Ab3k91QxZp
```

## Make it an engineering document

Put a `type` in the frontmatter and the page shows its status, severity, date and owners in a strip under the title:

```markdown
---
type: incident
status: Resolved
severity: P1
date: 2026-07-18
owners: [payments-oncall]
---

# Checkout API errors, 18 July
```

The types are `incident`, `postmortem`, `adr`, `rfc`, `runbook` and `release-notes`. [Document types](/docs/guides/document-types) has the rest.

## Where to go next

- [Connect Claude or another MCP client](/docs/guides/mcp), and ask for a page to be published.
- [Publish from a GitHub workflow](/docs/guides/github-action).
- [Keep a team's documents in one space](/docs/guides/team-spaces).
- [Recipes](/docs#recipes): one task each, start to finish.
