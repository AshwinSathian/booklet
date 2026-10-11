---
title: Claude and other MCP clients
nav: MCP clients
description: Connect Booklet's MCP server to Claude.ai, Claude Desktop, Cursor, Windsurf, VS Code or Zed, then publish and update pages from a conversation.
order: 1
---

Booklet runs an MCP server. Once a client is connected, you can ask it to publish a page, update one, or find one, and it answers with the link.

- Endpoint: `https://booklet-mcp.ashwinsathian.com/mcp`
- Transport: Streamable HTTP. Nothing to install.
- Protocol version: `2026-07-28`. A client that only knows earlier versions reports "unsupported protocol version" and needs updating.

## Connect a client

Claude.ai signs in with your Booklet account, so there is no key to create. Every other client sends an API key.

```booklet-embed
mcp-client-picker
```

The picker above is interactive. In short:

- **Claude.ai**: Settings, Connectors, Add custom connector. Name it Booklet, give it the endpoint above, and sign in when asked.
- **Claude Desktop and Cursor**: add a server with the endpoint as its URL and your key in an `Authorization` header. Windsurf has fields for the same two values.

```json
{
  "mcpServers": {
    "booklet": {
      "url": "https://booklet-mcp.ashwinsathian.com/mcp",
      "headers": { "Authorization": "Bearer bklt_YOUR_API_KEY" }
    }
  }
}
```

- **VS Code**: the same server in `.vscode/mcp.json`, under `servers`, with `"type": "http"`.
- **Zed**: a custom context server that runs `npx -y mcp-remote@latest` with the endpoint and the same header.

## Try it

Ask in plain words. These work as written:

- "Publish this as a Booklet page and give me the link."
- "Write an incident report for the checkout outage from this timeline and publish it."
- "Update page `Ab3k91QxZp` with the corrected root cause."
- "Find the ADR about queue retries in the payments space."

A page published this way is unlisted unless you ask for it to be public.

## What the server offers

Seven tools, the account's pages as resources, and five prompts that start a document of a given type. [MCP tools and prompts](/docs/reference/mcp-tools) lists them.

## When it does not work

**The client says it has no Booklet tools.** On Claude.ai, check that your plan includes custom connectors. Claude Desktop must be quit and reopened after its config changes, not only have its window closed. In Cursor and Windsurf, check that the server shows as connected in their MCP settings.

**"Unauthorized".** The key in the config is wrong or was revoked. Create a new one under [Settings, API keys](/settings/api-keys) and replace the value after `Bearer`.

**Claude Desktop does not list the server.** The config file is not valid JSON. One extra comma is enough.

**Zed cannot start `mcp-remote`.** Zed reaches the server through `npx mcp-remote`, which needs Node.js on your `PATH`. Run `node --version` in a terminal to check.

## What the key can do

An API key acts as you, on your pages and the team spaces you belong to. The MCP server passes it to Booklet's API on each call and does not store it. Deleting the key under [Settings, API keys](/settings/api-keys) cuts off every client that uses it at once.

A client that signed in instead (Claude.ai) holds a token that expires after an hour and is renewed while the connector stays installed. Booklet stores only a hash of it. You can disconnect it under [Account settings](/settings/account), "Connected apps".
