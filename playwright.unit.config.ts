import { AsyncLocalStorage } from "node:async_hooks";
import { defineConfig } from "@playwright/test";

// Outside the Next runtime, "next/server" falls back to a stub
// AsyncLocalStorage that throws on first use unless the real one is already
// on globalThis when it loads. Workers evaluate this config before any spec,
// and are reused across spec files, so this is the one place early enough.
// Needed by tests/unit/helpers/request-scope.ts.
(globalThis as { AsyncLocalStorage?: unknown }).AsyncLocalStorage ??= AsyncLocalStorage;

// Config for plain Node/TS unit tests (no browser, no dev server needed) —
// reuses the @playwright/test runner/assertion library already in
// devDependencies instead of adding Jest/Vitest for a handful of pure
// function tests. See tests/unit/.
export default defineConfig({
  testDir: "./tests/unit",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: "list",
});
