import { expect, test } from "@playwright/test";
import { cleanUpTestNotes, expectToast, openPage, quickCapture, uniqueTitle } from "./helpers";

test.describe.configure({ mode: "serial" });

test.afterAll(async ({ browser }) => {
  const context = await browser.newContext({ storageState: test.info().project.use.storageState as string });
  const page = await context.newPage();
  await cleanUpTestNotes(page);
  await context.close();
});

test("reminders: quick preset, then clear", async ({ page }) => {
  const title = await quickCapture(page, "reminder");
  await openPage(page, "/notes");
  await page.getByRole("button", { name: `Open ${title}` }).click();
  const dialog = page.getByRole("dialog", { name: title });
  await dialog.getByRole("button", { name: "Set reminder" }).click();
  await dialog.getByRole("button", { name: "Tomorrow, 9 AM" }).click();
  await expect(dialog.getByText(/Reminds you/)).toBeVisible();
  await expect(dialog.getByLabel("Repeat")).toBeVisible();
  await dialog.getByRole("button", { name: "Clear" }).click();
  await expect(dialog.getByLabel("Remind me on")).toBeVisible();
});

test("calendar: month navigation, arrow keys and the day panel", async ({ page }) => {
  await openPage(page, "/calendar");
  const heading = page.locator("#month-heading");
  const start = await heading.textContent();
  await expect(page.locator("[data-day][aria-label*='today']")).toHaveAttribute("aria-pressed", "true");
  await page.locator("[data-day][tabindex='0']").focus();
  await page.keyboard.press("ArrowDown");
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("data-day"));
  expect(focused).toBeTruthy();
  await expect(page.locator("#day-heading")).not.toContainText("Today");
  await page.getByRole("button", { name: "Next month" }).click();
  await expect(heading).not.toHaveText(start ?? "");
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await expect(heading).toHaveText(start ?? "");
});

test("Today's note creates the journal once, then reopens it", async ({ page }) => {
  await openPage(page, "/");
  await page.getByRole("button", { name: "Today's note" }).click();
  await expect(page).toHaveURL(/edit=1/, { timeout: 20_000 });
  await expect(page.getByRole("dialog", { name: "Edit note" })).toBeVisible();
  await page.keyboard.press("Escape");
  await openPage(page, "/");
  await page.getByRole("button", { name: "Today's note" }).click();
  await expect(page).toHaveURL(/open=/);
  expect(page.url()).not.toContain("edit=1");
  const journalTitle = (await page.getByRole("dialog").locator("h2").first().textContent()) ?? "";
  await page.keyboard.press("Escape");
  // Not an E2E-prefixed note, so move it to trash here.
  await openPage(page, "/notes");
  await page.getByRole("button", { name: `More actions for ${journalTitle}` }).first().click();
  await page.getByRole("menuitem", { name: "Move to trash" }).click();
  await expectToast(page, "Moved to trash");
});

test("import: Google Keep and Markdown files, with skipped files explained", async ({ page }) => {
  const keep = uniqueTitle("keep");
  const markdown = uniqueTitle("markdown");
  await openPage(page, "/settings");
  await page.getByLabel("Choose files to import").setInputFiles([
    { name: "keep.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify({ title: keep, listContent: [{ text: "Eggs", isChecked: true }], labels: [{ name: "E2E" }] })) },
    { name: "plan.md", mimeType: "text/markdown", buffer: Buffer.from(`# ${markdown}\n\n- one\n- **two**`) },
    { name: "photo.png", mimeType: "image/png", buffer: Buffer.from("x") },
  ]);
  const dialog = page.getByRole("dialog", { name: "Import notes" });
  await expect(dialog.getByText("Some files were skipped")).toBeVisible();
  await dialog.getByRole("button", { name: /^Import 2 notes/ }).click();
  await expectToast(page, "Imported 2 notes");
  await openPage(page, "/notes");
  await expect(page.getByRole("button", { name: `Open ${keep}` })).toBeVisible();
  await expect(page.getByRole("button", { name: `Open ${markdown}` })).toBeVisible();
});

test("text from image reads a picture and inserts the text", async ({ page }) => {
  await openPage(page, "/write");
  const png = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 900;
    canvas.height = 200;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#111";
    context.font = "48px Arial";
    context.fillText("Quarterly report due Friday", 40, 110);
    return canvas.toDataURL("image/png").split(",")[1];
  });
  await page.getByRole("button", { name: "Text from image" }).click();
  const dialog = page.getByRole("dialog", { name: "Text from image" });
  await dialog.getByLabel("Choose an image").setInputFiles({ name: "note.png", mimeType: "image/png", buffer: Buffer.from(png, "base64") });
  const result = dialog.getByLabel(/Recognised text/);
  await expect(result).toBeVisible({ timeout: 90_000 });
  await expect(result).toHaveValue(/Quarterly report/i);
  await dialog.getByRole("button", { name: "Insert into note" }).click();
  await expect(page.locator(".ql-editor").first()).toContainText(/Quarterly report/i);
  await page.locator(".ql-editor").first().click();
  await page.keyboard.press("Control+a");
  await page.keyboard.press("Delete");
});

test("shared items open on the Write page and the stored copy is removed", async ({ page }) => {
  await openPage(page, "/write");
  const title = uniqueTitle("shared");
  const id = `e2e${Date.now().toString(36)}`;
  // Stands in for the service worker, which only runs in production builds.
  await page.evaluate(async ({ id, title }) => {
    const cache = await caches.open("notes-share-inbox");
    await cache.put(`/share-inbox/${id}/file-0`, new Response(new Blob(["img"], { type: "image/png" })));
    await cache.put(`/share-inbox/${id}/meta`, new Response(JSON.stringify({ title, text: "Worth reading", url: "https://example.com/a", files: [{ key: `/share-inbox/${id}/file-0`, name: "cover.png", type: "image/png" }] })));
  }, { id, title });
  await openPage(page, `/write?shared=${id}`);
  await expect(page.getByText(/Added what you shared\. 1 file is ready to attach/)).toBeVisible();
  await expect(page.getByLabel("Title")).toHaveValue(title);
  await expect(page.locator(".ql-editor").first()).toContainText("https://example.com/a");
  await expect(page.getByRole("list", { name: "Files to attach" })).toContainText("cover.png");
  expect(await page.evaluate(async (id) => Boolean(await (await caches.open("notes-share-inbox")).match(`/share-inbox/${id}/meta`)), id)).toBe(false);
  await page.getByLabel("Title").fill("");
  await page.locator(".ql-editor").first().click();
  await page.keyboard.press("Control+a");
  await page.keyboard.press("Delete");
});
