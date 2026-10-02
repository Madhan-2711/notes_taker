/** Reads and clears items the service worker saved from the system share sheet. */
export const SHARE_CACHE = "notes-share-inbox";

export interface SharedItem {
  title: string;
  text: string;
  url: string;
  files: File[];
}

export async function takeSharedItem(id: string): Promise<SharedItem | null> {
  if (!/^[a-z0-9]+$/.test(id) || typeof caches === "undefined") return null;
  const cache = await caches.open(SHARE_CACHE);
  const metaResponse = await cache.match(`/share-inbox/${id}/meta`);
  if (!metaResponse) return null;
  const meta = await metaResponse.json() as { title?: string; text?: string; url?: string; files?: { key: string; name: string; type: string }[] };
  const files: File[] = [];
  for (const entry of meta.files ?? []) {
    const response = await cache.match(entry.key);
    if (response) files.push(new File([await response.blob()], entry.name, { type: entry.type }));
    await cache.delete(entry.key);
  }
  await cache.delete(`/share-inbox/${id}/meta`);
  return { title: meta.title ?? "", text: meta.text ?? "", url: meta.url ?? "", files };
}

const TEXT_FILE = /\.(txt|md|markdown)$/i;

/**
 * Turns a share into note parts: a title, text to add, and files to attach. Shared text
 * files are read into the note instead of being attached.
 */
export async function shareToNote(item: SharedItem): Promise<{ title: string; text: string; attachments: File[] }> {
  const parts: string[] = [];
  if (item.text.trim()) parts.push(item.text.trim());
  // Many apps put the link in "text" as well; don't repeat it.
  if (item.url && !item.text.includes(item.url)) parts.push(item.url);
  const attachments: File[] = [];
  for (const file of item.files) {
    if (TEXT_FILE.test(file.name) || file.type === "text/plain" || file.type === "text/markdown") parts.push((await file.text()).trim());
    else attachments.push(file);
  }
  const firstLine = parts.join("\n").split("\n").find((line) => line.trim()) ?? "";
  let title = item.title.trim();
  if (!title && item.url) {
    try { title = new URL(item.url).hostname.replace(/^www\./, ""); } catch { /* keep looking */ }
  }
  if (!title) title = firstLine.slice(0, 80);
  if (!title && attachments[0]) title = attachments[0].name.replace(/\.[^.]+$/, "");
  return { title: title.slice(0, 100), text: parts.filter(Boolean).join("\n\n"), attachments };
}
