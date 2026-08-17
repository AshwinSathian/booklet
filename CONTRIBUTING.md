# Contributing to Booklet

Booklet is solo-maintained, so there's no formal process — just a few things that make a PR easy to review and merge.

## Before you write code

For anything bigger than a typo fix, open an issue or a [Discussion](https://github.com/AshwinSathian/booklet/discussions) first. It saves both of us time if the approach gets agreed on before the diff exists. Small, obvious fixes (a broken link, a typo, an off-by-one in a doc) can just be a PR.

## Local setup

```bash
npm install
npm run dev        # Next.js dev server at http://localhost:3000
```

You'll need Node.js 20+ and a MongoDB connection string — see the [Local development](README.md#local-development) section of the README for the full environment variable list. `mcp-server/` and `packages/*` are npm workspaces off the same root install; there's no separate `npm install` needed inside them.

## Before opening a PR

```bash
npm run lint
npm run test        # tsc --noEmit
npm run test:unit    # tests/unit/**, needs a running MongoDB
```

CI runs the same checks (`.github/workflows/ci.yml`) against every PR, plus a typecheck pass for `mcp-server` and each package in `packages/*`. If you touched one of those, run its typecheck too:

```bash
npm run typecheck --workspace packages/cli
npm run typecheck --workspace mcp-server
```

## Scope

- Keep PRs focused on one change. A bug fix doesn't need a drive-by refactor bundled in.
- If you're adding a feature, a short note in the PR description on why it belongs here (not just what it does) helps — Booklet's surface area (editor, API, CLI, MCP server, GitHub Action) is already wide, and not every feature request is a good fit for all five.
- Match the existing code style; there's no separate style guide beyond what `eslint.config.mjs` and the TypeScript strict config already enforce.

## Where things live

`packages/` is npm workspaces — `shared` (the API client used by the CLI, MCP server, and VS Code extension), `cli`, and `vscode`. `mcp-server/` is a standalone Node process, not a Cloudflare Worker (see `docs/OPERATIONS.md` for why). The root `src/` is the Next.js app. See the [Project structure](README.md#project-structure) section of the README for the full breakdown.

## Reporting bugs

Use a [GitHub issue](https://github.com/AshwinSathian/booklet/issues/new/choose). For anything involving API keys, auth, or another user's data, see [SECURITY.md](SECURITY.md) instead — don't file it as a public issue.

## License

By contributing, you agree your changes are licensed under the project's [MIT license](LICENSE).
