import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: process.env.TEST_BASE_URL ?? "http://localhost:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    // WebKit runs only the specs that exercise engine-specific editing
    // behaviour; the rest of the suite stays Chromium-only to keep it fast.
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
      testMatch: /undo\.spec\.ts/,
    },
  ],
});
