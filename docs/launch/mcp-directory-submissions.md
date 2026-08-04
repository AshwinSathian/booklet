# MCP directory submissions — ready to paste

> Written 2026-08-04 as part of `PLAN-ai-agent-wedge.md` Phase 4. These are drafts, not
> submitted — each of the four listings below requires a manual web-form submission or a
> human-reviewed GitHub PR (see "How to submit" per entry); nothing here is automated. Submission
> mechanics were verified live against each site on 2026-08-04; re-check before submitting if
> this file is more than a few months old, since directory submission flows change.

## Server facts (reused verbatim across all four submissions)

| Field | Value |
|---|---|
| Server name | Booklet |
| One-line description | Publish and manage Markdown pages on Booklet — from Claude, Cursor, or any MCP client. |
| Endpoint | `https://booklet-mcp.ashwinsathian.com/mcp` |
| Transport | Streamable HTTP |
| Auth | `Authorization: Bearer <bklt_...>` (same API key as the REST API) |
| Tools | `publish_page`, `update_page`, `get_page`, `list_pages` (filterable by title/tag), `delete_page` |
| Prompts | `incident_report`, `adr`, `release_notes`, `rfc`, `runbook` |
| Resources | Published pages, browsable/readable as `booklet://pages/:id` |
| GitHub repo | https://github.com/AshwinSathian/booklet (server source: `mcp-server/`) |
| Homepage | https://booklet.ashwinsathian.com |
| Setup docs | https://booklet.ashwinsathian.com/mcp-setup |
| License | MIT |
| Supported clients | Claude Desktop, Claude.ai, Cursor, Windsurf, VS Code (Copilot Chat), Zed |

---

## 1. mcp.so

**How to submit:** https://mcp.so/submit?type=server — free review, or paid "Premium" for
immediate publish. (Source: [mcp.so/submit](https://mcp.so/submit?type=server))

**Fields to paste:**

- **Name:** Booklet
- **Description:** Publish Markdown as a clean, permanent, shareable page directly from
  conversation. Includes five prompt templates (incident report, ADR, release notes, RFC,
  runbook) so an assistant can draft a structured doc and publish it in one turn.
- **Category:** Productivity / Developer Tools
- **Repository:** https://github.com/AshwinSathian/booklet
- **Homepage:** https://booklet.ashwinsathian.com

---

## 2. Smithery

**How to submit:** add a `smithery.yaml` to the repo, then `smithery mcp publish <url> -n
<org/server>` via the Smithery CLI. Requires: server name, one-sentence description, tool count,
transport type, GitHub repo URL, homepage URL, optional icon. (Source:
[Smithery CLI docs](https://smithery.ai/docs/concepts/cli),
[smithery-ai/cli](https://github.com/smithery-ai/cli))

**`smithery.yaml` values to use:**

```yaml
name: booklet
displayName: Booklet
description: Publish and manage Markdown pages on Booklet from any MCP client.
category: developer-tools
tags: [markdown, publishing, documentation, cli, api]
homepage: https://booklet.ashwinsathian.com
repository: https://github.com/AshwinSathian/booklet
```

**Publish command** (run from a machine with the Smithery CLI installed and authenticated):

```bash
smithery mcp publish https://booklet-mcp.ashwinsathian.com/mcp -n ashwinsathian/booklet
```

Note: this is the one submission in this file that's a CLI command rather than a web form —
still a manual, founder-run step, not something to script into CI.

---

## 3. Glama

**How to submit:** Glama indexes directly from a public GitHub repo — no separate form. Point it
at https://github.com/AshwinSathian/booklet (`mcp-server/` subdirectory) via
https://glama.ai/mcp/servers → "Add Server". Glama will index the tools/schemas/annotations
automatically once it can reach the repo. (Source:
[glama.ai/mcp/servers](https://glama.ai/mcp/servers),
[Glama MCP FAQ](https://glama.ai/mcp/faq))

**Description to paste if a manual field is offered:**

> Booklet is a free Markdown-publishing platform. Its MCP server exposes publish, update, get,
> list (filterable by title/tag), and delete tools for pages, plus five ready-made prompt
> templates for common technical-writing formats (incident reports, ADRs, release notes, RFCs,
> runbooks).

---

## 4. `awesome-mcp-servers` (punkpeye/awesome-mcp-servers)

**How to submit:** fork https://github.com/punkpeye/awesome-mcp-servers, add an entry to the
best-fitting category doc under `docs/`, and open a PR. Check the repo first for an existing
Booklet entry to avoid a duplicate. Entry format: server name linked to its repo, plus a concise
description. (Source:
[punkpeye/awesome-mcp-servers CONTRIBUTING.md](https://github.com/punkpeye/awesome-mcp-servers/blob/main/CONTRIBUTING.md))

**Entry to add** (Markdown/Documentation or Productivity category, matching the file's existing
line format — check a neighboring entry in the target file for exact icon/badge conventions
before pasting):

```markdown
- [AshwinSathian/booklet](https://github.com/AshwinSathian/booklet) 🌐 ☁️ - Publish Markdown as
  clean, permanent, shareable pages. Includes prompt templates for incident reports, ADRs,
  release notes, RFCs, and runbooks.
```

(🌐 = remote/hosted server, ☁️ = cloud service — confirm these match the repo's current legend
before submitting; icon conventions have changed before.)

**If a duplicate exists or the maintainers prefer a different repo:** `mcpservers.org/submit`
(a distinct "Awesome MCP Servers" directory site, separate from the GitHub list above) is a
same-family fallback with its own submission form — worth checking if the GitHub PR stalls.
