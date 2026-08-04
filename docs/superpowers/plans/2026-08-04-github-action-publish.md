# Publish-to-Booklet GitHub Action — Extraction, Hardening, Launch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task (inline execution — this plan was authored for a single session to run straight through, not subagent dispatch). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract `packages/github-action` into a standalone public repo (`AshwinSathian/publish-to-booklet`) at a Marketplace-ready, security-hardened bar, then apply the same hardening standard to every workflow remaining in the `booklet` monorepo.

**Architecture:** The new repo is fully self-contained — it depends on `booklet-api-client` as an ordinary published npm dependency (not a workspace link), so there is no ongoing sync relationship with the monorepo. `packages/github-action/` is deleted from `booklet` once the new repo is live. Both repos get SHA-pinned actions, least-privilege `permissions:` blocks, zizmor + OpenSSF Scorecard scanning, and Dependabot coverage for the `github-actions` ecosystem.

**Tech Stack:** TypeScript, tsup (CJS bundling), `node:test` + `tsx`, GitHub Actions (`node24` runtime for the action itself), `gh` CLI for release automation.

## Global Constraints

- `runs.using: "node24"` in the new repo's `action.yml` (not `node20` — already deprecated on hosted runners per GitHub's Sept 2025 changelog).
- Every `uses:` in every workflow touched (both repos) is pinned to a full 40-character commit SHA with a trailing `# vX.Y.Z` comment.
- Every workflow gets an explicit `permissions:` block — workflow-level restrictive default (`{}` or `contents: read`), per-job escalation only where needed.
- Every job gets `timeout-minutes`.
- `NPM_TOKEN`/`NODE_AUTH_TOKEN` stay wired in `publish-cli.yml`/`publish-shared.yml` as a fallback — do not remove them in this plan; only add `id-token: write` + npm-version readiness for OIDC.
- No VSCE Azure-OIDC migration in this plan — flag only, per the approved design.
- New repo name: `publish-to-booklet`, owner: `AshwinSathian`, public.
- Pinned SHAs to use throughout (verified live via `gh api repos/<owner>/<repo>/tags` on 2026-08-04):
  - `actions/checkout` → `3d3c42e5aac5ba805825da76410c181273ba90b1` # v7.0.1
  - `actions/setup-node` → `820762786026740c76f36085b0efc47a31fe5020` # v7.0.0
  - `zizmorcore/zizmor-action` → `3dc1ecc9bcb9e94e9b2c709687979e1298497054` # v0.6.2
  - `ossf/scorecard-action` → `2d1146689b8cda280b9bc96326124645441f03bc` # v2.4.4
  - `github/codeql-action/upload-sarif` → `d1ba80a13dd99fba24a470575428917156a28b43` # v4.37.5

---

## Task 1: Scaffold the `publish-to-booklet` repo

**Files (new repo, local path `/Users/ashwinsathian/Documents/Personal/publish-to-booklet`):**
- Create: `package.json`, `tsconfig.json`, `.gitignore`, `LICENSE`

**Interfaces:**
- Produces: an npm workspace root at the new repo's path that later tasks install into and build from.

- [ ] **Step 1: Create the GitHub repo and clone it locally**

```bash
gh repo create AshwinSathian/publish-to-booklet --public \
  --description "GitHub Action: publish a Markdown file to Booklet and get a shareable URL" \
  --clone
```

This clones to `./publish-to-booklet` in the current directory — move/confirm it ends up at `/Users/ashwinsathian/Documents/Personal/publish-to-booklet` (sibling to the `booklet` monorepo checkout).

- [ ] **Step 2: Write `package.json`**

```json
{
  "name": "publish-to-booklet",
  "version": "1.0.0",
  "description": "GitHub Action: publish a Markdown file to Booklet and get a shareable URL",
  "private": true,
  "license": "MIT",
  "author": {
    "name": "Ashwin Sathian",
    "email": "ashwinsathyan19@gmail.com"
  },
  "repository": {
    "type": "git",
    "url": "git+https://github.com/AshwinSathian/publish-to-booklet.git"
  },
  "scripts": {
    "build": "tsup",
    "typecheck": "tsc --noEmit",
    "test": "node --import tsx --test __tests__/**/*.test.ts"
  },
  "dependencies": {},
  "devDependencies": {
    "@actions/core": "^3.0.1",
    "@types/node": "^24.0.0",
    "booklet-api-client": "^0.1.0",
    "tsup": "^8.5.1",
    "tsx": "^4.19.0",
    "typescript": "^5.0.0"
  }
}
```

- [ ] **Step 3: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src", "__tests__"]
}
```

- [ ] **Step 4: Write `.gitignore`**

```
node_modules/
*.log
.DS_Store
```

- [ ] **Step 5: Write `LICENSE`** (MIT, matching `booklet`'s)

```
MIT License

Copyright (c) 2026 Ashwin Sathian

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 6: Install dependencies and commit**

```bash
cd /Users/ashwinsathian/Documents/Personal/publish-to-booklet
npm install
git add package.json package-lock.json tsconfig.json .gitignore LICENSE
git commit -m "chore: scaffold publish-to-booklet"
```

---

## Task 2: Port the action logic with dependency injection, TDD

**Files:**
- Create: `src/main.ts`
- Test: `__tests__/main.test.ts`

**Interfaces:**
- Produces: `isValidVisibility(value: string): value is "public" | "unlisted"`, `RunDeps` interface (`{ readFile: (path: string) => string; createClient: (options: ClientOptions) => Pick<BookletClient, "publishPage" | "updatePage"> }`), `run(deps?: RunDeps): Promise<void>` — all exported from `src/main.ts`. Later tasks (action.yml, tsup config) rely on `src/main.ts` being the entry point and on `require.main === module` gating the auto-invocation so importing the module in tests has no side effects.

The original `packages/github-action/src/main.ts` calls `void run()` unconditionally at module load — importing it from a test file would trigger a real run as a side effect. This task refactors to inject `readFile`/`createClient` as dependencies (so tests can fake the network/filesystem) and gates the auto-invocation behind `require.main === module`. Behavior is otherwise unchanged from the original, plus one addition: `core.setSecret(apiKey)` to proactively mask the key from logs.

- [ ] **Step 1: Write the failing tests**

Create `__tests__/main.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { isValidVisibility, run } from "../src/main";

function withInputs(inputs: Record<string, string>, fn: () => Promise<void>) {
  const keys = Object.keys(inputs).map((k) => `INPUT_${k.toUpperCase()}`);
  for (const [k, v] of Object.entries(inputs)) process.env[`INPUT_${k.toUpperCase()}`] = v;
  return fn().finally(() => {
    for (const k of keys) delete process.env[k];
    process.exitCode = undefined;
  });
}

test("isValidVisibility accepts only public/unlisted", () => {
  assert.equal(isValidVisibility("public"), true);
  assert.equal(isValidVisibility("unlisted"), true);
  assert.equal(isValidVisibility("private"), false);
  assert.equal(isValidVisibility(""), false);
});

test("run() fails on an invalid visibility input", async () => {
  await withInputs({ file: "doc.md", "api-key": "key", visibility: "private" }, async () => {
    await run({
      readFile: () => "irrelevant",
      createClient: () => {
        throw new Error("should not be called");
      },
    });
    assert.equal(process.exitCode, 1);
  });
});

test("run() fails when the file can't be read", async () => {
  await withInputs({ file: "missing.md", "api-key": "key" }, async () => {
    await run({
      readFile: () => {
        throw new Error("ENOENT: no such file");
      },
      createClient: () => {
        throw new Error("should not be called");
      },
    });
    assert.equal(process.exitCode, 1);
  });
});

test("run() publishes a new page when no page-id is given", async () => {
  const calls: unknown[] = [];
  await withInputs({ file: "doc.md", "api-key": "key" }, async () => {
    await run({
      readFile: () => "# Hello",
      createClient: () => ({
        publishPage: async (raw: string) => {
          calls.push(["publish", raw]);
          return { id: "abc123", url: "https://booklet.example/abc123" } as never;
        },
        updatePage: async () => {
          throw new Error("should not be called");
        },
      }),
    });
    assert.deepEqual(calls, [["publish", "# Hello"]]);
    assert.notEqual(process.exitCode, 1);
  });
});

test("run() updates an existing page when page-id is given", async () => {
  const calls: unknown[] = [];
  await withInputs(
    { file: "doc.md", "api-key": "key", "page-id": "abc123", visibility: "public" },
    async () => {
      await run({
        readFile: () => "# Hello",
        createClient: () => ({
          publishPage: async () => {
            throw new Error("should not be called");
          },
          updatePage: async (id: string, patch: unknown) => {
            calls.push(["update", id, patch]);
            return { id: "abc123", url: "https://booklet.example/abc123" } as never;
          },
        }),
      });
      assert.deepEqual(calls, [["update", "abc123", { raw: "# Hello", visibility: "public" }]]);
      assert.notEqual(process.exitCode, 1);
    },
  );
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd /Users/ashwinsathian/Documents/Personal/publish-to-booklet
npm install --save-dev tsx  # if not already installed from Task 1
npx node --import tsx --test __tests__/main.test.ts
```

Expected: FAIL — `Cannot find module '../src/main'` (doesn't exist yet).

- [ ] **Step 3: Write `src/main.ts`**

```ts
import * as core from "@actions/core";
import { readFileSync } from "fs";
import { resolve } from "path";
import { createClient, BookletApiError, type ClientOptions, type BookletClient } from "booklet-api-client";

export function isValidVisibility(value: string): value is "public" | "unlisted" {
  return value === "public" || value === "unlisted";
}

export type PublishResult = { id: string; url: string };

export interface RunDeps {
  readFile: (path: string) => string;
  createClient: (options: ClientOptions) => Pick<BookletClient, "publishPage" | "updatePage">;
}

const defaultDeps: RunDeps = {
  readFile: (path) => readFileSync(path, "utf-8"),
  createClient,
};

export async function run(deps: RunDeps = defaultDeps): Promise<void> {
  const file = core.getInput("file", { required: true });
  const apiKey = core.getInput("api-key", { required: true });
  const pageId = core.getInput("page-id") || null;
  const visibility = core.getInput("visibility") || "unlisted";
  const baseUrl = core.getInput("base-url") || "https://booklet-api.ashwinsathian.com";

  core.setSecret(apiKey);

  if (!isValidVisibility(visibility)) {
    core.setFailed(`Invalid visibility: "${visibility}" — must be "public" or "unlisted"`);
    return;
  }

  core.debug(`Publishing ${file} to ${baseUrl}`);

  let raw: string;
  try {
    raw = deps.readFile(resolve(process.cwd(), file));
  } catch (e) {
    core.setFailed(`Could not read file: ${file} — ${e instanceof Error ? e.message : String(e)}`);
    return;
  }

  const client = deps.createClient({ baseUrl, apiKey, source: "github-action" });

  let result: PublishResult;
  try {
    result = pageId ? await client.updatePage(pageId, { raw, visibility }) : await client.publishPage(raw);
  } catch (e) {
    const message = e instanceof BookletApiError ? e.message : e instanceof Error ? e.message : String(e);
    core.setFailed(`Publish failed: ${message}`);
    return;
  }

  core.setOutput("id", result.id);
  core.setOutput("url", result.url);
  core.info(`Published: ${result.url}`);
}

if (require.main === module) {
  void run();
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx node --import tsx --test __tests__/main.test.ts
```

Expected: PASS — all 5 tests green.

- [ ] **Step 5: Typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/main.ts __tests__/main.test.ts
git commit -m "feat: port publish-to-booklet action logic with DI + tests"
```

---

## Task 3: `action.yml`, tsup bundling, committed `dist/`

**Files:**
- Create: `action.yml` (repo root), `tsup.config.ts`

**Interfaces:**
- Consumes: `src/main.ts` (Task 2) as the tsup entry point.
- Produces: `dist/main.js` (committed CJS bundle) that `action.yml`'s `runs.main` points to.

- [ ] **Step 1: Write `action.yml`**

```yaml
name: "Publish to Booklet"
description: "Publish a Markdown file to Booklet and get a shareable URL"
author: "Ashwin Sathian"

branding:
  icon: "upload-cloud"
  color: "blue"

inputs:
  file:
    description: "Path to the Markdown file to publish"
    required: true
  api-key:
    description: "Booklet API key (store as a repo secret)"
    required: true
  page-id:
    description: "Existing page ID to update in-place (optional)"
    required: false
  visibility:
    description: "Page visibility: public or unlisted"
    required: false
    default: "unlisted"
  base-url:
    description: "Booklet API base URL"
    required: false
    default: "https://booklet-api.ashwinsathian.com"

outputs:
  url:
    description: "URL of the published page"
  id:
    description: "Page ID"

runs:
  using: "node24"
  main: "dist/main.js"
```

- [ ] **Step 2: Write `tsup.config.ts`**

```ts
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/main.ts"],
  // GitHub's node24 action runner does `node dist/main.js` directly with no
  // install step — dist/ is committed as-is, so every dependency
  // (@actions/core, booklet-api-client, zod) must be inlined here rather
  // than resolved from node_modules at runtime.
  format: ["cjs"],
  target: "node24",
  platform: "node",
  outDir: "dist",
  clean: true,
  bundle: true,
  splitting: false,
  minify: false,
  sourcemap: false,
  dts: false,
  noExternal: ["@actions/core", "booklet-api-client", "zod"],
});
```

- [ ] **Step 3: Build and verify the bundle runs**

```bash
npm run build
node -e "
process.env['INPUT_FILE'] = 'LICENSE';
process.env['INPUT_API-KEY'] = 'fake';
process.env['INPUT_BASE-URL'] = 'http://127.0.0.1:1'; // unroutable — expect a network-error failure, not a crash
require('./dist/main.js');
"
```

Expected: prints an `::error::Publish failed: Network error: ...` line and exits non-zero — confirms the bundle actually runs end-to-end (reads the file, attempts the request) rather than crashing on a missing/unbundled dependency.

- [ ] **Step 4: Commit**

```bash
git add action.yml tsup.config.ts dist
git commit -m "feat: add action.yml and tsup bundling"
```

---

## Task 4: README and SECURITY.md

**Files:**
- Create: `README.md`, `SECURITY.md`

- [ ] **Step 1: Write `README.md`**

```markdown
# Publish to Booklet

[![CI](https://img.shields.io/github/actions/workflow/status/AshwinSathian/publish-to-booklet/ci.yml?branch=main&label=CI)](https://github.com/AshwinSathian/publish-to-booklet/actions/workflows/ci.yml)

A GitHub Action that publishes a Markdown file to [Booklet](https://booklet.ashwinsathian.com) and returns a shareable URL.

## Usage

\`\`\`yaml
- uses: AshwinSathian/publish-to-booklet@v1
  id: publish
  with:
    file: CHANGELOG.md
    api-key: ${{ secrets.BOOKLET_API_KEY }}
    visibility: public

- run: echo "Published at ${{ steps.publish.outputs.url }}"
\`\`\`

### Updating an existing page

Pass `page-id` to update the same page in place instead of creating a new one each run:

\`\`\`yaml
- uses: AshwinSathian/publish-to-booklet@v1
  with:
    file: CHANGELOG.md
    api-key: ${{ secrets.BOOKLET_API_KEY }}
    page-id: ${{ vars.BOOKLET_PAGE_ID }}
\`\`\`

## Inputs

| Name | Required | Default | Description |
|---|---|---|---|
| `file` | Yes | — | Path to the Markdown file to publish |
| `api-key` | Yes | — | Booklet API key — store as a repo secret |
| `page-id` | No | — | Existing page ID to update in-place |
| `visibility` | No | `unlisted` | `public` or `unlisted` |
| `base-url` | No | `https://booklet-api.ashwinsathian.com` | Booklet API base URL |

## Outputs

| Name | Description |
|---|---|
| `url` | URL of the published page |
| `id` | Page ID |

## Setup

1. Create an API key at [booklet.ashwinsathian.com](https://booklet.ashwinsathian.com) → My Pages → Settings → API Keys.
2. Add it as a repo secret: **Settings → Secrets and variables → Actions → New repository secret**, named `BOOKLET_API_KEY`.

## Development

\`\`\`bash
npm ci
npm run typecheck
npm test
npm run build   # rebuilds dist/main.js — commit the result; CI's check-dist job fails PRs that forget to
\`\`\`

## License

MIT — see [LICENSE](LICENSE).
```

(Write the literal file without the backslash-escapes above — those are only to keep the code fences from terminating early in this plan document.)

- [ ] **Step 2: Write `SECURITY.md`**

```markdown
# Security Policy

This action reads a Booklet API key from a workflow secret and sends it to the Booklet API over HTTPS — it never logs or persists it beyond the run (the key is registered with `core.setSecret` so Actions redacts it from logs).

If you find a vulnerability, please report it privately rather than opening a public issue.

**Report to:** ashwinsathyan19@gmail.com

Include what you found, steps to reproduce, and impact if known. This is a solo-maintained project, so there's no bug bounty and no guaranteed SLA, but reports are read and acted on.
```

- [ ] **Step 3: Commit**

```bash
git add README.md SECURITY.md
git commit -m "docs: add README and SECURITY.md"
```

---

## Task 5: CI workflow (typecheck, test, check-dist)

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Write `.github/workflows/ci.yml`**

```yaml
# CI for publish-to-booklet: typecheck, unit test, and verify dist/ is
# rebuilt from src/ before every merge to main (GitHub's node24 runner
# executes dist/main.js directly — a stale bundle is a silently broken
# release).
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]
  workflow_dispatch: {}

concurrency:
  group: ci-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

permissions: {}

jobs:
  test:
    name: Typecheck & test
    runs-on: ubuntu-latest
    timeout-minutes: 10
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version: "24"
      - run: npm ci --prefer-offline
      - run: npm run typecheck
      - run: npm test

  check-dist:
    name: dist/ is up to date
    runs-on: ubuntu-latest
    timeout-minutes: 10
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version: "24"
      - run: npm ci --prefer-offline
      - run: npm run build
      - run: |
          if ! git diff --quiet -- dist; then
            echo "::error::dist/ is out of date. Run 'npm run build' and commit the result." >&2
            git diff --stat -- dist
            exit 1
          fi
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add typecheck/test/check-dist workflow"
```

---

## Task 6: Release workflow (tag, GitHub Release, moving major tag)

**Files:**
- Create: `.github/workflows/release.yml`

- [ ] **Step 1: Write `.github/workflows/release.yml`**

```yaml
# Cuts a GitHub Release + moves the major version tag when package.json's
# version is bumped on main. Marketplace re-lists automatically on release
# publish; the moving v1 tag is what `uses: AshwinSathian/publish-to-booklet@v1`
# consumers actually resolve.
name: Release

on:
  push:
    branches: [main]
    paths:
      - "package.json"
  workflow_dispatch: {}

permissions: {}

jobs:
  release:
    name: Tag and release
    runs-on: ubuntu-latest
    timeout-minutes: 10
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          fetch-depth: 0

      - name: Check if version already released
        id: version_check
        run: |
          PKG_VERSION=$(node -p "require('./package.json').version")
          echo "version=$PKG_VERSION" >> "$GITHUB_OUTPUT"
          if git rev-parse "v$PKG_VERSION" >/dev/null 2>&1; then
            echo "already_released=true" >> "$GITHUB_OUTPUT"
          else
            echo "already_released=false" >> "$GITHUB_OUTPUT"
          fi

      - name: Create tag and GitHub Release
        if: steps.version_check.outputs.already_released == 'false'
        env:
          GH_TOKEN: ${{ github.token }}
          VERSION: ${{ steps.version_check.outputs.version }}
        run: |
          MAJOR="v${VERSION%%.*}"
          gh release create "v$VERSION" \
            --title "v$VERSION" \
            --generate-notes \
            --latest

          # Move the moving major tag (e.g. v1) to this release — the
          # convention every consumer's `uses: owner/action@v1` resolves
          # against. Plain mutable tag, not itself an immutable release.
          git tag -fa "$MAJOR" -m "Update $MAJOR to v$VERSION"
          git push origin "$MAJOR" --force

      - name: Skip (already released)
        if: steps.version_check.outputs.already_released == 'true'
        run: echo "v${{ steps.version_check.outputs.version }} already released — bump package.json's version to release."
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "ci: add release automation (tag + GitHub Release + major tag)"
```

---

## Task 7: zizmor, Scorecard, Dependabot

**Files:**
- Create: `.github/workflows/zizmor.yml`, `.github/workflows/scorecard.yml`, `.github/dependabot.yml`

- [ ] **Step 1: Write `.github/workflows/zizmor.yml`**

```yaml
name: zizmor

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]
  workflow_dispatch: {}

permissions: {}

jobs:
  zizmor:
    name: Static analysis of workflows
    runs-on: ubuntu-latest
    timeout-minutes: 5
    permissions:
      contents: read
      security-events: write
      actions: read
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - uses: zizmorcore/zizmor-action@3dc1ecc9bcb9e94e9b2c709687979e1298497054 # v0.6.2
```

- [ ] **Step 2: Write `.github/workflows/scorecard.yml`**

```yaml
name: Scorecard

on:
  push:
    branches: [main]
  schedule:
    - cron: "30 1 * * 6"
  workflow_dispatch: {}

permissions: read-all

jobs:
  analysis:
    name: Scorecard analysis
    runs-on: ubuntu-latest
    timeout-minutes: 10
    permissions:
      security-events: write
      id-token: write
      contents: read
      actions: read
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false

      - uses: ossf/scorecard-action@2d1146689b8cda280b9bc96326124645441f03bc # v2.4.4
        with:
          results_file: results.sarif
          results_format: sarif
          publish_results: true

      - uses: github/codeql-action/upload-sarif@d1ba80a13dd99fba24a470575428917156a28b43 # v4.37.5
        with:
          sarif_file: results.sarif
```

- [ ] **Step 3: Write `.github/dependabot.yml`**

```yaml
version: 2
updates:
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
    groups:
      github-actions:
        patterns: ["*"]
```

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/zizmor.yml .github/workflows/scorecard.yml .github/dependabot.yml
git commit -m "ci: add zizmor, Scorecard, and Dependabot for github-actions"
```

---

## Task 8: Push, verify CI, cut the v1.0.0 release

**Files:** none (operational task)

- [ ] **Step 1: Push to GitHub**

```bash
cd /Users/ashwinsathian/Documents/Personal/publish-to-booklet
git push -u origin main
```

- [ ] **Step 2: Watch CI**

```bash
gh run watch --exit-status $(gh run list --workflow=ci.yml --limit 1 --json databaseId --jq '.[0].databaseId')
```

Expected: `test` and `check-dist` jobs both succeed. If `check-dist` fails, run `npm run build` locally, commit the diff, push again.

- [ ] **Step 3: Confirm zizmor and Scorecard runs are green (or investigate findings)**

```bash
gh run list --workflow=zizmor.yml --limit 1
gh run list --workflow=scorecard.yml --limit 1
```

Any zizmor finding at this point is real — fix it before releasing rather than launching with a known finding.

- [ ] **Step 4: Cut the v1.0.0 release**

`package.json`'s version is already `1.0.0` from Task 1 — pushing it in Step 1 already triggered `release.yml`. Confirm it worked:

```bash
gh release view v1.0.0
git ls-remote --tags origin | grep -E 'refs/tags/(v1|v1\.0\.0)$'
```

Expected: `v1.0.0` release exists, `v1` tag points at the same commit.

- [ ] **Step 5: Mark it as an immutable release (Marketplace credibility signal)**

Via the GitHub web UI: **Releases → v1.0.0 → Edit release**, there's no immutability toggle exposed in the CLI as of this writing — if the repo has immutable releases available under **Settings → General → Immutable releases**, enable it there; new releases going forward will be immutable automatically. Note this for the user rather than attempting to script it — it's an account/repo-settings action, not a code change.

- [ ] **Step 6: List on the GitHub Marketplace**

This is the one step that cannot be scripted: on `github.com/AshwinSathian/publish-to-booklet/releases/new` (or editing the `v1.0.0` release), GitHub shows a "Publish this Action to the GitHub Marketplace" checkbox with category selection, gated on accepting the Marketplace Developer Agreement. Flag this to the user as the final manual step — do not attempt to call a REST endpoint for it.

---

## Task 9: Delete `packages/github-action` from the monorepo

**Files (in `booklet`):**
- Delete: `packages/github-action/` (entire directory)
- Modify: `.github/workflows/ci.yml`, `.gitignore`

- [ ] **Step 1: Delete the package**

```bash
cd /Users/ashwinsathian/Documents/Personal/booklet
git rm -r packages/github-action
```

- [ ] **Step 2: Remove it from `ci.yml`'s `typecheck-packages` matrix and delete the `github-action-dist-check` job**

In `.github/workflows/ci.yml`, change the matrix line:

```yaml
        package: [mcp-server, packages/shared, packages/cli, packages/vscode]
```

(removes `packages/github-action` from the list), and delete the entire `github-action-dist-check:` job block (from its `github-action-dist-check:` key through the end of its `run: |` step, right before `unit-tests:`).

- [ ] **Step 3: Remove the `packages/github-action/dist/` exception from `.gitignore`**

Delete these lines from `.gitignore`:

```
# Exception: packages/github-action/dist/ must be committed. Unlike the CLI
# (built fresh on `npm publish`) or the VS Code extension (built fresh on
# `vsce package`), a GitHub Action's runs.main path is executed directly
# from the checked-out repo — there is no build step GitHub Actions runs on
# your behalf. Without dist/main.js actually committed, the action fails
# with "file not found" for every single invocation. (Discovered during a
# verification pass: this had never been built or committed since the
# action was first added, so it had never actually worked.)
!packages/github-action/dist/
```

- [ ] **Step 4: Commit** (full `ci.yml` SHA-pinning/permissions/timeouts happens in Task 11 — this commit only removes the deleted package's references)

```bash
git add -A packages/github-action .github/workflows/ci.yml .gitignore
git commit -m "refactor: remove packages/github-action (extracted to AshwinSathian/publish-to-booklet)"
```

---

## Task 10: Update README and add a real Action-usage example

**Files (in `booklet`):**
- Modify: `README.md`
- Modify: `.github/examples/publish-to-booklet.yml`

- [ ] **Step 1: Update `README.md` line 46**

Change:
```markdown
- **GitHub Action**: publish docs in CI via `packages/github-action/`
```
to:
```markdown
- **GitHub Action**: publish docs in CI via [`AshwinSathian/publish-to-booklet`](https://github.com/AshwinSathian/publish-to-booklet)
```

- [ ] **Step 2: Update the repo tree (around line 199)**

Remove the line:
```
  github-action/    # GitHub Action: publish Markdown in CI
```
from the `packages/` block in the tree diagram (the action no longer lives in this repo).

- [ ] **Step 3: Update the "GitHub Actions" section (lines 209–224)**

Replace the `### Publish docs to Booklet from your repo` subsection's body with:

```markdown
### Publish docs to Booklet from your repo

Two ways: the [`AshwinSathian/publish-to-booklet`](https://github.com/AshwinSathian/publish-to-booklet) GitHub Action, or `booklet-cli` via `npx`. See [.github/examples/publish-to-booklet.yml](.github/examples/publish-to-booklet.yml) for both — copy it into your own repo's `.github/workflows/`, add a `BOOKLET_API_KEY` secret, and it publishes on every release.
```

- [ ] **Step 4: Rewrite `.github/examples/publish-to-booklet.yml`** to demonstrate the actual Action alongside the existing CLI example

```yaml
# Example: Publish a Markdown file to Booklet from a GitHub Action.
#
# Two ways to do this — pick one:
#   1. The `AshwinSathian/publish-to-booklet` Action (below, `publish` job) —
#      no npx/npm install needed, typed inputs/outputs.
#   2. booklet-cli via npx (the `publish-via-cli` job further down) — useful
#      if you're already scripting other CLI steps in the same job.
#
# Setup (either way):
#   1. Create an API key at https://booklet.ashwinsathian.com → My Pages → Settings → API Keys
#   2. Add it as a repo secret: Settings → Secrets → Actions → BOOKLET_API_KEY
#   3. Optionally add BOOKLET_PAGE_ID as a repo variable to update the same page each run.
#
# Usage:
#   - Copy this file to .github/workflows/ in your own repo.
#   - Delete whichever job you don't want, and adjust the `file`/trigger as needed.

name: Publish to Booklet

on:
  release:
    types: [published]
  # Or trigger on push:
  # push:
  #   branches: [main]
  #   paths: [CHANGELOG.md]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7

      - name: Publish to Booklet
        id: publish
        uses: AshwinSathian/publish-to-booklet@v1
        with:
          file: CHANGELOG.md
          api-key: ${{ secrets.BOOKLET_API_KEY }}
          page-id: ${{ vars.BOOKLET_PAGE_ID }}
          visibility: public

      - run: echo "Published at ${{ steps.publish.outputs.url }}"

  publish-via-cli:
    if: false # example only — flip to `if: true` (or delete the `publish` job above) to use this instead
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7

      - name: Publish to Booklet
        id: publish
        env:
          BOOKLET_API_KEY: ${{ secrets.BOOKLET_API_KEY }}
        run: |
          if [ -n "${{ vars.BOOKLET_PAGE_ID }}" ]; then
            npx booklet-cli publish CHANGELOG.md \
              --update ${{ vars.BOOKLET_PAGE_ID }}
          else
            npx booklet-cli publish CHANGELOG.md \
              --slug release-notes \
              --visibility public
          fi
```

- [ ] **Step 5: Commit**

```bash
git add README.md .github/examples/publish-to-booklet.yml
git commit -m "docs: point GitHub Action docs at AshwinSathian/publish-to-booklet"
```

---

## Task 11: Harden `ci.yml`

**Files (in `booklet`):**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Replace the full file** (this is the Task 9-modified version, now with SHA-pinned actions, a workflow-level `permissions: contents: read`, and `timeout-minutes` on every job)

```yaml
# CI gate for the Booklet monorepo.
#
# Runs on every pull request targeting main (and on push to main, so main
# itself always has a green build). Five jobs cover everything that can run
# without secrets this repo doesn't have in GitHub Actions:
#   - lint            eslint over the whole repo
#   - typecheck-root  tsc --noEmit for the Next.js app (src/**)
#   - typecheck-packages   tsc --noEmit for mcp-server + packages/* (excluded
#                          from the root tsconfig.json, so they need their own
#                          typecheck pass)
#   - build           next build with dummy NEXT_PUBLIC_* values (no server
#                     secret is read at build time — see comment below)
#   - unit-tests      tests/unit/** against a real MongoDB service container
#
# The full Playwright e2e suite (tests/e2e/) is intentionally NOT run here —
# see the e2e-manual job at the bottom for why and what it would take to
# enable it.
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]
  workflow_dispatch: {}

concurrency:
  group: ci-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

env:
  NODE_VERSION: "20"

# Every job here only reads the checked-out code — nothing pushes, tags, or
# writes issues/PRs, so a single repo-wide read-only grant covers all of it.
permissions:
  contents: read

jobs:
  lint:
    name: Lint
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version: ${{ env.NODE_VERSION }}
      - run: npm ci --prefer-offline
      - run: npm run lint

  typecheck-root:
    name: Typecheck (root)
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version: ${{ env.NODE_VERSION }}
      - run: npm ci --prefer-offline
      # "npm run test" is tsc --noEmit — see package.json
      - run: npm run test

  typecheck-packages:
    name: Typecheck (${{ matrix.package }})
    runs-on: ubuntu-latest
    timeout-minutes: 15
    strategy:
      fail-fast: false
      matrix:
        package: [mcp-server, packages/shared, packages/cli, packages/vscode]
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version: ${{ env.NODE_VERSION }}
      # npm workspaces (see PLAN-backend-auth-migration.md) — one root
      # lockfile/install covers every package; no more per-package
      # package-lock.json to `npm ci --prefix` against.
      - run: npm ci --prefer-offline
      # mcp-server/cli/vscode all import booklet-api-client (packages/shared)
      # — npm workspaces symlinks the *source* directory, but its
      # package.json's types/main/module fields point at dist/, which only
      # exists after packages/shared's own build runs. Skipping this step
      # fails every other package's typecheck with "Cannot find module
      # 'booklet-api-client'" (found live: this exact failure on the push
      # that introduced it).
      - run: npm run build --workspace packages/shared
      - run: npm run typecheck --workspace ${{ matrix.package }}

  build:
    name: Build
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version: ${{ env.NODE_VERSION }}
      # NODE_ENV must NOT be set here — `npm ci` respects NODE_ENV=production
      # by skipping devDependencies (e.g. @tailwindcss/postcss, needed by
      # Next.js's PostCSS/Turbopack pipeline at build time), which broke this
      # job on every push once NODE_ENV was set job-wide instead of scoped to
      # just the build step below.
      - run: npm ci --prefer-offline
      - run: npm run build
        env:
          NODE_ENV: production
          # Next.js only needs NEXT_PUBLIC_* vars at build time (they get
          # inlined into the client bundle). Every non-NEXT_PUBLIC_ var in
          # .env.example (MONGODB_URI, INVITE_JWT_SECRET, UNLOCK_TOKEN_SECRET,
          # SESSION_TOKEN_PEPPER, CLAIM_TOKEN_SECRET, ADMIN_IPS,
          # ADMIN_USER_IDS, API_KEY_PEPPER, READABLE_WEBHOOK_SECRET) is read
          # lazily inside function bodies at request time (src/lib/mongodb.ts,
          # src/lib/unlock-token.ts, src/lib/invite-token.ts,
          # src/lib/auth/session-token.ts, src/middleware.ts,
          # src/lib/api-key.ts, etc.) — none of it is touched during
          # `next build`/generateStaticParams, so none of it is needed here.
          NEXT_PUBLIC_SITE_URL: http://localhost:3100

  unit-tests:
    name: Unit tests (real MongoDB)
    runs-on: ubuntu-latest
    timeout-minutes: 15
    services:
      mongodb:
        image: mongo:7
        ports:
          - 27017:27017
        options: >-
          --health-cmd "mongosh --eval 'db.adminCommand({ ping: 1 })' --quiet"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 6
    env:
      # Same URI shape as .env.example / src/lib/mongodb.ts, pointed at the
      # service container instead of a locally brew-installed mongod.
      MONGODB_URI: "mongodb://localhost:27017/readable?retryWrites=true&w=majority"
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version: ${{ env.NODE_VERSION }}
      - run: npm ci --prefer-offline
      # tests/unit/** run via @playwright/test as a plain Node test runner —
      # no browser is launched, so no `playwright install` step is needed.
      - run: npm run test:unit

  # ── Full Playwright e2e suite — NOT part of the required PR gate ────────────
  # tests/e2e/happy-paths.spec.ts and tests/e2e/unit/safe-redirect.spec.ts
  # drive a live `next start` instance through real sign-in/sign-up flows
  # (in-house auth — see PLAN-backend-auth-migration.md). Deliberately still
  # workflow_dispatch-only (not a required PR gate) — full browser e2e on
  # every push is a real time/flake-risk tradeoff a solo maintainer may not
  # want, so that stays an explicit choice rather than something this fix
  # silently opts into. To make it a required check: change `if:` below to
  # `pull_request`/`push`.
  #
  # The crypto secrets (INVITE_JWT_SECRET etc.) are dedicated CI-only values,
  # unrelated to and not reused from production's — this job's MongoDB is a
  # throwaway per-run service container (same pattern as unit-tests), so
  # there is no real data at stake here regardless.
  e2e-manual:
    name: E2E (manual — needs Mongo + secret env vars)
    if: github.event_name == 'workflow_dispatch'
    runs-on: ubuntu-latest
    timeout-minutes: 20
    services:
      mongodb:
        image: mongo:7
        ports:
          - 27017:27017
        options: >-
          --health-cmd "mongosh --eval 'db.adminCommand({ ping: 1 })' --quiet"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 6
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version: ${{ env.NODE_VERSION }}
      - run: npm ci --prefer-offline
      - run: npx playwright install --with-deps chromium
      - run: npm run build
        env:
          NODE_ENV: production
          NEXT_PUBLIC_SITE_URL: http://localhost:3100
      - run: npm start &
        env:
          PORT: "3100"
          MONGODB_URI: "mongodb://localhost:27017/readable?retryWrites=true&w=majority"
          INVITE_JWT_SECRET: ${{ secrets.INVITE_JWT_SECRET }}
          UNLOCK_TOKEN_SECRET: ${{ secrets.UNLOCK_TOKEN_SECRET }}
          API_KEY_PEPPER: ${{ secrets.API_KEY_PEPPER }}
          SESSION_TOKEN_PEPPER: ${{ secrets.SESSION_TOKEN_PEPPER }}
          CLAIM_TOKEN_SECRET: ${{ secrets.CLAIM_TOKEN_SECRET }}
      - name: Wait for server to be ready
        run: |
          for i in $(seq 1 30); do
            curl -sf http://localhost:3100 >/dev/null && exit 0
            sleep 1
          done
          echo "Server did not become ready in time" >&2
          exit 1
      - run: npx playwright test --config=playwright.config.ts
        env:
          TEST_BASE_URL: http://localhost:3100
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: pin actions to SHAs, add permissions blocks and timeouts"
```

---

## Task 12: Harden `publish-cli.yml` and `publish-shared.yml`, add npm OIDC readiness

**Files (in `booklet`):**
- Modify: `.github/workflows/publish-cli.yml`, `.github/workflows/publish-shared.yml`

- [ ] **Step 1: Replace `.github/workflows/publish-cli.yml`**

```yaml
# Publishes booklet-cli to npm when packages/cli/package.json version changes on main.
# Trigger: push to main that touches packages/cli/, OR manual dispatch.
#
# Publishes via npm Trusted Publishing (OIDC) when a Trusted Publisher is
# configured for booklet-cli on npmjs.com — no long-lived token needed, and
# npm attaches a provenance attestation automatically. Until that's
# configured, NPM_TOKEN below is the fallback (npm uses it if no matching
# trusted-publisher OIDC context is found). Once you've confirmed a real
# publish went through via OIDC (npm's publish log line says so), delete the
# NPM_TOKEN secret and the NODE_AUTH_TOKEN env below in a follow-up commit.
#
# Required secret (until OIDC cutover): NPM_TOKEN — a Granular Access Token with:
#   - Read and write on "All packages"
#   - "Allow this token to bypass two-factor authentication" enabled
#
# Add it at: repo → Settings → Secrets → Actions → NPM_TOKEN

name: Publish CLI to npm

on:
  push:
    branches: [main]
    paths:
      - "packages/cli/package.json"
      - "packages/cli/src/**"
  workflow_dispatch:

permissions: {}

jobs:
  publish:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    permissions:
      contents: read
      id-token: write # npm Trusted Publishing (OIDC) — see comment above

    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1

      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version: "22"
          registry-url: "https://registry.npmjs.org"

      # npm Trusted Publishing requires npm >=11.5.1 — Node 22's bundled npm
      # may be older, so pin it explicitly rather than relying on whatever
      # setup-node's Node build shipped with.
      - name: Ensure npm >= 11.5.1 (required for Trusted Publishing)
        run: npm install -g npm@^11

      # npm workspaces (see PLAN-backend-auth-migration.md) — install from
      # the repo root; there's no packages/cli/package-lock.json anymore.
      - name: Install dependencies
        run: npm ci

      # packages/cli bundles booklet-api-client (packages/shared) at build
      # time — the workspace symlink points at its *source*, and its
      # package.json's main/types fields point at dist/, which only exists
      # once packages/shared has been built. Skipping this step fails the
      # CLI's tsup build with "Could not resolve booklet-api-client"
      # (found live: this exact failure the first time this workflow ran
      # after packages/shared was introduced).
      - name: Build shared client
        run: npm run build --workspace packages/shared

      - name: Build
        run: npm run build --workspace packages/cli

      - name: Check if version already published
        id: version_check
        working-directory: packages/cli
        run: |
          PKG_VERSION=$(node -p "require('./package.json').version")
          echo "version=$PKG_VERSION" >> $GITHUB_OUTPUT
          if npm view booklet-cli@$PKG_VERSION version 2>/dev/null; then
            echo "already_published=true" >> $GITHUB_OUTPUT
          else
            echo "already_published=false" >> $GITHUB_OUTPUT
          fi

      - name: Publish to npm
        if: steps.version_check.outputs.already_published == 'false'
        run: npm publish --workspace packages/cli
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

      - name: Skip (already published)
        if: steps.version_check.outputs.already_published == 'true'
        run: echo "booklet-cli@${{ steps.version_check.outputs.version }} already on npm — bump version to publish."
```

- [ ] **Step 2: Replace `.github/workflows/publish-shared.yml`**

```yaml
# Publishes booklet-api-client to npm when packages/shared/package.json
# version changes on main. Mirrors publish-cli.yml's pattern exactly,
# including the npm Trusted Publishing (OIDC) migration path — see that
# file's header comment for the NPM_TOKEN → OIDC cutover sequencing.
#
# Trigger: push to main that touches packages/shared/, OR manual dispatch.
#
# Required secret (until OIDC cutover): NPM_TOKEN — same Granular Access Token used by
# publish-cli.yml (Read and write on "All packages").

name: Publish shared client to npm

on:
  push:
    branches: [main]
    paths:
      - "packages/shared/package.json"
      - "packages/shared/src/**"
  workflow_dispatch:

permissions: {}

jobs:
  publish:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    permissions:
      contents: read
      id-token: write # npm Trusted Publishing (OIDC) — see publish-cli.yml

    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1

      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version: "22"
          registry-url: "https://registry.npmjs.org"

      - name: Ensure npm >= 11.5.1 (required for Trusted Publishing)
        run: npm install -g npm@^11

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build --workspace packages/shared

      - name: Check if version already published
        id: version_check
        working-directory: packages/shared
        run: |
          PKG_VERSION=$(node -p "require('./package.json').version")
          echo "version=$PKG_VERSION" >> $GITHUB_OUTPUT
          if npm view booklet-api-client@$PKG_VERSION version 2>/dev/null; then
            echo "already_published=true" >> $GITHUB_OUTPUT
          else
            echo "already_published=false" >> $GITHUB_OUTPUT
          fi

      - name: Publish to npm
        if: steps.version_check.outputs.already_published == 'false'
        run: npm publish --workspace packages/shared
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}

      - name: Skip (already published)
        if: steps.version_check.outputs.already_published == 'true'
        run: echo "booklet-api-client@${{ steps.version_check.outputs.version }} already on npm — bump version to publish."
```

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/publish-cli.yml .github/workflows/publish-shared.yml
git commit -m "ci: pin actions, add permissions, wire npm OIDC readiness for npm publish workflows"
```

---

## Task 13: Harden `publish-vscode.yml`

**Files (in `booklet`):**
- Modify: `.github/workflows/publish-vscode.yml`

- [ ] **Step 1: Replace the file**

```yaml
# Publishes the Booklet VS Code extension to the Marketplace when
# packages/vscode/package.json's version changes on main.
# Trigger: push to main that touches packages/vscode/, OR manual dispatch.
#
# Required secret: VSCE_PAT — a VS Code Marketplace Personal Access Token
# for the "AshwinSathian" publisher, created at https://dev.azure.com under
# User Settings → Personal Access Tokens, scoped to
# "Marketplace (Manage)" on the Azure DevOps org tied to that publisher.
# See https://code.visualstudio.com/api/working-with-extensions/publishing-extension
#
# Add it at: repo → Settings → Secrets → Actions → VSCE_PAT
#
# Until that secret exists, this workflow intentionally no-ops on the
# publish step (see "VSCE_PAT not configured" below) instead of failing —
# the publisher account is a manual, one-time setup only the account owner
# can do, so a red X here on every push touching packages/vscode would just
# be permanent noise nobody could act on from inside a workflow run.
#
# FOLLOW-UP (not done in this pass): Azure DevOps retires classic
# org-scoped PATs on 2026-12-01, which will break this VSCE_PAT flow.
# @vscode/vsce >=3.9.2 supports an Azure-OIDC alternative
# (`--azure-credential`), but as of this writing it's documented for Azure
# Pipelines + managed identity, not individual publishers authenticating
# from GitHub Actions — revisit before the retirement date.

name: Publish VS Code Extension

on:
  push:
    branches: [main]
    paths:
      - "packages/vscode/package.json"
      - "packages/vscode/src/**"
  workflow_dispatch:

permissions: {}

jobs:
  publish:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    permissions:
      contents: read
    env:
      VSCE_PAT: ${{ secrets.VSCE_PAT }}

    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1

      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version: "20"

      # npm workspaces — install from the repo root; there's no
      # packages/vscode/package-lock.json.
      - name: Install dependencies
        run: npm ci

      # packages/vscode bundles booklet-api-client (packages/shared) at
      # build time — the workspace symlink points at its *source*, and its
      # package.json's main/types fields point at dist/, which only exists
      # once packages/shared has been built.
      - name: Build shared client
        run: npm run build --workspace packages/shared

      - name: Typecheck
        run: npm run typecheck --workspace packages/vscode

      - name: Check if version already published
        id: version_check
        working-directory: packages/vscode
        run: |
          PKG_VERSION=$(node -p "require('./package.json').version")
          echo "version=$PKG_VERSION" >> $GITHUB_OUTPUT
          PUBLISHED=$(npx vsce show AshwinSathian.booklet-vscode --json 2>/dev/null | node -p "try{JSON.parse(require('fs').readFileSync(0,'utf8')).versions[0].version}catch{''}" || true)
          if [ "$PUBLISHED" = "$PKG_VERSION" ]; then
            echo "already_published=true" >> $GITHUB_OUTPUT
          else
            echo "already_published=false" >> $GITHUB_OUTPUT
          fi

      - name: VSCE_PAT not configured
        if: steps.version_check.outputs.already_published == 'false' && env.VSCE_PAT == ''
        run: echo "::warning::VSCE_PAT secret is not set — skipping publish. See the comment at the top of this workflow for setup steps."

      - name: Publish to VS Code Marketplace
        if: steps.version_check.outputs.already_published == 'false' && env.VSCE_PAT != ''
        working-directory: packages/vscode
        run: npx vsce publish --no-dependencies -p "$VSCE_PAT"

      - name: Skip (already published)
        if: steps.version_check.outputs.already_published == 'true'
        run: echo "AshwinSathian.booklet-vscode@${{ steps.version_check.outputs.version }} already on the Marketplace — bump version to publish."
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/publish-vscode.yml
git commit -m "ci: pin actions, add permissions/timeout, flag VSCE_PAT retirement for publish-vscode.yml"
```

---

## Task 14: Add zizmor, Scorecard, Dependabot to the monorepo

**Files (in `booklet`):**
- Create: `.github/workflows/zizmor.yml`, `.github/workflows/scorecard.yml`, `.github/dependabot.yml`

- [ ] **Step 1: Write `.github/workflows/zizmor.yml`**

```yaml
name: zizmor

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]
  workflow_dispatch: {}

permissions: {}

jobs:
  zizmor:
    name: Static analysis of workflows
    runs-on: ubuntu-latest
    timeout-minutes: 5
    permissions:
      contents: read
      security-events: write
      actions: read
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - uses: zizmorcore/zizmor-action@3dc1ecc9bcb9e94e9b2c709687979e1298497054 # v0.6.2
```

- [ ] **Step 2: Write `.github/workflows/scorecard.yml`**

```yaml
name: Scorecard

on:
  push:
    branches: [main]
  schedule:
    - cron: "30 1 * * 6"
  workflow_dispatch: {}

permissions: read-all

jobs:
  analysis:
    name: Scorecard analysis
    runs-on: ubuntu-latest
    timeout-minutes: 10
    permissions:
      security-events: write
      id-token: write
      contents: read
      actions: read
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          persist-credentials: false

      - uses: ossf/scorecard-action@2d1146689b8cda280b9bc96326124645441f03bc # v2.4.4
        with:
          results_file: results.sarif
          results_format: sarif
          publish_results: true

      - uses: github/codeql-action/upload-sarif@d1ba80a13dd99fba24a470575428917156a28b43 # v4.37.5
        with:
          sarif_file: results.sarif
```

- [ ] **Step 3: Write `.github/dependabot.yml`**

```yaml
version: 2
updates:
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
    groups:
      github-actions:
        patterns: ["*"]
```

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/zizmor.yml .github/workflows/scorecard.yml .github/dependabot.yml
git commit -m "ci: add zizmor, Scorecard, and Dependabot for github-actions"
```

---

## Task 15: Full verification and push

**Files:** none (verification task)

- [ ] **Step 1: Lint and typecheck the monorepo**

```bash
cd /Users/ashwinsathian/Documents/Personal/booklet
npm run lint
npm run test   # root typecheck
npm run build --workspace packages/shared
for pkg in mcp-server packages/shared packages/cli packages/vscode; do
  npm run typecheck --workspace "$pkg"
done
```

Expected: all succeed. Note `packages/github-action` is intentionally absent from this loop — it no longer exists.

- [ ] **Step 2: Confirm the deleted package left no dangling references**

```bash
grep -rn "packages/github-action" --include="*.md" --include="*.yml" --include="*.yaml" --include="*.json" . 2>/dev/null | grep -v node_modules
```

Expected: no output (or only historical mentions inside `docs/superpowers/specs/` design docs, which are fine to leave — they're dated records, not live references).

- [ ] **Step 3: Review the full diff before committing anything left uncommitted**

```bash
git status
git diff --stat
```

Confirm nothing unexpected is staged/unstaged beyond this plan's changes — in particular, do not touch the pre-existing unrelated `docs/superpowers/plans/2026-08-04-cli-hardening.md` file if it's still present and untracked/uncommitted from other work.

- [ ] **Step 4: Push**

```bash
git push origin main
```

- [ ] **Step 5: Watch the monorepo's CI**

```bash
gh run watch --exit-status $(gh run list --workflow=ci.yml --repo AshwinSathian/booklet --limit 1 --json databaseId --jq '.[0].databaseId')
```

Expected: green. If `zizmor.yml` or `scorecard.yml` surface findings, triage them — a finding in a newly-added scanning workflow is real signal, not noise to suppress.

---

## Self-review notes

- **Spec coverage:** every numbered section of the design doc (`docs/superpowers/specs/2026-08-04-github-action-publish-design.md`) maps to a task above — §1 → Tasks 1–4, §2 → Task 6/8, §3 → Tasks 5–7, §4 → Tasks 9–10, §5 → Tasks 11–14, §6 (out of scope) has no task, correctly.
- **Type consistency:** `RunDeps`, `isValidVisibility`, `run()` signatures introduced in Task 2 are used identically in Task 2's own tests and referenced (not redefined) by every later task that touches `src/main.ts`.
- **Manual steps called out explicitly** (Task 8 Steps 5–6) rather than glossed over — Marketplace listing and immutable-release toggling are not scriptable from inside a plan step.
