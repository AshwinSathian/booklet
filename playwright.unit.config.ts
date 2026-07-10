import { defineConfig } from "@playwright/test";

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
