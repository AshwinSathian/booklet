---
title: MCP tools and prompts
nav: MCP tools
description: The tools, resources and prompts Booklet's MCP server offers to a connected client.
order: 5
---

The server is at `https://booklet-mcp.ashwinsathian.com/mcp` and speaks protocol version `2026-07-28` over Streamable HTTP. [Claude and other MCP clients](/docs/guides/mcp) covers connecting to it.

## Authentication

Either OAuth sign-in, for clients that support it (a Claude.ai custom connector does), or an `Authorization: Bearer bklt_...` header with the same API key the REST API takes.

## Tools

| Tool | What it does |
| --- | --- |
| `publish_page` | Publishes a new page from Markdown and returns its URL. Unlisted unless `visibility` is `public` |
| `create_document` | Publishes a new engineering document of a given type, with its frontmatter |
| `update_page` | Replaces a page's content, or changes its slug, visibility or team space. The URL stays the same |
| `get_page` | Returns one page with its Markdown. A page over 8,000 characters comes back as its metadata and a `booklet://pages/<id>` resource link to read |
| `list_pages` | Lists your pages, newest first, a cursor at a time |
| `search_pages` | Finds pages by title text, document type or team space |
| `delete_page` | Deletes a page for good |

## Resources

Your published pages, each as `booklet://pages/<id>`.

## Prompts

Each prompt gives the model the structure of one kind of document to fill in.

| Prompt | Arguments |
| --- | --- |
| `incident_report` | `title` (required), `severity`, `date` |
| `postmortem` | `title` (required), `severity`, `date` |
| `adr` | `title` (required), `status` |
| `release_notes` | `product` and `version` (required), `date` |
| `rfc` | `title` (required), `author` |
| `runbook` | `service` (required), `team` |
