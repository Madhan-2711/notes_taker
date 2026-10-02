import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { expect, test } from "@playwright/test";
import { AUTH_FILE } from "../playwright.config";

/**
 * Opens a real browser on the sign-in page and waits for you to sign in (Google, or
 * username and password on /access). The session, including the vault key kept in
 * IndexedDB, is then saved for the other tests. Nothing is typed for you.
 */
test("sign in once and save the session", async ({ page }) => {
  await page.goto("/access");
  console.log("\nSign in in the browser window that just opened. Waiting up to 5 minutes…\n");
  await expect(page.getByRole("button", { name: "Account menu" })).toBeVisible({ timeout: 5 * 60_000 });
  // Let the vault unlock and redirects settle. Firestore keeps a connection open,
  // so "network idle" never happens; a short pause is enough.
  await page.waitForTimeout(4000);
  mkdirSync(dirname(AUTH_FILE), { recursive: true });
  await page.context().storageState({ path: AUTH_FILE, indexedDB: true });
  console.log(`Saved the session to ${AUTH_FILE}. Keep this file private.`);
});
