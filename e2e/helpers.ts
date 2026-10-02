import { expect, type Page } from "@playwright/test";

/** Every note the tests create starts with this, so cleanup never touches real notes. */
export const PREFIX = "E2E";

export function uniqueTitle(label: string) {
  return `${PREFIX} ${label} ${Date.now().toString(36)}`;
}

/** Waits until the signed-in app shell and the page's data have loaded. */
export async function openPage(page: Page, path: string) {
  await page.goto(path);
  // The Next.js dev-tools badge (development only) sits over the phone tab bar.
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  // Restoring the Firebase session can take a while on a cold dev server.
  await expect(page.getByRole("button", { name: "Account menu" })).toBeVisible({ timeout: 20_000 });
  // Lists render skeletons with aria-busy until Firestore answers.
  await expect(page.locator("[aria-busy=true]")).toHaveCount(0, { timeout: 15_000 });
}

/** Creates a regular note through Home's quick capture and returns its title. */
export async function quickCapture(page: Page, label: string, content = "Created by the end-to-end tests.") {
  const title = uniqueTitle(label);
  await openPage(page, "/");
  await page.getByRole("radio", { name: "Note", exact: true }).click();
  await page.getByLabel("Note title").fill(title);
  await page.getByLabel("Note content").fill(content);
  await page.getByRole("button", { name: "Save note" }).click();
  await expect(page.getByText("Saved to your notes")).toBeVisible();
  return title;
}

export async function expectToast(page: Page, text: string | RegExp) {
  await expect(page.getByRole("status").filter({ hasText: text })).toBeVisible();
}

/**
 * Moves every E2E note to trash. With E2E_PURGE=1 they are then deleted forever,
 * which is the only permanent deletion the suite performs, and only of its own notes.
 */
export async function cleanUpTestNotes(page: Page) {
  await openPage(page, "/notes");
  for (const tab of ["Notes", "Archived"]) {
    await page.getByRole("button", { name: new RegExp(`^${tab}`) }).first().click();
    await page.getByLabel("Search notes").fill(PREFIX);
    const cards = page.getByRole("button", { name: new RegExp(`^Open ${PREFIX} `) });
    await page.waitForTimeout(1500);
    if (await cards.count() === 0) continue;
    // Read the titles first: in select mode the same buttons are renamed "Select …".
    const titles = [...new Set(await cards.evaluateAll((buttons) => buttons.map((button) => (button.getAttribute("aria-label") ?? "").replace(/^Open /, ""))))];
    await page.getByRole("button", { name: "Select", exact: true }).click();
    for (const title of titles) {
      await page.getByRole("button", { name: `Select ${title}`, exact: true }).click();
    }
    await page.getByRole("button", { name: "Move selected notes to trash" }).click();
    await expectToast(page, /Moved \d+ notes? to trash/);
  }
  await page.getByLabel("Search notes").fill("");
  if (process.env.E2E_PURGE !== "1") return;

  await page.getByRole("button", { name: /^Trash/ }).click();
  await page.getByLabel("Search notes").fill(PREFIX);
  await page.waitForTimeout(1500);
  const trashed = page.locator("h4", { hasText: new RegExp(`^${PREFIX} `) });
  if (await trashed.count() === 0) return;
  await page.getByRole("button", { name: "Select", exact: true }).click();
  for (const title of await trashed.allTextContents()) {
    await page.getByRole("button", { name: `Select ${title}`, exact: true }).click();
  }
  await page.getByRole("region", { name: "Selected notes" }).getByRole("button", { name: "Delete forever" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Delete forever" }).click();
  await expectToast(page, /Deleted \d+ notes? forever/);
}
