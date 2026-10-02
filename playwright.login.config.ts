import { defineConfig, devices } from "@playwright/test";

/** One-off, headed run where you sign in by hand; see e2e/login.setup.ts. */
export default defineConfig({
  testDir: "e2e",
  testMatch: /login\.setup\.ts/,
  timeout: 6 * 60_000,
  use: {
    ...devices["Desktop Chrome"],
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    headless: false,
  },
  webServer: process.env.E2E_BASE_URL ? undefined : {
    command: "npm run dev",
    url: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
