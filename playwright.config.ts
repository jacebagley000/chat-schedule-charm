import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end robots checks.
 *
 * Target the preview/staging deployment with:
 *   PLAYWRIGHT_BASE_URL=https://<preview>.lovable.app bunx playwright test
 *
 * With no base URL set, tests run against the local dev server (started here).
 */
const baseURL =
  process.env["PLAYWRIGHT_BASE_URL"] ??
  process.env["PREVIEW_URL"] ??
  process.env["STAGING_URL"] ??
  "http://localhost:8080";

const isLocal = baseURL.includes("localhost");
/** Set when a dev server is already running and Playwright must not spawn one. */
const externalServer = process.env["PLAYWRIGHT_NO_WEBSERVER"] === "1";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 2 : 0,
  reporter: process.env["CI"]
    ? [["list"], ["html", { outputFolder: "artifacts/playwright-report", open: "never" }]]
    : [["list"]],
  use: {
    baseURL,
    trace: "on-first-retry",
    // Escape hatch for environments that already ship a compatible browser.
    launchOptions: process.env["PLAYWRIGHT_CHROMIUM_PATH"]
      ? { executablePath: process.env["PLAYWRIGHT_CHROMIUM_PATH"] }
      : {},
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  ...(isLocal && !externalServer
    ? {
        webServer: {
          command: "bun run dev",
          url: "http://localhost:8080",
          reuseExistingServer: !process.env["CI"],
          timeout: 120_000,
        },
      }
    : {}),
});
