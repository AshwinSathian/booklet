import { defineConfig, devices } from "@playwright/test";

// Dedicated config for prod-smoke.spec.ts — deliberately separate from the
// root playwright.config.ts (whose testDir: "./tests/e2e" wouldn't discover
// this file, by design: this suite must never run as part of the normal
// dev/CI test pass, only when explicitly invoked against production).
export default defineConfig({
  testDir: ".",
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: process.env.TEST_BASE_URL ?? "https://booklet.ashwinsathian.com",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
