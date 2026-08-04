# Booklet CLI Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring `packages/cli` (`booklet-cli`) up to current CLI standards (clig.dev) and 2026 npm
supply-chain practice before its next publish — fix three real bugs, add OS-keychain-backed
credential storage with file fallback, migrate to npm Trusted Publishing, and close the clig.dev
UX gaps identified in the design spec.

**Architecture:** Additive changes to an already-working Commander.js CLI. The one structural
change is credential storage: `config.ts` gains a keychain-first/file-fallback precedence chain,
backed by a new `keychain.ts` wrapper around `@napi-rs/keyring` that's injectable for testing (a
`KeychainBackend` interface, not a mocked module) so unit tests never touch a real OS keychain.
Everything else is independent, additive command/flag surface plus one CI workflow change.

**Tech Stack:** TypeScript, Commander.js, tsup (bundler), `@napi-rs/keyring` (new), Playwright's
test runner used as a plain Node/TS test runner (existing repo convention, see
`playwright.unit.config.ts`).

## Global Constraints

- Design spec: `docs/superpowers/specs/2026-08-04-cli-hardening-design.md` — every task below
  implements a section of it. Re-read it if a task's rationale is unclear.
- Node engines floor for `packages/cli` stays `>=18.0.0` (unchanged; `@napi-rs/keyring` only
  requires `>=10`, no conflict).
- No new test framework — tests go in `tests/unit/*.spec.ts` at the repo root, run via the
  existing `playwright.unit.config.ts` (`npm run test:unit`). No per-package test setup.
- `NO_COLOR` env var and TTY detection behavior in `fmt.ts` must keep working exactly as today —
  only additive (`--no-color` flag) on top.
- Every command's existing flags, output shapes, and exit-on-failure behavior for cases not
  explicitly listed in the design spec are unchanged — this is a hardening pass, not a rewrite.
- After every task, run `npm run typecheck --workspace packages/cli` — the CLI is excluded from
  the root `tsconfig.json` (`exclude: ["packages"]`), so root `npm run test` (root `tsc --noEmit`)
  does **not** catch CLI type errors; only the package-scoped typecheck does.

---

### Task 1: Async-safe entrypoint, top-level error handling, LICENSE file

Fixes bugs #2 (`program.parse()` vs async actions → unhandled rejections) and #3 (missing LICENSE
in the published tarball) from the design spec. Independent of every other task.

**Files:**
- Modify: `packages/cli/src/index.ts` (currently 20 lines, full file below)
- Create: `packages/cli/LICENSE` (copy of root `LICENSE`, same MIT text)

**Interfaces:**
- Produces: nothing consumed by later tasks — this is a leaf fix.

- [ ] **Step 1: Replace `packages/cli/src/index.ts`**

```ts
import { Command } from "commander";
import { registerAuthCommands } from "./commands/auth.js";
import { registerPublishCommand } from "./commands/publish.js";
import { registerPagesCommand } from "./commands/pages.js";
import { BookletApiError } from "./api.js";
import { error, setNoColor } from "./fmt.js";

declare const __CLI_VERSION__: string;

const REPO_URL = "https://github.com/AshwinSathian/booklet";

const program = new Command();

program
  .name("booklet")
  .description("Publish Markdown pages from your terminal")
  .version(__CLI_VERSION__)
  .option("--no-color", "Disable colored output");

program.hook("preAction", (thisCommand) => {
  setNoColor(thisCommand.opts().color === false);
});

registerAuthCommands(program);
registerPublishCommand(program);
registerPagesCommand(program);

async function main() {
  try {
    await program.parseAsync(process.argv);
  } catch (err) {
    // Commander's own usage errors (unknown command/option, missing
    // argument) already print their own message and throw — nothing
    // further to add for those. Anything else here is either an expected
    // BookletApiError that slipped past a command's own try/catch, or a
    // genuine bug.
    if (err instanceof BookletApiError) {
      error(err.message);
      process.exit(1);
    }
    if (err && typeof err === "object" && "code" in err && typeof err.code === "string" && err.code.startsWith("commander.")) {
      // Commander already printed its own message; just set the exit code.
      process.exit(2);
    }
    error(err instanceof Error ? err.message : String(err));
    console.error(`\nThis looks like a bug. Please report it: ${REPO_URL}/issues`);
    process.exit(1);
  }
}

main();
```

Note: `setNoColor` doesn't exist in `fmt.ts` yet — Task 2 adds it. This task can still be done
first if you stub `setNoColor` as a no-op export in this step and let Task 2 replace it, **or**
simply do Task 2 before this one. Either order works since the two files don't otherwise overlap;
the plan lists Task 1 first only because it's the more fundamental bug fix. If doing Task 1 first,
add this minimal placeholder to the bottom of `fmt.ts` for now (Task 2 will replace the whole
file anyway):

```ts
export function setNoColor(_value: boolean): void {}
```

- [ ] **Step 2: Copy the LICENSE into the package**

```bash
cp LICENSE packages/cli/LICENSE
```

- [ ] **Step 3: Verify**

```bash
npm run build --workspace packages/shared
npm run build --workspace packages/cli
npm run typecheck --workspace packages/cli
node packages/cli/dist/index.js --help
```
Expected: help text prints normally, no errors. Then force the new error path to prove it works:

```bash
node -e "
const { spawnSync } = require('child_process');
const r = spawnSync('node', ['packages/cli/dist/index.js', 'pages', 'open', 'nonexistent-id'], {
  env: { ...process.env, BOOKLET_API_KEY: 'bklt_fake', BOOKLET_API_URL: 'http://127.0.0.1:1' },
  encoding: 'utf8',
});
console.log('exit code:', r.status);
console.log(r.stdout, r.stderr);
"
```
Expected: a clean `✗ Network error: ...` line (from the existing per-command try/catch in
`pages.ts`, unaffected by this change) and a non-zero exit — not a raw stack trace. This confirms
`parseAsync` is correctly awaiting the async action and errors are reaching a clean exit path.

Then confirm the LICENSE will actually publish:
```bash
npm pack --dry-run --workspace packages/cli
```
Expected: `Tarball Contents` includes `LICENSE`.

- [ ] **Step 4: Commit**

```bash
git add packages/cli/src/index.ts packages/cli/LICENSE
git commit -m "fix(cli): use parseAsync for clean async error handling; ship LICENSE in tarball"
```

---

### Task 2: `--no-color` flag in `fmt.ts`

TDD. Independent of every other task except that Task 1's `index.ts` calls `setNoColor` — do this
task before or after Task 1, just make sure both land before you consider the CLI done.

**Files:**
- Modify: `packages/cli/src/fmt.ts` (currently 71 lines, full file below)
- Test: `tests/unit/cli-fmt.spec.ts` (new)

**Interfaces:**
- Produces: `setNoColor(value: boolean): void` — called by `index.ts`'s `preAction` hook
  (Task 1). All the existing exports (`dim`, `bold`, `green`, `red`, `yellow`, `cyan`, `gray`,
  `success`, `info`, `warn`, `error`, `table`, `openUrl`) keep their exact current signatures.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/cli-fmt.spec.ts`:

```ts
import { test, expect } from "@playwright/test";
import { bold, setNoColor } from "../../packages/cli/src/fmt";

// fmt.ts's own NO_COLOR/TTY check already disables color when stdout isn't
// a TTY (true for this test runner), so these tests exercise setNoColor()
// directly rather than relying on that — they'd pass even with a broken
// setNoColor if we didn't force color on first.

test.describe("setNoColor", () => {
  test("forcing color off strips ANSI codes even if nothing else would", () => {
    setNoColor(true);
    expect(bold("hello")).toBe("hello");
  });

  test("un-forcing lets the normal NO_COLOR/TTY check decide again", () => {
    setNoColor(true);
    setNoColor(false);
    // stdout is not a TTY under the test runner, so this still comes out
    // plain — the point of this test is that setNoColor(false) doesn't
    // throw or leave stale state, not that colors literally appear here.
    expect(bold("hello")).toBe("hello");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx playwright test --config=playwright.unit.config.ts cli-fmt
```
Expected: FAIL — `setNoColor` is not exported from `fmt.ts`.

- [ ] **Step 3: Replace `packages/cli/src/fmt.ts`**

```ts
import { exec } from "node:child_process";

export function openUrl(url: string): void {
  // On Windows, `start` treats the first quoted arg as the window title,
  // so an empty title string must precede the URL.
  const cmd =
    process.platform === "darwin" ? `open "${url}"`
    : process.platform === "win32" ? `start "" "${url}"`
    : `xdg-open "${url}"`;
  exec(cmd, () => { /* fire and forget */ });
}

// ANSI colour helpers — fall back gracefully when NO_COLOR is set, stdout
// isn't a TTY, or the --no-color flag was passed (set via setNoColor()
// from index.ts's preAction hook, since Commander only finishes parsing
// global flags after this module is first imported).
let forcedNoColor = false;

export function setNoColor(value: boolean): void {
  forcedNoColor = value;
}

function colorDisabled(): boolean {
  return forcedNoColor || Boolean(process.env.NO_COLOR) || !process.stdout.isTTY;
}

const c = (code: number, s: string) => (colorDisabled() ? s : `\x1b[${code}m${s}\x1b[0m`);

export const dim = (s: string) => c(2, s);
export const bold = (s: string) => c(1, s);
export const green = (s: string) => c(32, s);
export const red = (s: string) => c(31, s);
export const yellow = (s: string) => c(33, s);
export const cyan = (s: string) => c(36, s);
export const gray = (s: string) => c(90, s);

export function success(msg: string) {
  console.log(`${green("✓")} ${msg}`);
}

export function info(msg: string) {
  console.log(`${cyan("→")} ${msg}`);
}

export function warn(msg: string) {
  console.warn(`${yellow("!")} ${msg}`);
}

export function error(msg: string) {
  console.error(`${red("✗")} ${msg}`);
}

type Row = (string | number | null | undefined)[];

export function table(headers: string[], rows: Row[]) {
  if (rows.length === 0) {
    console.log(dim("(no results)"));
    return;
  }

  // Compute column widths
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => String(r[i] ?? "").length)),
  );

  const divider = widths.map((w) => "─".repeat(w + 2)).join("┼");
  const pad = (s: string, w: number) => s + " ".repeat(Math.max(0, w - s.length));

  const headerRow = widths
    .map((w, i) => ` ${bold(pad(headers[i], w))} `)
    .join("│");
  const dataRows = rows.map((row) =>
    widths.map((w, i) => ` ${pad(String(row[i] ?? ""), w)} `).join("│"),
  );

  console.log(headerRow);
  console.log(dim(divider));
  for (const row of dataRows) {
    console.log(row);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx playwright test --config=playwright.unit.config.ts cli-fmt
```
Expected: PASS (2 tests).

- [ ] **Step 5: Typecheck and commit**

```bash
npm run typecheck --workspace packages/cli
git add packages/cli/src/fmt.ts tests/unit/cli-fmt.spec.ts
git commit -m "feat(cli): add --no-color support to fmt.ts, TDD'd"
```

---

### Task 3: `keychain.ts` backend + build/dependency wiring

Adds the injectable keychain abstraction and makes `@napi-rs/keyring` a real dependency. No
behavior change yet — nothing calls this module until Task 4.

**Files:**
- Create: `packages/cli/src/keychain.ts`
- Modify: `packages/cli/package.json` (add dependency)
- Modify: `packages/cli/tsup.config.ts` (mark it external, fix the stale "zero deps" comment)

**Interfaces:**
- Produces: `KeychainBackend` type (`get(): Promise<string | null>`, `set(key: string):
  Promise<boolean>`, `clear(): Promise<void>`) and `osKeychain: KeychainBackend` — both consumed
  by Task 4's `config.ts`.

- [ ] **Step 1: Add the dependency**

```bash
npm install @napi-rs/keyring@^1.3.0 --workspace packages/cli --save
```

This adds `@napi-rs/keyring` to `packages/cli/package.json`'s `dependencies` (currently `{}`) and
updates the root `package-lock.json`. Verify by reading `packages/cli/package.json` — it should
now show:
```json
  "dependencies": {
    "@napi-rs/keyring": "^1.3.0"
  },
```

- [ ] **Step 2: Create `packages/cli/src/keychain.ts`**

```ts
import { AsyncEntry } from "@napi-rs/keyring";

const SERVICE = "booklet-cli";
const ACCOUNT = "default";

// Reads time out fast so a wedged keyring daemon (or a headless Linux box
// with no Secret Service running) never hangs a routine command — every
// command that needs auth calls getApiKey(), which reads the keychain.
// Writes during `login`/`logout` do not get a timeout: macOS may show a
// one-time Keychain access prompt for an unsigned binary, and that
// legitimately needs to wait on the user, not time out mid-prompt.
const READ_TIMEOUT_MS = 3000;

export type KeychainBackend = {
  get(): Promise<string | null>;
  set(key: string): Promise<boolean>;
  clear(): Promise<void>;
};

/**
 * Real OS keychain backend (macOS Keychain, Windows Credential Manager,
 * Linux Secret Service via @napi-rs/keyring). Every method swallows its
 * own errors — "no backend available" and "nothing stored" are both
 * ordinary, expected outcomes here, never a hard failure. config.ts is
 * responsible for falling back to the file-based store when get()/set()
 * report unavailability.
 */
export const osKeychain: KeychainBackend = {
  async get() {
    try {
      const entry = new AsyncEntry(SERVICE, ACCOUNT);
      const value = await entry.getPassword(AbortSignal.timeout(READ_TIMEOUT_MS));
      return value ?? null;
    } catch {
      return null;
    }
  },

  async set(key: string) {
    try {
      const entry = new AsyncEntry(SERVICE, ACCOUNT);
      await entry.setPassword(key);
      return true;
    } catch {
      return false;
    }
  },

  async clear() {
    try {
      const entry = new AsyncEntry(SERVICE, ACCOUNT);
      await entry.deleteCredential();
    } catch {
      /* nothing stored, or no backend available — either way, nothing to do */
    }
  },
};
```

- [ ] **Step 3: Update `packages/cli/tsup.config.ts`**

```ts
import { defineConfig } from "tsup";
import { readFileSync } from "node:fs";

const { version } = JSON.parse(
  readFileSync(new URL("./package.json", import.meta.url), "utf8"),
) as { version: string };

export default defineConfig({
  entry: ["src/index.ts"],
  // CJS is correct for a CLI binary: native require() works for all deps including
  // CJS packages like commander. ESM + noExternal breaks because bundled CJS code
  // calls require("events") which throws in ESM context without a real require shim.
  format: ["cjs"],
  target: "node18",
  platform: "node",
  outDir: "dist",
  clean: true,
  bundle: true,
  splitting: false,
  minify: false,
  sourcemap: false,
  dts: false,
  // Bundle pure-JS deps into the output for a single-file CLI. @napi-rs/keyring
  // is a native (napi/Rust) binding — it ships a .node file per platform and
  // cannot be bundled into one JS file, so it stays a real npm dependency
  // (external) and is installed normally alongside its platform-specific
  // optionalDependencies, the same pattern esbuild/sharp use. Everything else
  // still bundles, so this is no longer a literal zero-runtime-dependency
  // package, but it is still a single JS entrypoint plus one native addon.
  noExternal: ["commander", "booklet-api-client", "zod"],
  external: ["@napi-rs/keyring"],
  banner: {
    js: "#!/usr/bin/env node",
  },
  define: {
    __CLI_VERSION__: JSON.stringify(version),
  },
});
```

- [ ] **Step 4: Verify**

```bash
npm run build --workspace packages/shared
npm run build --workspace packages/cli
npm run typecheck --workspace packages/cli
node -e "require('./packages/cli/dist/index.js')" -- --version
```
Expected: build succeeds, `dist/index.js` still runs (nothing calls `keychain.ts` yet, so this is
just confirming the build/bundle change itself didn't break anything).

- [ ] **Step 5: Commit**

```bash
git add packages/cli/package.json packages/cli/package-lock.json packages/cli/tsup.config.ts packages/cli/src/keychain.ts package-lock.json
git commit -m "feat(cli): add @napi-rs/keyring backend for OS keychain credential storage"
```
(If there's no `packages/cli/package-lock.json` — this repo uses npm workspaces with a single
root lockfile — just add `package-lock.json` at the root instead; check with `git status` which
lockfile path actually changed.)

---

### Task 4: `config.ts` credential precedence rewrite

TDD, using dependency injection (the `KeychainBackend` interface from Task 3) instead of module
mocking — tests pass a fake backend object, no real keychain is ever touched.

**Files:**
- Modify: `packages/cli/src/config.ts` (currently 54 lines, full file below)
- Test: `tests/unit/cli-config.spec.ts` (new)

**Interfaces:**
- Consumes: `KeychainBackend`, `osKeychain` from `packages/cli/src/keychain.ts` (Task 3).
- Produces: `getApiKey(backend?: KeychainBackend): Promise<string | null>`,
  `getApiKeySource(backend?: KeychainBackend): Promise<"env" | "keychain" | "file" | null>`,
  `setApiKey(key: string, backend?: KeychainBackend): Promise<void>`,
  `clearApiKey(backend?: KeychainBackend): Promise<void>`, `getApiBase(): Promise<string>`
  (unchanged), `readConfig`/`writeConfig`/`DEFAULT_API_BASE`/`Config` type (unchanged). All
  consumed by Task 5's `auth.ts` rewrite.

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/cli-config.spec.ts`. This test suite points `HOME`/`homedir()`-derived paths at
a fresh temp directory per test (since `config.ts` reads `homedir()` at module-load time via
`join(homedir(), ".booklet")`, these tests set `process.env.HOME` — and on Windows `USERPROFILE`
— before each test and re-import the module fresh isn't necessary because `homedir()` and `join`
are called *inside* each function, not cached at module scope — confirm this holds after Step 3).

```ts
import { test, expect } from "@playwright/test";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import type { KeychainBackend } from "../../packages/cli/src/keychain";
import {
  getApiKey,
  getApiKeySource,
  setApiKey,
  clearApiKey,
  readConfig,
  DEFAULT_API_BASE,
} from "../../packages/cli/src/config";

function fakeBackend(initial: string | null = null): KeychainBackend & { stored: string | null } {
  return {
    stored: initial,
    async get() {
      return this.stored;
    },
    async set(key: string) {
      this.stored = key;
      return true;
    },
    async clear() {
      this.stored = null;
    },
  };
}

function unavailableBackend(): KeychainBackend {
  return {
    async get() {
      return null;
    },
    async set() {
      return false; // simulates "no backend available"
    },
    async clear() {
      /* no-op */
    },
  };
}

test.describe("config.ts credential precedence", () => {
  let home: string;
  const originalHome = process.env.HOME;
  const originalEnvKey = process.env.BOOKLET_API_KEY;

  test.beforeEach(async () => {
    home = await mkdtemp(join(tmpdir(), "booklet-cli-test-"));
    process.env.HOME = home;
    delete process.env.BOOKLET_API_KEY;
  });

  test.afterEach(async () => {
    await rm(home, { recursive: true, force: true });
    process.env.HOME = originalHome;
    if (originalEnvKey === undefined) delete process.env.BOOKLET_API_KEY;
    else process.env.BOOKLET_API_KEY = originalEnvKey;
  });

  test("BOOKLET_API_KEY env var wins over everything else", async () => {
    process.env.BOOKLET_API_KEY = "bklt_from_env";
    const backend = fakeBackend("bklt_from_keychain");
    expect(await getApiKey(backend)).toBe("bklt_from_env");
    expect(await getApiKeySource(backend)).toBe("env");
  });

  test("setApiKey stores in the keychain when available, getApiKey reads it back", async () => {
    const backend = fakeBackend();
    await setApiKey("bklt_secret", backend);
    expect(backend.stored).toBe("bklt_secret");
    expect(await getApiKey(backend)).toBe("bklt_secret");
    expect(await getApiKeySource(backend)).toBe("keychain");
  });

  test("falls back to the config file when the keychain is unavailable", async () => {
    const backend = unavailableBackend();
    await setApiKey("bklt_secret", backend);
    expect(await getApiKey(backend)).toBe("bklt_secret");
    expect(await getApiKeySource(backend)).toBe("file");
    const config = await readConfig();
    expect(config.apiKey).toBe("bklt_secret");
  });

  test("setApiKey migrates a legacy plaintext key into the keychain once it becomes available", async () => {
    // Simulate a pre-upgrade config file with a plaintext key already in it.
    const unavailable = unavailableBackend();
    await setApiKey("bklt_legacy", unavailable);
    expect((await readConfig()).apiKey).toBe("bklt_legacy");

    // Now the keychain is available (e.g. re-run after installing the
    // optional platform package) — the next setApiKey call should move
    // the key into it and strip the file.
    const nowAvailable = fakeBackend();
    await setApiKey("bklt_legacy", nowAvailable);
    expect(nowAvailable.stored).toBe("bklt_legacy");
    expect((await readConfig()).apiKey).toBeUndefined();
  });

  test("clearApiKey removes the key from both the keychain and the file", async () => {
    const backend = fakeBackend();
    await setApiKey("bklt_secret", backend);
    await clearApiKey(backend);
    expect(backend.stored).toBeNull();
    expect(await getApiKey(backend)).toBeNull();
    expect(await getApiKeySource(backend)).toBeNull();
  });

  test("clearApiKey also strips a legacy plaintext key even if the keychain has nothing", async () => {
    const unavailable = unavailableBackend();
    await setApiKey("bklt_secret", unavailable);
    await clearApiKey(unavailable);
    expect((await readConfig()).apiKey).toBeUndefined();
  });

  test("apiBase is preserved across setApiKey calls and defaults correctly", async () => {
    const backend = fakeBackend();
    await setApiKey("bklt_secret", backend);
    const config = await readConfig();
    expect(config.apiBase).toBe(DEFAULT_API_BASE);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx playwright test --config=playwright.unit.config.ts cli-config
```
Expected: FAIL — `getApiKeySource`, `setApiKey`, `clearApiKey` don't exist yet (only `getApiKey`
does, with the old single-arg-less signature).

- [ ] **Step 3: Replace `packages/cli/src/config.ts`**

```ts
import { homedir } from "os";
import { join } from "path";
import { readFile, writeFile, mkdir, chmod } from "fs/promises";
import { osKeychain, type KeychainBackend } from "./keychain.js";

function configDir(): string {
  return join(homedir(), ".booklet");
}

function configPath(): string {
  return join(configDir(), "config.json");
}

// Deliberately NOT booklet-api.ashwinsathian.com: `booklet login`'s
// browser flow opens `${base}/cli-auth`, a web UI page, not an API route —
// src/middleware.ts restricts the dedicated API hostname to /api/* only.
// The CLI needs one base that serves both, and booklet.ashwinsathian.com
// already serves /api/v1/* too, so it stays the default here.
export const DEFAULT_API_BASE = "https://booklet.ashwinsathian.com";

export type Config = {
  /** Legacy plaintext fallback — see getApiKey()/setApiKey(). Not written
   * to when the OS keychain is available. */
  apiKey?: string;
  apiBase: string;
};

export async function readConfig(): Promise<Config> {
  try {
    const raw = await readFile(configPath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<Config>;
    return { apiBase: DEFAULT_API_BASE, ...parsed };
  } catch {
    return { apiBase: DEFAULT_API_BASE };
  }
}

export async function writeConfig(config: Config): Promise<void> {
  // Config stores a plaintext API key (when the keychain isn't available)
  // — owner-only permissions. `mode` on mkdir/writeFile only applies at
  // creation time, so re-chmod on every write to also tighten a dir/file
  // left world-readable by an older CLI version.
  await mkdir(configDir(), { recursive: true, mode: 0o700 });
  await chmod(configDir(), 0o700);
  await writeFile(configPath(), JSON.stringify(config, null, 2) + "\n", { encoding: "utf8", mode: 0o600 });
  await chmod(configPath(), 0o600);
}

export type ApiKeySource = "env" | "keychain" | "file";

/**
 * Looks up the active API key: BOOKLET_API_KEY env var, then the OS
 * keychain, then the legacy plaintext config-file field (used when the
 * keychain is unavailable, or for anyone who logged in before this CLI
 * version added keychain support).
 */
export async function getApiKey(backend: KeychainBackend = osKeychain): Promise<string | null> {
  const env = process.env.BOOKLET_API_KEY;
  if (env) return env;

  const fromKeychain = await backend.get();
  if (fromKeychain) return fromKeychain;

  const config = await readConfig();
  return config.apiKey ?? null;
}

/** Same lookup as getApiKey(), but reports where the key came from (for `whoami`). */
export async function getApiKeySource(backend: KeychainBackend = osKeychain): Promise<ApiKeySource | null> {
  if (process.env.BOOKLET_API_KEY) return "env";
  if (await backend.get()) return "keychain";
  const config = await readConfig();
  return config.apiKey ? "file" : null;
}

/**
 * Saves the API key. Prefers the OS keychain; if that's unavailable (no
 * backend on headless Linux, unsupported OS, `--omit=optional` install),
 * falls back to the existing 0600 config file. Either way, any legacy
 * plaintext key from a prior version — or a prior run on this same
 * machine before the keychain became available — is cleaned up once a
 * keychain write succeeds, so the key never ends up duplicated in both
 * places.
 */
export async function setApiKey(key: string, backend: KeychainBackend = osKeychain): Promise<void> {
  const existing = await readConfig();
  const savedToKeychain = await backend.set(key);

  if (savedToKeychain) {
    const { apiKey: _legacy, ...rest } = existing;
    await writeConfig(rest as Config);
  } else {
    await writeConfig({ ...existing, apiKey: key });
  }
}

/** Removes the API key from wherever it's stored — keychain and/or the legacy file field. */
export async function clearApiKey(backend: KeychainBackend = osKeychain): Promise<void> {
  await backend.clear();
  const existing = await readConfig();
  if (existing.apiKey) {
    const { apiKey: _removed, ...rest } = existing;
    await writeConfig(rest as Config);
  }
}

export async function getApiBase(): Promise<string> {
  const env = process.env.BOOKLET_API_URL;
  if (env) return env.replace(/\/$/, "");
  const config = await readConfig();
  return config.apiBase.replace(/\/$/, "");
}
```

Note the change from a module-level `CONFIG_DIR`/`CONFIG_PATH` constant to `configDir()`/
`configPath()` functions — this is what makes the tests' per-test `process.env.HOME` override
actually take effect (the original code computed `homedir()` once at import time, which would
make the temp-dir tests in Step 1 all collide on the same real `~/.booklet`).

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx playwright test --config=playwright.unit.config.ts cli-config
```
Expected: PASS (8 tests).

- [ ] **Step 5: Typecheck and commit**

```bash
npm run typecheck --workspace packages/cli
git add packages/cli/src/config.ts tests/unit/cli-config.spec.ts
git commit -m "feat(cli): keychain-first credential storage with file fallback, TDD'd"
```

---

### Task 5: Wire `auth.ts` to the new config API

Fixes bug #1 (`whoami`'s stale `READABLE_API_KEY` check) as a natural consequence of routing
through `getApiKeySource()`. Depends on Task 4.

**Files:**
- Modify: `packages/cli/src/commands/auth.ts` (currently 242 lines)

**Interfaces:**
- Consumes: `setApiKey`, `clearApiKey`, `getApiKeySource` from Task 4's `config.ts` (in addition
  to the existing `readConfig`, `writeConfig`, `getApiKey`, `getApiBase` it already imports).

- [ ] **Step 1: Update the import line**

Change:
```ts
import { readConfig, writeConfig, getApiKey, getApiBase } from "../config.js";
```
to:
```ts
import { readConfig, writeConfig, getApiKey, getApiBase, setApiKey, clearApiKey, getApiKeySource } from "../config.js";
```

- [ ] **Step 2: Update the `login` command's two `writeConfig` call sites**

In the `--key` branch, change:
```ts
        await writeConfig({ ...existing, apiKey: opts.key, apiBase: base });
        success("Authenticated. Key saved to ~/.booklet/config.json");
```
to:
```ts
        await writeConfig({ ...existing, apiBase: base });
        await setApiKey(opts.key);
        success("Authenticated.");
```

In the browser-flow branch (end of the action, after `loginWithBrowser` resolves), change:
```ts
      await writeConfig({ ...existing, apiKey: result.key, apiBase: base });
      console.log();
      success("Authenticated. Key saved to ~/.booklet/config.json");
```
to:
```ts
      await writeConfig({ ...existing, apiBase: base });
      await setApiKey(result.key);
      console.log();
      success("Authenticated.");
```

(The `"Key saved to ~/.booklet/config.json"` wording is dropped from both — it's no longer
always true, since the key may have gone to the OS keychain instead. `whoami` is the place to
show where it actually landed, per Step 4 below.)

- [ ] **Step 3: Replace the `logout` command**

Change:
```ts
  program
    .command("logout")
    .description("Remove saved API key")
    .action(async () => {
      const config = await readConfig();
      if (!config.apiKey) {
        info("No key stored.");
        return;
      }
      const { apiKey: _removed, ...rest } = config;
      await writeConfig(rest as typeof config);
      success("Logged out. API key removed.");
    });
```
to:
```ts
  program
    .command("logout")
    .description("Remove saved API key")
    .action(async () => {
      const source = await getApiKeySource();
      if (!source || source === "env") {
        info(source === "env" ? "Key is set via BOOKLET_API_KEY — nothing to remove." : "No key stored.");
        return;
      }
      await clearApiKey();
      success("Logged out. API key removed.");
    });
```

- [ ] **Step 4: Replace the `whoami` command**

Change:
```ts
  program
    .command("whoami")
    .description("Show the active API key and base URL")
    .action(async () => {
      const fromEnv = Boolean(process.env.READABLE_API_KEY);
      const key = await getApiKey();
      const base = await getApiBase();

      if (!key) {
        info("Not authenticated. Run `booklet login` to authenticate.");
        return;
      }

      const masked =
        key.length > 8
          ? `${key.slice(0, 4)}${"•".repeat(key.length - 8)}${key.slice(-4)}`
          : "•".repeat(key.length);

      console.log(`${bold("Key:")}    ${masked}`);
      console.log(`${bold("Base:")}   ${gray(base)}`);
      console.log(`${bold("Source:")} ${dim(fromEnv ? "BOOKLET_API_KEY (env)" : "~/.booklet/config.json")}`);
    });
```
to:
```ts
  program
    .command("whoami")
    .description("Show the active API key and base URL")
    .option("--json", "Output raw JSON")
    .action(async (opts: { json?: boolean }) => {
      const key = await getApiKey();
      const base = await getApiBase();
      const source = await getApiKeySource();

      if (!key || !source) {
        if (opts.json) {
          console.log(JSON.stringify({ authenticated: false }, null, 2));
          return;
        }
        info("Not authenticated. Run `booklet login` to authenticate.");
        return;
      }

      const masked =
        key.length > 8
          ? `${key.slice(0, 4)}${"•".repeat(key.length - 8)}${key.slice(-4)}`
          : "•".repeat(key.length);

      const sourceLabel: Record<typeof source, string> = {
        env: "BOOKLET_API_KEY (env)",
        keychain: "OS keychain",
        file: "~/.booklet/config.json",
      };

      if (opts.json) {
        console.log(JSON.stringify({ authenticated: true, key: masked, base, source: sourceLabel[source] }, null, 2));
        return;
      }

      console.log(`${bold("Key:")}    ${masked}`);
      console.log(`${bold("Base:")}   ${gray(base)}`);
      console.log(`${bold("Source:")} ${dim(sourceLabel[source])}`);
    });
```

- [ ] **Step 5: Verify**

```bash
npm run typecheck --workspace packages/cli
npm run build --workspace packages/shared
npm run build --workspace packages/cli
BOOKLET_API_KEY=bklt_test_env node packages/cli/dist/index.js whoami
BOOKLET_API_KEY=bklt_test_env node packages/cli/dist/index.js whoami --json
```
Expected: first command prints `Source: BOOKLET_API_KEY (env)` (not
`~/.booklet/config.json` — this is the direct regression check for bug #1). Second prints valid
JSON with `"source": "BOOKLET_API_KEY (env)"`.

```bash
node packages/cli/dist/index.js whoami
```
(without `BOOKLET_API_KEY` set, and assuming no prior local `booklet login` was ever run on this
machine) Expected: `Not authenticated. Run \`booklet login\` to authenticate.`

- [ ] **Step 6: Commit**

```bash
git add packages/cli/src/commands/auth.ts
git commit -m "fix(cli): whoami reports the real credential source; route login/logout through the new keychain-aware config API"
```

---

### Task 6: `pages open --json`

Independent, small. Matches the `--json` shape already used by `pages list`.

**Files:**
- Modify: `packages/cli/src/commands/pages.ts` (currently 151 lines)

**Interfaces:** none — leaf change.

- [ ] **Step 1: Update the `pages open` command**

Change:
```ts
  pages
    .command("open <id>")
    .description("Open a page in your browser (use --print to just print the URL)")
    .option("--print", "Print the URL instead of opening a browser")
    .action(async (id: string, opts: { print?: boolean }) => {
      const client = await getClient();
      if (!client) {
        error(NOT_AUTHENTICATED_ERROR);
        process.exit(1);
      }

      let pages;
      try {
        pages = (await client.listPages()).pages;
      } catch (e) {
        error(apiErrorMessage(e));
        process.exit(1);
      }
      const page = pages.find((p) => p.id === id || p.slug === id);
      if (!page) {
        error(`Page not found: ${id}`);
        process.exit(1);
      }
      console.log(bold(page.url));
      if (!opts.print) {
        openUrl(page.url);
      }
    });
```
to:
```ts
  pages
    .command("open <id>")
    .description("Open a page in your browser (use --print to just print the URL)")
    .option("--print", "Print the URL instead of opening a browser")
    .option("--json", "Output raw JSON instead of printing the URL")
    .action(async (id: string, opts: { print?: boolean; json?: boolean }) => {
      const client = await getClient();
      if (!client) {
        error(NOT_AUTHENTICATED_ERROR);
        process.exit(1);
      }

      let pages;
      try {
        pages = (await client.listPages()).pages;
      } catch (e) {
        error(apiErrorMessage(e));
        process.exit(1);
      }
      const page = pages.find((p) => p.id === id || p.slug === id);
      if (!page) {
        error(`Page not found: ${id}`);
        process.exit(1);
      }

      if (opts.json) {
        console.log(JSON.stringify(page, null, 2));
        return;
      }

      console.log(bold(page.url));
      if (!opts.print) {
        openUrl(page.url);
      }
    });
```

Note `--json` implies not opening the browser (same reasoning as `--print`) — a script piping
`--json` output almost never also wants a browser window popping up. This is handled above simply
by `--json` returning before the `openUrl` call, same as `--print` already does structurally.

- [ ] **Step 2: Verify**

```bash
npm run typecheck --workspace packages/cli
npm run build --workspace packages/cli
node packages/cli/dist/index.js pages open --help
```
Expected: help output lists the new `--json` flag alongside `--print`.

- [ ] **Step 3: Commit**

```bash
git add packages/cli/src/commands/pages.ts
git commit -m "feat(cli): add --json to pages open"
```

---

### Task 7: `booklet completion <shell>` command

Independent. Hand-rolled — no new dependency. Covers the CLI's actual command surface: 3
top-level commands (`login`, `logout`, `whoami`, `publish`, `pages`) — correction, 4 top-level
plus the `pages` subcommand group (`list`, `open`, `delete`).

**Files:**
- Create: `packages/cli/src/commands/completion.ts`
- Modify: `packages/cli/src/index.ts` (register the new command)

**Interfaces:**
- Produces: `registerCompletionCommand(program: Command): void`, same pattern as the other
  `register*Command` functions.

- [ ] **Step 1: Create `packages/cli/src/commands/completion.ts`**

```ts
import { Command } from "commander";

// Hand-rolled, not generated from Commander's command tree at runtime —
// the CLI's surface (5 top-level commands, one subcommand group with 3
// subcommands, ~15 flags total) is small and stable enough that a
// generator would be more machinery than the problem needs. Update this
// list if commands/flags change.
const TOP_LEVEL = ["login", "logout", "whoami", "publish", "pages", "completion", "help"];
const PAGES_SUBCOMMANDS = ["list", "open", "delete"];

const BASH_SCRIPT = `_booklet_completions() {
  local cur prev words cword
  _init_completion || return

  local top_level="${TOP_LEVEL.join(" ")}"
  local pages_sub="${PAGES_SUBCOMMANDS.join(" ")}"

  if [[ \${cword} -eq 1 ]]; then
    COMPREPLY=( $(compgen -W "\${top_level}" -- "\${cur}") )
    return
  fi

  if [[ \${words[1]} == "pages" && \${cword} -eq 2 ]]; then
    COMPREPLY=( $(compgen -W "\${pages_sub}" -- "\${cur}") )
    return
  fi
}
complete -F _booklet_completions booklet
`;

const ZSH_SCRIPT = `#compdef booklet

_booklet() {
  local -a top_level pages_sub
  top_level=(${TOP_LEVEL.join(" ")})
  pages_sub=(${PAGES_SUBCOMMANDS.join(" ")})

  if (( CURRENT == 2 )); then
    _describe "command" top_level
    return
  fi

  if [[ \${words[2]} == "pages" && CURRENT -eq 3 ]]; then
    _describe "pages subcommand" pages_sub
    return
  fi
}

_booklet
`;

const FISH_SCRIPT = `set -l top_level ${TOP_LEVEL.join(" ")}
set -l pages_sub ${PAGES_SUBCOMMANDS.join(" ")}

complete -c booklet -n "not __fish_seen_subcommand_from $top_level" -a "$top_level"
complete -c booklet -n "__fish_seen_subcommand_from pages" -a "$pages_sub"
`;

export function registerCompletionCommand(program: Command) {
  program
    .command("completion <shell>")
    .description("Print a shell completion script (bash, zsh, or fish)")
    .action((shell: string) => {
      switch (shell) {
        case "bash":
          console.log(BASH_SCRIPT);
          break;
        case "zsh":
          console.log(ZSH_SCRIPT);
          break;
        case "fish":
          console.log(FISH_SCRIPT);
          break;
        default:
          console.error(`Unsupported shell: ${shell}. Supported: bash, zsh, fish.`);
          process.exit(1);
      }
    });
}
```

- [ ] **Step 2: Register it in `packages/cli/src/index.ts`**

Add the import:
```ts
import { registerCompletionCommand } from "./commands/completion.js";
```
and the registration call alongside the others:
```ts
registerAuthCommands(program);
registerPublishCommand(program);
registerPagesCommand(program);
registerCompletionCommand(program);
```

- [ ] **Step 3: Verify — build, print, and actually exercise bash completion**

```bash
npm run typecheck --workspace packages/cli
npm run build --workspace packages/cli
node packages/cli/dist/index.js completion bash
```
Expected: prints the bash script with no template-literal artifacts (no literal `${...}` left
un-substituted — the `TOP_LEVEL.join(...)` calls happen at module load, only the `\${cur}` etc.
inside the script body, which use an escaped `$`, should appear literally).

Then actually exercise it, since a real functional check beats eyeballing generated shell script:
```bash
bash -c '
  source <(node packages/cli/dist/index.js completion bash)
  COMP_WORDS=(booklet pub)
  COMP_CWORD=1
  COMP_LINE="booklet pub"
  COMP_POINT=${#COMP_LINE}
  _booklet_completions
  echo "COMPREPLY: ${COMPREPLY[@]}"
'
```
Expected: `COMPREPLY: publish`. Then check the `pages` subcommand level too:
```bash
bash -c '
  source <(node packages/cli/dist/index.js completion bash)
  COMP_WORDS=(booklet pages l)
  COMP_CWORD=2
  COMP_LINE="booklet pages l"
  COMP_POINT=${#COMP_LINE}
  _booklet_completions
  echo "COMPREPLY: ${COMPREPLY[@]}"
'
```
Expected: `COMPREPLY: list`.

If `_init_completion` isn't available (it's part of `bash-completion`, not bash itself — common
on minimal/CI shells), the first block will error with "command not found." If so, still verify
`node packages/cli/dist/index.js completion bash` prints a well-formed script and move on — that
gap is an environment limitation, not a bug in the generated script, since real users installing
via `brew install bash-completion` or equivalent will have `_init_completion` available.

- [ ] **Step 4: Commit**

```bash
git add packages/cli/src/commands/completion.ts packages/cli/src/index.ts
git commit -m "feat(cli): add booklet completion <bash|zsh|fish>"
```

---

### Task 8: Top-level help examples + docs link

Independent, but naturally comes after Task 7 so the examples can reference the final command
set. Small change, no test — verified by eyeballing `--help` output.

**Files:**
- Modify: `packages/cli/src/index.ts`

**Interfaces:** none — leaf change.

- [ ] **Step 1: Add an examples block to `packages/cli/src/index.ts`**

After the existing `program` configuration block (the `.name(...).description(...).version(...)
.option(...)` chain from Task 1), add:

```ts
program.addHelpText(
  "after",
  `
Examples:
  $ booklet login                       Authenticate via your browser
  $ booklet publish README.md           Publish a Markdown file
  $ echo "# Hi" | booklet publish -     Publish from stdin
  $ booklet pages list                  List your published pages

Docs & source: ${REPO_URL}`,
);
```

(`REPO_URL` already exists from Task 1's error-handling addition — reuse it rather than
duplicating the string.)

- [ ] **Step 2: Verify**

```bash
npm run typecheck --workspace packages/cli
npm run build --workspace packages/cli
node packages/cli/dist/index.js --help
```
Expected: the existing Commander-generated usage/options block, followed by the new "Examples:"
section and the docs link.

- [ ] **Step 3: Commit**

```bash
git add packages/cli/src/index.ts
git commit -m "feat(cli): add examples and docs link to top-level --help"
```

---

### Task 9: npm Trusted Publishing (OIDC) migration

Independent infra task. **After this merges, publishing will fail until you complete the
npmjs.com-side linking step** (see Step 3) — do this task last among the code changes, or at
least be ready to do the npmjs.com step before the next version bump triggers the workflow.

**Files:**
- Modify: `.github/workflows/publish-cli.yml`

**Interfaces:** none.

- [ ] **Step 1: Replace `.github/workflows/publish-cli.yml`**

```yaml
# Publishes booklet-cli to npm when packages/cli/package.json version changes on main.
# Trigger: push to main that touches packages/cli/, OR manual dispatch.
#
# Uses npm Trusted Publishing (OIDC) — no NPM_TOKEN secret needed. The
# workflow proves its identity to npm via a short-lived GitHub Actions
# OIDC token (the `id-token: write` permission below), which npm
# exchanges for a one-time publish credential. This requires a one-time
# manual step: on https://www.npmjs.com/package/booklet-cli, under
# Settings → Trusted Publisher, add a GitHub Actions publisher pointing at
# this repo (AshwinSathian/booklet), workflow file
# (.github/workflows/publish-cli.yml), and environment (leave blank unless
# you add one). Until that link exists, the "Publish to npm" step below
# will fail with an authentication error — this is expected for any push
# before the link is set up, not a bug in this workflow.
#
# Provenance attestations are generated automatically under trusted
# publishing (no --provenance flag needed).

name: Publish CLI to npm

on:
  push:
    branches: [main]
    paths:
      - "packages/cli/package.json"
      - "packages/cli/src/**"
  workflow_dispatch: {}

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          registry-url: "https://registry.npmjs.org"

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

      - name: Skip (already published)
        if: steps.version_check.outputs.already_published == 'true'
        run: echo "booklet-cli@${{ steps.version_check.outputs.version }} already on npm — bump version to publish."
```

The only functional diffs from the current file: `permissions: contents: read / id-token: write`
added at the job level; the `env: NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}` under the publish
step is removed (npm CLI auto-detects OIDC when `id-token: write` is granted and the registry
supports it — no explicit flag needed with a current `npm` version, which `setup-node@v4` with
`node-version: "20"` provides); the header comment is rewritten to explain the manual npmjs.com
step.

- [ ] **Step 2: Validate the YAML parses correctly**

```bash
node -e "
const yaml = require('js-yaml');
const fs = require('fs');
const doc = yaml.load(fs.readFileSync('.github/workflows/publish-cli.yml', 'utf8'));
console.log('permissions:', JSON.stringify(doc.jobs.publish.permissions));
console.log('has id-token write:', doc.jobs.publish.permissions['id-token'] === 'write');
"
```
Expected: `has id-token write: true`, no parse errors. (`js-yaml` is already a root dependency —
see `package.json` — so this needs no new install.)

- [ ] **Step 3: Tell the user the manual step is next**

This step has no code — it's a note for whoever runs this task: after committing, the actual npm
Trusted Publisher link must be created at
`https://www.npmjs.com/package/booklet-cli/access` (or the package's Settings page) before the
next version bump reaches `main`, or that publish run will fail at the "Publish to npm" step.
Surface this clearly when reporting the task done — don't silently assume it's been set up.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/publish-cli.yml
git commit -m "ci(cli): migrate npm publish to Trusted Publishing (OIDC), drop NPM_TOKEN"
```

---

### Task 10: CHANGELOG, version bump, README pass, full verification

Wrap-up task. Depends on all previous tasks being complete (it documents and verifies the whole
set of changes). This is also where the actual npm-visible version number is decided.

**Files:**
- Create: `packages/cli/CHANGELOG.md`
- Modify: `packages/cli/package.json` (version bump)
- Modify: `packages/cli/README.md` (document new flags/commands/behavior)

**Interfaces:** none — final integration task.

- [ ] **Step 1: Create `packages/cli/CHANGELOG.md`**

```markdown
# Changelog

All notable changes to `booklet-cli` are documented here. Format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.2.0] - 2026-08-04

### Added
- OS keychain credential storage (macOS Keychain, Windows Credential Manager, Linux Secret
  Service via `@napi-rs/keyring`), with automatic fallback to the existing 0600 config file when
  no keychain backend is available. Existing plaintext keys are migrated into the keychain
  automatically once available.
- `--json` on `whoami` and `pages open` (previously only `pages list` supported it).
- Top-level `--no-color` flag, in addition to the existing `NO_COLOR` env var.
- `booklet completion <bash|zsh|fish>` — prints a shell completion script.
- Examples and a docs link in top-level `--help`.

### Fixed
- `whoami` now correctly reports `BOOKLET_API_KEY (env)` as the credential source when the env
  var is set — it previously checked a stale pre-rename variable name and always reported the
  config file instead.
- Errors thrown inside async command handlers now go through the CLI's own error output and exit
  cleanly, instead of surfacing as an unhandled promise rejection with a raw Node stack trace.
- The published npm package now includes its own `LICENSE` file.

### Changed
- CI now publishes to npm via Trusted Publishing (OIDC) instead of a long-lived `NPM_TOKEN`
  secret, with automatic provenance attestations.
- `@napi-rs/keyring` is now a real (non-bundled) dependency, needed for OS keychain support —
  the CLI is no longer a literal zero-runtime-dependency package, though it remains a single JS
  entrypoint plus one native addon.

## [0.1.0] - 2026-07-28

Initial release as `booklet-cli` (renamed from `readable-cli`): browser-based login, `publish`
(including stdin and `--watch`), `pages list`/`open`/`delete`, `whoami`/`logout`.
```

- [ ] **Step 2: Bump the version**

In `packages/cli/package.json`, change:
```json
  "version": "0.1.0",
```
to:
```json
  "version": "0.2.0",
```
(Minor bump: this pass is bug fixes plus backward-compatible additions plus one dependency-model
change — no existing flag, command, or output shape is removed or changed incompatibly, so this
is not a major bump under semver.)

- [ ] **Step 3: Update `packages/cli/README.md`**

Add a new subsection after the existing "Environment variables" section (before "CI / GitHub
Actions"):

```markdown
## Credential storage

`booklet login` saves your API key to your OS's credential store when available — macOS
Keychain, Windows Credential Manager, or Linux Secret Service. On macOS, the first `booklet`
command that touches the keychain may show a one-time system prompt asking to allow access;
choosing "Always Allow" avoids repeat prompts.

If no keychain backend is available (common on headless Linux/CI), the key is stored in
`~/.booklet/config.json` instead, with owner-only file permissions (`0600`). `booklet whoami`
always shows exactly where your active key came from.

`booklet logout` removes the key from wherever it's stored.
```

Add a "Shell completion" subsection after the "### `booklet logout`" section:

```markdown
### Shell completion

```bash
# bash
booklet completion bash >> ~/.bash_completion

# zsh (add to a directory in your $fpath)
booklet completion zsh > "${fpath[1]}/_booklet"

# fish
booklet completion fish > ~/.config/fish/completions/booklet.fish
```
```

Update the `booklet pages open <id>` documentation to mention `--json`:
```markdown
### `booklet pages open <id>`

Open a page in your browser. Pass `--print` to print the URL without opening a browser, or
`--json` for the full page object.

```bash
booklet pages open abc123             # opens browser
booklet pages open abc123 --print     # prints URL only
booklet pages open abc123 --json      # prints the page object as JSON
booklet pages open my-custom-slug     # works with slugs too
```
```

Update the `booklet whoami` line to mention `--json`:
```markdown
### `booklet whoami`

Show the active API key, base URL, and where the key was loaded from (env var, OS keychain, or
config file). Pass `--json` for machine-readable output.
```

Add `NO_COLOR` clarification in the environment variables table — change:
```markdown
| `NO_COLOR` | Set to any value to disable ANSI colour output |
```
to:
```markdown
| `NO_COLOR` | Set to any value to disable ANSI colour output (or pass `--no-color`) |
```

- [ ] **Step 4: Full verification suite**

```bash
npm run typecheck --workspace packages/cli
npm run build --workspace packages/shared
npm run build --workspace packages/cli
npx playwright test --config=playwright.unit.config.ts cli-config cli-fmt
npm run lint
npm pack --dry-run --workspace packages/cli
```
Expected: everything passes; `npm pack --dry-run` output's `Tarball Contents` includes `LICENSE`,
`README.md`, `package.json`, and `dist/index.js`, and the version shown is `0.2.0`.

Then a final end-to-end smoke test of the built binary:
```bash
node packages/cli/dist/index.js --version
node packages/cli/dist/index.js --help
BOOKLET_API_KEY=bklt_smoketest node packages/cli/dist/index.js whoami --json
node packages/cli/dist/index.js completion zsh | head -5
node packages/cli/dist/index.js --no-color whoami
```
Expected: version prints `0.2.0`; help shows the examples block; `whoami --json` shows
`"source": "BOOKLET_API_KEY (env)"`; completion prints a zsh script; the last command runs without
color codes even against a TTY-attached terminal (harder to verify non-interactively, but confirm
it doesn't error).

- [ ] **Step 5: Commit**

```bash
git add packages/cli/CHANGELOG.md packages/cli/package.json packages/cli/README.md
git commit -m "chore(cli): bump to 0.2.0, add CHANGELOG, document keychain/completion/--json/--no-color"
```

**Do not push `main` or otherwise trigger the publish workflow as part of this task** — per the
design spec's rollout section, the version bump is what fires `publish-cli.yml` once merged to
`main`, and that's a real, externally visible npm release. Report completion and let the user
decide when to push, especially since Task 9's Trusted Publishing link on npmjs.com must be done
first or that push's publish will fail.

---

## Post-plan check

After all 10 tasks: re-read `docs/superpowers/specs/2026-08-04-cli-hardening-design.md` section
by section and confirm every "Findings" item and every "Architecture" subsection has a
corresponding completed task. Run `superpowers:requesting-code-review` (or equivalent review
step) before considering this done, per the user's original request to "implement, review,
verify, commit."
