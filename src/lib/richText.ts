import { parseNoteParts } from "./inlineImages";

/**
 * Rich note content is stored as a Quill Delta. Everything read back — from
 * Firestore, a decrypted payload or a collaborator — goes through
 * sanitizeDelta, so only these formats and values ever reach an editor or an
 * export.
 */
export const RICH_FONT_SIZES = ["12px", "14px", "16px", "24px", "32px", "48px"] as const;
export const MAX_RICH_JSON = 100_000;
export const MAX_PLAIN_TEXT = 5_000;

export type ListType = "ordered" | "bullet" | "checked" | "unchecked";

export interface InlineAttributes {
  bold?: true;
  italic?: true;
  underline?: true;
  strike?: true;
  color?: string;
  background?: string;
  size?: string;
}

export interface LineAttributes {
  header?: 1 | 2 | 3;
  list?: ListType;
  align?: "center" | "right" | "justify";
}

export type RichAttributes = InlineAttributes & LineAttributes;
export interface NoteImageValue { id: string; alt: string }
export type RichOp =
  | { insert: string; attributes?: RichAttributes }
  | { insert: { noteImage: NoteImageValue } };
export interface RichDelta { ops: RichOp[] }

const COLOR = /^(#[0-9a-f]{3}|#[0-9a-f]{6}|rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+)\s*)?\))$/i;
const IMAGE_ID = /^[a-zA-Z0-9]{1,80}$/;

export function sanitizeImageValue(value: unknown): NoteImageValue | null {
  if (!value || typeof value !== "object") return null;
  const { id, alt } = value as Partial<NoteImageValue>;
  if (typeof id !== "string" || !IMAGE_ID.test(id)) return null;
  return { id, alt: typeof alt === "string" ? alt.replace(/[\[\]\n]/g, " ").slice(0, 120) : "" };
}

function sanitizeAttributes(value: unknown): RichAttributes | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as Record<string, unknown>;
  const clean: RichAttributes = {};
  for (const flag of ["bold", "italic", "underline", "strike"] as const) if (raw[flag] === true) clean[flag] = true;
  for (const key of ["color", "background"] as const) {
    if (typeof raw[key] === "string" && COLOR.test(raw[key] as string)) clean[key] = raw[key] as string;
  }
  if (typeof raw.size === "string" && (RICH_FONT_SIZES as readonly string[]).includes(raw.size)) clean.size = raw.size;
  if (raw.header === 1 || raw.header === 2 || raw.header === 3) clean.header = raw.header;
  if (raw.list === "ordered" || raw.list === "bullet" || raw.list === "checked" || raw.list === "unchecked") clean.list = raw.list;
  if (raw.align === "center" || raw.align === "right" || raw.align === "justify") clean.align = raw.align;
  return Object.keys(clean).length ? clean : undefined;
}

export function sanitizeDelta(value: unknown): RichDelta {
  const source = value && typeof value === "object" && Array.isArray((value as { ops?: unknown }).ops)
    ? (value as { ops: unknown[] }).ops
    : [];
  const ops: RichOp[] = [];
  for (const entry of source.slice(0, 20_000)) {
    if (!entry || typeof entry !== "object") continue;
    const { insert, attributes } = entry as { insert?: unknown; attributes?: unknown };
    if (typeof insert === "string") {
      if (!insert) continue;
      const clean = sanitizeAttributes(attributes);
      ops.push(clean ? { insert, attributes: clean } : { insert });
    } else if (insert && typeof insert === "object" && "noteImage" in insert) {
      const image = sanitizeImageValue((insert as { noteImage: unknown }).noteImage);
      if (image) ops.push({ insert: { noteImage: image } });
    }
  }
  const last = ops[ops.length - 1];
  if (!last || typeof last.insert !== "string" || !last.insert.endsWith("\n")) ops.push({ insert: "\n" });
  return { ops };
}

export function parseRichContent(json: string | null | undefined): RichDelta | null {
  if (!json) return null;
  try {
    return sanitizeDelta(JSON.parse(json));
  } catch {
    return null;
  }
}

export function serializeDelta(delta: RichDelta): string {
  return JSON.stringify(sanitizeDelta(delta));
}

/** Converts legacy plain content, including image tokens, into a Delta. */
export function deltaFromPlain(content: string): RichDelta {
  const ops: RichOp[] = [];
  let afterImage = false;
  for (const part of parseNoteParts(content)) {
    if (part.kind === "text") {
      // A picture is its own block, so the line break that followed its token is redundant.
      const value = afterImage && part.value.startsWith("\n") ? part.value.slice(1) : part.value;
      if (value) ops.push({ insert: value });
      afterImage = false;
    } else {
      afterImage = true;
      const last = ops[ops.length - 1];
      if (last && typeof last.insert === "string" && !last.insert.endsWith("\n")) last.insert += "\n";
      ops.push({ insert: { noteImage: { id: part.id, alt: part.alt } } });
    }
  }
  return sanitizeDelta({ ops });
}

export interface TextSegment { text: string; attributes?: InlineAttributes }
export type RichBlock =
  | { kind: "line"; segments: TextSegment[]; attributes: LineAttributes }
  | { kind: "image"; image: NoteImageValue };

function inlineOnly(attributes?: RichAttributes): InlineAttributes | undefined {
  if (!attributes) return undefined;
  const { bold, italic, underline, strike, color, background, size } = attributes;
  const inline = Object.fromEntries(Object.entries({ bold, italic, underline, strike, color, background, size }).filter(([, value]) => value !== undefined));
  return Object.keys(inline).length ? (inline as InlineAttributes) : undefined;
}

function lineOnly(attributes?: RichAttributes): LineAttributes {
  if (!attributes) return {};
  const { header, list, align } = attributes;
  return Object.fromEntries(Object.entries({ header, list, align }).filter(([, value]) => value !== undefined)) as LineAttributes;
}

/** Splits a Delta into lines and pictures, the shape every renderer works from. */
export function deltaToBlocks(delta: RichDelta): RichBlock[] {
  const blocks: RichBlock[] = [];
  let segments: TextSegment[] = [];
  for (const op of sanitizeDelta(delta).ops) {
    if (typeof op.insert !== "string") {
      if (segments.length) blocks.push({ kind: "line", segments, attributes: {} });
      segments = [];
      blocks.push({ kind: "image", image: op.insert.noteImage });
      continue;
    }
    const attributes = "attributes" in op ? op.attributes : undefined;
    const parts = op.insert.split("\n");
    parts.forEach((part, index) => {
      if (part) segments.push({ text: part, attributes: inlineOnly(attributes) });
      if (index < parts.length - 1) {
        blocks.push({ kind: "line", segments, attributes: lineOnly(attributes) });
        segments = [];
      }
    });
  }
  if (segments.length) blocks.push({ kind: "line", segments, attributes: {} });
  return blocks;
}

/** Readable text for search, note cards and plain exports. */
export function plainFromDelta(delta: RichDelta): string {
  const lines: string[] = [];
  let number = 0;
  for (const block of deltaToBlocks(delta)) {
    if (block.kind === "image") {
      number = 0;
      continue;
    }
    const text = block.segments.map((segment) => segment.text).join("");
    const list = block.attributes.list;
    number = list === "ordered" ? number + 1 : 0;
    const prefix = list === "bullet" ? "• " : list === "ordered" ? `${number}. ` : list === "checked" ? "☑ " : list === "unchecked" ? "☐ " : "";
    lines.push(prefix + text);
  }
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  return lines.join("\n");
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

function segmentHtml(segment: TextSegment): string {
  const attributes = segment.attributes ?? {};
  let html = escapeHtml(segment.text);
  const style = [
    attributes.color && `color:${attributes.color}`,
    attributes.background && `background-color:${attributes.background}`,
    attributes.size && `font-size:${attributes.size}`,
  ].filter(Boolean).join(";");
  if (style) html = `<span style="${escapeHtml(style)}">${html}</span>`;
  if (attributes.strike) html = `<s>${html}</s>`;
  if (attributes.underline) html = `<u>${html}</u>`;
  if (attributes.italic) html = `<em>${html}</em>`;
  if (attributes.bold) html = `<strong>${html}</strong>`;
  return html;
}

/**
 * Builds export HTML from sanitized blocks; every text value is escaped and
 * styles only come from validated attribute values. Image sources are
 * supplied by the caller (decrypted data URLs).
 */
export function deltaToHtml(delta: RichDelta, imageSrc: (id: string) => string | undefined = () => undefined): string {
  const out: string[] = [];
  let openList: "ol" | "ul" | "checklist" | null = null;
  const closeList = () => {
    if (openList) out.push(openList === "ol" ? "</ol>" : "</ul>");
    openList = null;
  };
  for (const block of deltaToBlocks(delta)) {
    if (block.kind === "image") {
      closeList();
      const src = imageSrc(block.image.id);
      out.push(src
        ? `<figure><img src="${escapeHtml(src)}" alt="${escapeHtml(block.image.alt)}"></figure>`
        : `<p><em>[Image: ${escapeHtml(block.image.alt || "picture")}]</em></p>`);
      continue;
    }
    const content = block.segments.map(segmentHtml).join("") || "<br>";
    const { list, header, align } = block.attributes;
    const alignStyle = align ? ` style="text-align:${align}"` : "";
    if (list) {
      const kind = list === "ordered" ? "ol" : list === "bullet" ? "ul" : "checklist";
      if (openList !== kind) {
        closeList();
        out.push(kind === "ol" ? "<ol>" : kind === "ul" ? "<ul>" : '<ul class="checklist">');
        openList = kind;
      }
      const box = list === "checked" ? "☑ " : list === "unchecked" ? "☐ " : "";
      out.push(`<li${alignStyle}>${box}${content}</li>`);
      continue;
    }
    closeList();
    const tag = header ? `h${header}` : "p";
    out.push(`<${tag}${alignStyle}>${content}</${tag}>`);
  }
  closeList();
  return out.join("\n");
}

export function imageIdsInDelta(delta: RichDelta): string[] {
  return sanitizeDelta(delta).ops.flatMap((op) => (typeof op.insert === "string" ? [] : [op.insert.noteImage.id]));
}
