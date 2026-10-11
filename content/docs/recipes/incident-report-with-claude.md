---
title: An incident report written and published by Claude
nav: Incident report with Claude
description: Give Claude the alert timeline and get back a link to a published incident report with its status and severity in the header.
order: 1
---

**You end up with** a published incident report, with type, status, severity and date in its header strip, and its link in the conversation.

**You need** a Booklet account and an MCP client connected to it. [Claude and other MCP clients](/docs/guides/mcp) covers the setup.

This recipe needs a conversation with a model, so it is not run in our tests. The tool and prompt it relies on are.

## Steps

1. Start a conversation in the connected client.
2. Paste what you have: alert timestamps, chat excerpts, the deploy log. Rough is fine.
3. Ask:

```text
Write an incident report from this and publish it to Booklet.
Severity P1, resolved. Keep the timeline as a table in UTC.
```

Claude uses Booklet's `incident_report` prompt for the structure and the `create_document` tool to publish. It answers with the page's link.

4. Read the page. To correct it, say what is wrong:

```text
The root cause is the pool size, not the deploy itself. Update the page.
```

Claude calls `update_page`. The link does not change, and the earlier text is kept as a version.

## Publish into a team space

Add the space to the request: "publish it to the payments space, for the team only". The page is then readable by members of that space alone.

## Check it worked

Open the link. The strip under the title shows Incident, the status, the severity and the date. The page is in [My pages](/my-pages), marked as published through MCP.

## If it does not

- **Claude writes the report in the chat and publishes nothing.** Ask it to publish to Booklet by name. If it says it has no such tool, the connector is not attached to this conversation: see [When it does not work](/docs/guides/mcp#when-it-does-not-work).
- **The header strip is missing.** The document was published without `type` in its frontmatter. Ask Claude to add `type: incident` and update the page.
