import { sanitizeDelta, type RichDelta, type RichOp } from "./richText";
import { MAX_TAGS, normalizeTag } from "./noteMeta";

/** One note ready to be created, whatever file it came from. */
export interface ImportedNote {
  title: string;
  delta: RichDelta;
  tags: string[];
  archived: boolean;
  groups: string[];
  /** Where it came from, shown in the preview. */
  source: string;
}

export const IMPORT_ACCEPT = ".json,.md,.markdown,.txt,application/json,text/markdown,text/plain";
export const MAX_IMPORT_TITLE = 100;

type LineAttributes = { header?: 1 | 2 | 3; list?: "bullet" | "ordered" | "checked" | "unchecked" };

const unescapeMarkdown = (text: string) => text.replace(/\\([\\`*_[\]#<>~])/g, "$1");

/** **bold**, *italic* / _italic_ and ~~strike~~ into Quill ops; anything else stays as text. */
function inlineOps(text: string): RichOp[] {
  const ops: RichOp[] = [];
  const pattern = /(\*\*([^*]+)\*\*|~~([^~]+)~~|\*([^*\s][^*]*)\*|_([^_\s][^_]*)_)/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > last) ops.push({ insert: unescapeMarkdown(text.slice(last, match.index)) });
    if (match[2]) ops.push({ insert: unescapeMarkdown(match[2]), attributes: { bold: true } });
    else if (match[3]) ops.push({ insert: unescapeMarkdown(match[3]), attributes: { strike: true } });
    else ops.push({ insert: unescapeMarkdown(match[4] ?? match[5]), attributes: { italic: true } });
    last = match.index + match[0].length;
  }
  if (last < text.length) ops.push({ insert: unescapeMarkdown(text.slice(last)) });
  return ops;
}

/**
 * Markdown (and the plain-text list markers Notes Taker exports: •, ☐, ☑, "1.")
 * into a rich-text delta. `headingShift` maps "## " to heading 1 when "# " was the title.
 */
export function markdownToDelta(markdown: string, headingShift = 0): RichDelta {
  const ops: RichOp[] = [];
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  // Drop blank lines at both ends so notes don't start or end with empty paragraphs.
  while (lines.length && !lines[0].trim()) lines.shift();
  while (lines.length && !lines[lines.length - 1].trim()) lines.pop();
  for (const raw of lines) {
    let line = raw;
    let attributes: LineAttributes | undefined;
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    const task = /^\s*[-*+]\s+\[([ xX])\]\s+(.*)$/.exec(line) ?? /^\s*([☐☑])\s?(.*)$/.exec(line);
    const bullet = /^\s*(?:[-*+]|•)\s+(.*)$/.exec(line);
    const ordered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (heading) {
      const level = Math.min(3, Math.max(1, heading[1].length - headingShift)) as 1 | 2 | 3;
      attributes = { header: level };
      line = heading[2];
    } else if (task) {
      attributes = { list: task[1] === " " || task[1] === "☐" ? "unchecked" : "checked" };
      line = task[2];
    } else if (bullet) {
      attributes = { list: "bullet" };
      line = bullet[1];
    } else if (ordered) {
      attributes = { list: "ordered" };
      line = ordered[1];
    }
    ops.push(...inlineOps(line));
    ops.push(attributes ? { insert: "\n", attributes } : { insert: "\n" });
  }
  if (ops.length === 0) ops.push({ insert: "\n" });
  return sanitizeDelta({ ops });
}

function cleanTitle(title: string, fallback: string) {
  const value = title.replace(/[\r\n]+/g, " ").trim() || fallback;
  return value.slice(0, MAX_IMPORT_TITLE);
}

function cleanTags(tags: unknown[]): string[] {
  return [...new Set(tags.filter((tag): tag is string => typeof tag === "string").map(normalizeTag).filter(Boolean))].slice(0, MAX_TAGS);
}

function baseName(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
}

/** A single Markdown note: the first "# " heading becomes the title. */
function parseMarkdownNote(text: string, fileName: string): ImportedNote {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const firstContent = lines.findIndex((line) => line.trim());
  const titleMatch = firstContent >= 0 ? /^#\s+(.*)$/.exec(lines[firstContent]) : null;
  const body = titleMatch ? lines.slice(firstContent + 1).join("\n") : text;
  return {
    title: cleanTitle(titleMatch ? unescapeMarkdown(titleMatch[1]) : "", baseName(fileName) || "Imported note"),
    delta: markdownToDelta(body, titleMatch ? 1 : 0),
    tags: [],
    archived: false,
    groups: [],
    source: fileName,
  };
}

/** The combined Markdown file produced by Settings → Back up your notes. */
function parseMarkdownBackup(text: string, fileName: string): ImportedNote[] {
  const [, ...chunks] = text.replace(/\r\n?/g, "\n").split("\n\n---\n\n");
  // Notes the export couldn't decrypt carry only a placeholder; there's nothing to import.
  const readable = chunks.filter((chunk) => !chunk.includes("*Encrypted. Unlock your vault and export again"));
  return readable.map((chunk) => {
    const note = parseMarkdownNote(chunk, fileName);
    // Details line written by the export: _Type: Note | Created: … | Groups: a, b | Tags: #x #y | Archived_
    const lines = chunk.split("\n");
    const detailIndex = lines.findIndex((line) => /^_Type: .*_$/.test(line.trim()));
    if (detailIndex >= 0) {
      const parts = lines[detailIndex].trim().slice(1, -1).split(" | ");
      for (const part of parts) {
        if (part.startsWith("Groups: ")) note.groups = part.slice(8).split(", ").map((name) => name.trim()).filter(Boolean);
        else if (part.startsWith("Tags: ")) note.tags = cleanTags(part.slice(6).split(" ").map((tag) => tag.replace(/^#/, "")));
        else if (part === "Archived") note.archived = true;
      }
      lines.splice(detailIndex, 1);
      const titleIndex = lines.findIndex((line) => /^#\s/.test(line));
      note.delta = markdownToDelta(lines.slice(titleIndex + 1).join("\n"), 1);
    }
    return note;
  });
}

interface KeepNote {
  title?: string;
  textContent?: string;
  listContent?: { text?: string; isChecked?: boolean }[];
  labels?: { name?: string }[];
  isArchived?: boolean;
  isTrashed?: boolean;
}

function isKeepNote(value: unknown): value is KeepNote {
  return Boolean(value && typeof value === "object" && ("textContent" in value || "listContent" in value) && "title" in value);
}

/** A Google Keep note from a Takeout export (one JSON file per note). */
function parseKeepNote(note: KeepNote, fileName: string): ImportedNote | null {
  if (note.isTrashed) return null;
  let delta: RichDelta;
  if (Array.isArray(note.listContent) && note.listContent.length) {
    const ops: RichOp[] = [];
    for (const item of note.listContent) {
      if (item.text) ops.push({ insert: item.text });
      ops.push({ insert: "\n", attributes: { list: item.isChecked ? "checked" : "unchecked" } });
    }
    delta = sanitizeDelta({ ops });
  } else {
    delta = markdownToDelta(note.textContent ?? "");
  }
  const firstLine = (note.textContent ?? note.listContent?.[0]?.text ?? "").split("\n")[0];
  return {
    title: cleanTitle(note.title ?? "", firstLine.slice(0, 60) || baseName(fileName) || "Keep note"),
    delta,
    tags: cleanTags((note.labels ?? []).map((label) => label.name)),
    archived: note.isArchived === true,
    groups: [],
    source: fileName,
  };
}

/** Turns one file into notes. Throws a readable error for files it can't use. */
export function parseImportFile(fileName: string, text: string): ImportedNote[] {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".json")) {
    let data: unknown;
    try { data = JSON.parse(text); }
    catch { throw new Error(`${fileName} isn't valid JSON.`); }
    if (data && typeof data === "object" && (data as { app?: unknown }).app === "Notes Taker" && Array.isArray((data as { notes?: unknown }).notes)) {
      return ((data as { notes: Record<string, unknown>[] }).notes)
        .filter((note) => note.included !== false)
        .map((note) => ({
          title: cleanTitle(typeof note.title === "string" ? note.title : "", "Imported note"),
          delta: markdownToDelta(typeof note.text === "string" ? note.text : ""),
          tags: cleanTags(Array.isArray(note.tags) ? note.tags : []),
          archived: note.archived === true,
          groups: Array.isArray(note.groups) ? note.groups.filter((name): name is string => typeof name === "string") : [],
          source: fileName,
        }));
    }
    if (isKeepNote(data)) {
      const note = parseKeepNote(data, fileName);
      return note ? [note] : [];
    }
    throw new Error(`${fileName} isn't a Notes Taker backup or a Google Keep note.`);
  }
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) {
    return text.startsWith("Notes Taker backup") ? parseMarkdownBackup(text, fileName) : [parseMarkdownNote(text, fileName)];
  }
  if (lower.endsWith(".txt")) {
    return [{ title: cleanTitle(baseName(fileName), "Imported note"), delta: markdownToDelta(text), tags: [], archived: false, groups: [], source: fileName }];
  }
  throw new Error(`${fileName}: only .json, .md and .txt files can be imported.`);
}
