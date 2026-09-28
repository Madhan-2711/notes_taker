import type { Attachment } from "./services/attachments";

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
