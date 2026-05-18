import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config.
 *
 * The e2e tests run against a real Next.js dev server pointed at the
 * local Supabase stack (http://127.0.0.1:54321). They cover the POS
 * critical path - sign in, take a sale, see a receipt, replay an
 * offline queue.
 *
 * Prerequisites (developers run these once):
 *   1. `npm run supabase:start`            (local Supabase stack)
 *   2. `npm run test:e2e:install`          (Playwright Chromium)
 * Running:
 *   `npm run test:e2e`                     (headless)
 *   `npm run test:e2e:ui`                  (debug UI)
 */
export default defineConfig({
  testDir: "./e2e",
  outputDir: "./e2e/.results",
  // 60s per spec is plenty for the POS flow; CI tweaks this if needed.
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    locale: "en-IE",
    timezoneId: "Europe/Dublin",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Enable service workers / IDB so the offline POS test works.
        contextOptions: {
          serviceWorkers: "allow",
        },
      },
    },
  ],
  webServer: process.env.E2E_SKIP_WEB_SERVER
    ? undefined
    : {
        // We use the dev server because the production build needs an
        // env-specific service worker route - dev is identical for test
        // purposes and avoids an extra `npm run build` step.
        command: "npm run dev",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
