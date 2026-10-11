---
title: Frontmatter
description: The YAML keys Booklet reads at the top of a document, with their types and limits.
order: 2
---

Frontmatter is a YAML block at the very top of a document, between two lines of three hyphens. It is not shown as part of the page. `type` and the fields after it are read however you publish. `slug`, `visibility` and `space` are read when you publish through the API, the CLI or MCP; the web editor ignores those three, so use its visibility menu, and set a custom URL after publishing.

```markdown
---
title: Incident report, auth service
type: incident
status: Resolved
severity: P1
date: 2026-05-14
owners: [identity-team]
slug: incident-auth-2026-05
visibility: unlisted
tags: [auth, outage]
---

# Incident report, auth service
```

## Keys

| Key | Type | What it does |
| --- | --- | --- |
| `title` | string | The page title. Without it, the first level-1 heading is used. Up to 200 characters |
| `slug` | string | A custom address, `/p/<slug>`. Needs an account. 3 to 60 characters |
| `visibility` | `unlisted`, `public` or `team` | Defaults to `unlisted`. `team` needs `space` |
| `space` | string | Slug of the team space to publish into |
| `type` | string | `incident`, `postmortem`, `adr`, `rfc`, `runbook` or `release-notes`. Turns on the header strip |
| `status` | string | Shown in the header strip. Up to 40 characters |
| `severity` | string | Shown in the header strip. Up to 20 characters |
| `date` | string | Shown in the header strip. `YYYY-MM-DD` is formatted; anything else is shown as written |
| `owners` | list of strings | People or teams, shown in the header strip |
| `supersedes` | string | Title of the document this one replaces |
| `tags` | list of strings | Shown on the page. A public page is listed under each tag |
| `description` | string | The description search engines and link previews show. Up to 300 characters |
| `author` | string | Shown in the header strip, as "by" and the name. Up to 100 characters |

Unknown keys are ignored.

## Where a value can also come from

`visibility` and `space` can also be given in the API request or as CLI options. A value given there wins over the frontmatter.
