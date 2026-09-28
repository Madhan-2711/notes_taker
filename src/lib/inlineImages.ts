import type { Attachment } from "./services/attachments";
import { computeTextDelta } from "./textDelta";

const IMAGE_TOKEN = /!\[([^\]\n]{0,120})\]\(attachment:([a-zA-Z0-9]{1,80})\)/g;

export type NotePart = { kind: "text"; value: string } | { kind: "image"; id: string; alt: string };

export function imageToken(file: Attachment) {
  const id = file.path.split("/").pop();
  if (!id || !/^[a-zA-Z0-9]{1,80}$/.test(id)) throw new Error("Invalid image attachment.");
  const alt = file.name.replace(/[\[\]\n]/g, " ").slice(0, 120);
  return `![${alt}](attachment:${id})`;
}

export function parseNoteParts(content: string): NotePart[] {
  const parts: NotePart[] = [];
  let start = 0;
  for (const match of content.matchAll(IMAGE_TOKEN)) {
    const offset = match.index ?? 0;
    if (offset > start) parts.push({ kind: "text", value: content.slice(start, offset) });
    parts.push({ kind: "image", alt: match[1], id: match[2] });
    start = offset + match[0].length;
  }
  if (start < content.length) parts.push({ kind: "text", value: content.slice(start) });
  return parts;
}

// Stands in for each image token while editing, so the textarea shows no raw markup.
export const IMAGE_MARKER = "⁣";

export function hideImageTokens(content: string): string {
  return content.replace(IMAGE_TOKEN, IMAGE_MARKER);
}

/** Maps a caret position in the hidden-token text back to the full content. */
export function visibleToContentIndex(content: string, visibleIndex: number): number {
  let hiddenChars = 0;
  for (const match of content.matchAll(IMAGE_TOKEN)) {
    const visiblePosition = (match.index ?? 0) - hiddenChars;
    if (visiblePosition >= visibleIndex) break;
    hiddenChars += match[0].length - 1;
  }
  return visibleIndex + hiddenChars;
}

/** Applies an edit made to the hidden-token text onto the full content. */
export function applyVisibleEdit(content: string, previousVisible: string, nextVisible: string): string {
  const { start, deleteCount, insertText } = computeTextDelta(previousVisible, nextVisible);
  const from = visibleToContentIndex(content, start);
  const to = visibleToContentIndex(content, start + deleteCount);
  return content.slice(0, from) + insertText.replaceAll(IMAGE_MARKER, "") + content.slice(to);
}
