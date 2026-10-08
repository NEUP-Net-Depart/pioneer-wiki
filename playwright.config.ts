import { defineConfig, devices } from "@playwright/test";

/**
 * CI installs only Playwright-managed Chromium. The suite does not depend on a
 * system Chrome, Firefox, WebKit, Supabase project, or authenticated account.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://127.0.0.1:3000",
    ...devices["Desktop Chrome"],
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: "pnpm start",
    url: "http://127.0.0.1:3000/icon.svg",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
