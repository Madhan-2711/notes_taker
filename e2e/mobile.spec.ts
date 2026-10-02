import { expect, test } from "@playwright/test";
import { cleanUpTestNotes, openPage, quickCapture } from "./helpers";

test.describe.configure({ mode: "serial" });

test.afterAll(async ({ browser }) => {
  const context = await browser.newContext({ storageState: test.info().project.use.storageState as string, viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  await cleanUpTestNotes(page);
  await context.close();
});

test("phone: bottom tab bar navigates and the page never scrolls sideways", async ({ page }) => {
  await openPage(page, "/");
  const tabs = page.getByRole("navigation", { name: "Main" }).last();
  await expect(tabs).toBeVisible();
  for (const name of ["Notes", "Groups", "Friends", "Home"]) {
    // "Friends" may carry a "(N waiting)" suffix for screen readers.
    const tab = tabs.getByRole("link", { name: new RegExp(`^${name}( |$)`) });
    await tab.click();
    await expect(tab).toHaveAttribute("aria-current", "page");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);
  }
  await tabs.getByRole("link", { name: "New note" }).click();
  await expect(page).toHaveURL(/\/write$/);
});

test("phone: a saved note opens full screen and the selection bar fits on one row", async ({ page }) => {
  const title = await quickCapture(page, "phone");
  await openPage(page, "/notes");
  await page.getByRole("button", { name: `Open ${title}` }).click();
  const dialog = page.getByRole("dialog", { name: title });
  await expect(dialog).toBeVisible();
  // Polls past the short opening animation (it scales from 98%).
  const viewport = page.viewportSize()!;
  await expect.poll(async () => Math.round((await dialog.boundingBox())!.width)).toBe(viewport.width);
  await dialog.getByRole("button", { name: "Close" }).click();

  await page.getByRole("button", { name: "Select", exact: true }).click();
  await page.getByRole("button", { name: `Select ${title}`, exact: true }).click();
  const bar = await page.getByRole("region", { name: "Selected notes" }).locator("> div").boundingBox();
  expect(bar!.height).toBeLessThan(80);
  await page.getByRole("button", { name: "Stop selecting" }).click();
});
