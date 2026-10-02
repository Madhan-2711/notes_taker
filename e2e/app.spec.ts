import { expect, test } from "@playwright/test";
import { cleanUpTestNotes, expectToast, openPage, quickCapture, uniqueTitle } from "./helpers";

test.describe.configure({ mode: "serial" });

test.afterAll(async ({ browser }) => {
  const context = await browser.newContext({ storageState: test.info().project.use.storageState as string });
  const page = await context.newPage();
  await cleanUpTestNotes(page);
  await context.close();
});

test("header navigation reaches every main page and marks the current one", async ({ page }) => {
  await openPage(page, "/");
  const nav = page.getByRole("navigation", { name: "Main" }).first();
  for (const [name, path, heading] of [["Notes", "/notes", "Notes"], ["Groups", "/groups", "Groups"], ["Friends", "/friends", "Friends"], ["Home", "/", null]] as const) {
    await nav.getByRole("link", { name }).click();
    await expect(page).toHaveURL(new RegExp(`${path === "/" ? "/$" : path}`));
    await expect(nav.getByRole("link", { name })).toHaveAttribute("aria-current", "page");
    if (heading) await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
  }
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();
});

test("quick capture saves a note that shows up in Continue writing and Notes", async ({ page }) => {
  const title = await quickCapture(page, "quick");
  await expect(page.getByRole("link", { name: new RegExp(title) })).toBeVisible();
  await openPage(page, "/notes");
  await expect(page.getByRole("button", { name: `Open ${title}` })).toBeVisible();
});

test("Write page saves a note and opens it; templates ask before replacing text", async ({ page }) => {
  const title = uniqueTitle("write");
  await openPage(page, "/write");
  await page.getByLabel("Title").fill(title);
  await page.locator(".ql-editor").first().click();
  await page.keyboard.type("Written on the Write page.");
  await expect(page.getByText("Ready to save as")).toBeVisible();

  await page.getByRole("button", { name: "Use a template" }).click();
  await page.getByRole("menuitem", { name: "Diary" }).click();
  await expect(page.getByRole("dialog", { name: "Replace your writing?" })).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
  await expect(page.locator(".ql-editor").first()).toContainText("Written on the Write page.");

  await page.getByRole("button", { name: "Save note" }).click();
  await expect(page).toHaveURL(/\/notes\?open=/);
  await expect(page.getByRole("dialog").getByRole("heading", { name: title })).toBeVisible();
});

test("note cards pin, unpin, and move to trash with Undo", async ({ page }) => {
  const title = await quickCapture(page, "card");
  await openPage(page, "/notes");
  await page.getByRole("button", { name: `Pin ${title}` }).click();
  await expect(page.getByRole("heading", { name: "Pinned" })).toBeVisible();
  await page.getByRole("button", { name: `Unpin ${title}` }).click();
  await expect(page.getByRole("button", { name: `Pin ${title}` })).toBeVisible();

  await page.getByRole("button", { name: `More actions for ${title}` }).click();
  await page.getByRole("menuitem", { name: "Move to trash" }).click();
  await expectToast(page, "Moved to trash");
  await expect(page.getByRole("button", { name: `Open ${title}` })).toHaveCount(0);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("button", { name: `Open ${title}` })).toBeVisible();
});

test("viewer: archive with Undo, reminder and export panels, edit dialog, Escape to close", async ({ page }) => {
  const title = await quickCapture(page, "viewer");
  await openPage(page, "/notes");
  await page.getByRole("button", { name: `Open ${title}` }).click();
  const dialog = page.getByRole("dialog", { name: title });
  await expect(dialog).toBeVisible();

  await dialog.getByRole("button", { name: "Archive note" }).click();
  await expect(dialog.getByText("Archived", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(dialog.getByText("Archived", { exact: true })).toHaveCount(0);

  await dialog.getByRole("button", { name: "Set reminder" }).click();
  await expect(dialog.getByLabel("Remind me on")).toBeVisible();
  await dialog.getByRole("button", { name: "More note actions" }).click();
  await page.getByRole("menuitem", { name: "Export" }).click();
  await expect(dialog.getByRole("button", { name: /Markdown/ })).toBeVisible();

  await dialog.getByRole("button", { name: "Edit" }).click();
  await expect(page.getByRole("dialog", { name: "Edit note" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("notes list: search, filters, sorting, list layout and bulk archive with Undo", async ({ page }) => {
  const first = await quickCapture(page, "alpha");
  const second = await quickCapture(page, "beta");
  await openPage(page, "/notes");

  await page.keyboard.press("/");
  await expect(page.getByLabel("Search notes")).toBeFocused();
  await page.keyboard.type(first);
  await expect(page.getByRole("button", { name: `Open ${first}` })).toBeVisible();
  await expect(page.getByRole("button", { name: `Open ${second}` })).toHaveCount(0);
  await page.getByLabel("Search notes").fill("E2E zz-no-match");
  await expect(page.getByText("No matching notes")).toBeVisible();
  await page.getByLabel("Search notes").fill("E2E");

  await page.getByRole("button", { name: /Filters/ }).click();
  await page.locator("#note-filters").getByRole("button", { name: "Private" }).click();
  await expect(page.getByRole("button", { name: "Remove filter Private" })).toBeVisible();
  await page.getByRole("button", { name: "Clear all" }).click();

  await page.getByLabel("Sort notes").selectOption("title");
  const titles = await page.locator("article h3").allTextContents();
  expect(titles.indexOf(first)).toBeLessThan(titles.indexOf(second));
  await page.getByRole("radio", { name: "List layout" }).click();
  await expect(page.locator("article.rounded-2xl").first()).toBeVisible();

  await page.getByRole("button", { name: "Select", exact: true }).click();
  await page.getByRole("button", { name: `Select ${first}`, exact: true }).click();
  await page.getByRole("button", { name: `Select ${second}`, exact: true }).click();
  await expect(page.getByText("2 selected")).toBeVisible();
  await page.getByRole("region", { name: "Selected notes" }).getByRole("button", { name: /Archive/ }).click();
  await expectToast(page, "Archived 2 notes");
  await expect(page.getByRole("button", { name: `Open ${first}` })).toHaveCount(0);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("button", { name: `Open ${first}` })).toBeVisible();

  await page.getByLabel("Sort notes").selectOption("updated");
  await page.getByRole("radio", { name: "Grid layout" }).click();
  await page.getByLabel("Search notes").fill("");
});

test("trash: Empty trash asks for confirmation", async ({ page }) => {
  const title = await quickCapture(page, "trash");
  await openPage(page, "/notes");
  await page.getByRole("button", { name: `More actions for ${title}` }).click();
  await page.getByRole("menuitem", { name: "Move to trash" }).click();
  await expectToast(page, "Moved to trash");
  await page.getByRole("button", { name: /^Trash/ }).click();
  await expect(page.locator("h4", { hasText: title })).toBeVisible();
  await page.getByRole("button", { name: "Empty trash" }).click();
  await expect(page.getByRole("dialog", { name: /forever\?/ })).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
  await expect(page.locator("h4", { hasText: title })).toBeVisible();
});

test("groups: create a group with a note, open it, and reach delete from Manage", async ({ page }) => {
  const title = await quickCapture(page, "grouped");
  const groupName = uniqueTitle("group");
  await openPage(page, "/groups");
  await page.getByRole("button", { name: "Create group" }).first().click();
  const create = page.getByRole("dialog", { name: "Create group" });
  await create.getByLabel("Name").fill(groupName);
  await create.getByRole("button", { name: new RegExp(title) }).click();
  await create.getByRole("button", { name: "Create group" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.getByRole("link", { name: new RegExp(groupName) }).click();
  await expect(page.getByRole("heading", { level: 1, name: groupName })).toBeVisible();
  await expect(page.getByRole("button", { name: `Open ${title}` })).toBeVisible();
  await page.getByRole("button", { name: "Manage" }).click();
  await page.getByRole("dialog", { name: "Manage group" }).getByRole("button", { name: "Delete group" }).click();
  const confirm = page.getByRole("dialog", { name: /Delete ".*"\?/ });
  await expect(confirm).toBeVisible();
  if (process.env.E2E_PURGE !== "1") {
    // Without E2E_PURGE the suite never deletes anything permanently; the test group stays.
    await confirm.getByRole("button", { name: "Cancel" }).click();
    return;
  }
  // Deleting removes only the group; its notes stay in Notes.
  await confirm.getByRole("button", { name: "Delete group" }).click();
  await expect(page).toHaveURL(/\/groups$/);
  await openPage(page, "/notes");
  await expect(page.getByRole("button", { name: `Open ${title}` })).toBeVisible();
});

test("keyboard: Ctrl+K jumps to a note, N starts a new note", async ({ page }) => {
  const title = await quickCapture(page, "palette");
  await openPage(page, "/");
  await page.keyboard.press("Control+k");
  const search = page.getByRole("combobox", { name: /Search notes/ });
  await expect(search).toBeFocused();
  await search.fill(title);
  await expect(page.getByRole("option", { name: new RegExp(title) })).toBeVisible();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/notes\?open=/);
  await expect(page.getByRole("dialog").getByRole("heading", { name: title })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.keyboard.press("n");
  await expect(page).toHaveURL(/\/write$/);
  await page.getByLabel("Title").fill("n");
  await expect(page).toHaveURL(/\/write$/);
  await page.getByLabel("Title").fill("");
});

test("settings: theme choice persists and dark mode applies", async ({ page }) => {
  await openPage(page, "/settings");
  await page.getByRole("radio", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const background = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  expect(background).toBe("rgb(10, 15, 28)");
  await page.getByRole("radio", { name: "Match device" }).click();
  await expect(page.locator("html")).not.toHaveAttribute("data-theme", /.+/);
});

test("settings: backup downloads every live note as Markdown and JSON", async ({ page }) => {
  const title = await quickCapture(page, "backup");
  await openPage(page, "/settings");
  for (const [label, check] of [
    ["Download as Markdown", (text: string) => expect(text).toContain(`# ${title}`)],
    ["Download as JSON", (text: string) => expect(JSON.parse(text).notes.some((note: { title: string }) => note.title === title)).toBe(true)],
  ] as const) {
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: label }).click()]);
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(chunk as Buffer);
    check(Buffer.concat(chunks).toString("utf8"));
  }
  await expect(page.getByText(/^Exported \d+ notes?\./)).toBeVisible();
});
