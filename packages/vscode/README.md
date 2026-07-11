# Readable for VS Code

Publish Markdown straight from the editor. Write your notes, docs, READMEs,
or incident reports as usual — then turn the current file (or just a
selection) into a clean, shareable [Readable](https://readable.ashwinsathian.com)
page without leaving VS Code.

## Features

- **Readable: Publish Current File** — publishes the whole active file.
- **Readable: Publish Selection** — publishes just the highlighted text (falls
  back to the full file if nothing is selected).
- **Readable: Set API Key** — validates your key against the API and stores
  it in VS Code's built-in secret storage (OS keychain), never in
  `settings.json`.
- On success you get the shareable link immediately, with one-click **Copy
  URL** or **Open in Browser**.

## Getting started

1. Install the extension.
2. Get a free API key from [readable.ashwinsathian.com/api-docs#authentication](https://readable.ashwinsathian.com/api-docs#authentication).
3. Run **Readable: Set API Key** from the Command Palette (`Cmd+Shift+P` /
   `Ctrl+Shift+P`) and paste it in.
4. Open any Markdown file and run **Readable: Publish Current File**.

## Settings

| Setting | Default | Description |
|---|---|---|
| `readable.baseUrl` | `https://readable-api.ashwinsathian.com` | The Readable API host. Only change this if you're self-hosting. |

Your API key (`rdbl_...`) isn't a setting — it's stored in VS Code's secret
storage via **Readable: Set API Key**, not in `settings.json`.

## Why Readable

Readable turns plain Markdown into a properly formatted page — headings,
code blocks, tables, diagrams — shareable with a single link. No account
required to publish anonymously; a free account adds ownership, analytics,
and version history.

## Links

- [Readable](https://readable.ashwinsathian.com)
- [API docs](https://readable.ashwinsathian.com/api-docs)
- [Report an issue](https://github.com/AshwinSathian/readable/issues)

## License

MIT
