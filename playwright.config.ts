import { defineConfig, devices } from "@playwright/test";

/** Saved by `npm run e2e:login`; contains a live session, so it is git-ignored. */
export const AUTH_FILE = "e2e/.auth/user.json";
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "e2e",
  // Every test signs in as the same account, so run one at a time to keep its data predictable.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never", outputFolder: "e2e/report" }]],
  outputDir: "e2e/results",
  globalSetup: "./e2e/global-setup.ts",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: process.env.E2E_BASE_URL ? undefined : {
    command: "npm run dev",
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    {
      name: "desktop",
      testMatch: /app\.spec\.ts/,
      // Full Chromium in new headless mode; the lightweight headless shell crashed on the Quill editor.
      use: { ...devices["Desktop Chrome"], channel: "chromium", viewport: { width: 1440, height: 900 }, storageState: AUTH_FILE },
    },
    {
      name: "mobile",
      testMatch: /mobile\.spec\.ts/,
      use: { ...devices["Pixel 7"], channel: "chromium", storageState: AUTH_FILE },
    },
  ],
});
