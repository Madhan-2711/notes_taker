import { collection, getDocs, query, where } from "firebase/firestore";
import * as Y from "yjs";
import { db } from "./firebaseConfig";
import { base64ToArrayBuffer } from "./services/crypto/serialization";
import { decryptData } from "./services/crypto/decrypt";
import { decryptKeyFromUser } from "./services/crypto/sharing";
import { readSecureNote } from "./services/notes/secureNotesService";
import { deltaFromPlain, parseRichContent, plainFromDelta, sanitizeDelta, type RichDelta, type RichOp } from "./richText";
import { deltaToMarkdown } from "./richExport";
import { EMPTY_META, type NoteMeta } from "./noteMeta";
import { noteModeInfo } from "./noteModes";
import { isCollabNote, isNormalNote, isSecureNote, type Group, type Note } from "./validations";

export interface BackupEntry {
  id: string;
  type: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  groups: string[];
  tags: string[];
  archived: boolean;
  /** False when the note is encrypted and the vault was locked during export. */
  included: boolean;
  text: string;
  markdown: string;
}

export interface BackupResult {
  entries: BackupEntry[];
  skipped: number;
}

/** Decrypts a shared note's latest state: the saved checkpoint plus every update made since. */
async function readCollabDelta(note: Note, userId: string, privateKey: CryptoKey): Promise<{ title: string; delta: RichDelta }> {
  if (!isCollabNote(note) || !note.encryptedKeys?.[userId]) throw new Error("No access to this shared note.");
  const key = await decryptKeyFromUser(note.encryptedKeys[userId], privateKey);
  const title = note.encryptedTitle && note.titleIv ? await decryptData(note.encryptedTitle, note.titleIv, key) : note.title;
  const ydoc = new Y.Doc();
  try {
    if (note.latestSnapshot && note.snapshotIv) {
      const snapshot = await decryptData(note.latestSnapshot, note.snapshotIv, key);
      Y.applyUpdate(ydoc, new Uint8Array(base64ToArrayBuffer(snapshot)));
    }
    const updates = await getDocs(query(collection(db, "note_updates"), where("noteId", "==", note.id)));
    for (const item of updates.docs) {
      const data = item.data();
      if (typeof data.encryptedUpdate !== "string" || typeof data.iv !== "string") continue;
      const decrypted = await decryptData(data.encryptedUpdate, data.iv, key);
      Y.applyUpdate(ydoc, new Uint8Array(base64ToArrayBuffer(decrypted)));
    }
    return { title: title || "Untitled", delta: sanitizeDelta({ ops: ydoc.getText("content").toDelta() as RichOp[] }) };
  } finally {
    ydoc.destroy();
  }
}

async function readNote(note: Note, userId: string, privateKey: CryptoKey | null): Promise<{ title: string; delta: RichDelta } | null> {
  if (isNormalNote(note)) {
    return { title: note.title, delta: parseRichContent(note.richContent) ?? deltaFromPlain(note.content) };
  }
  if (!privateKey) return null;
  if (isSecureNote(note)) {
    const { title, content, richContent } = await readSecureNote(note.id, userId, privateKey);
    return { title, delta: parseRichContent(richContent) ?? deltaFromPlain(content) };
  }
  return readCollabDelta(note, userId, privateKey);
}

/**
 * Builds a decrypted backup of every live note (trash excluded). Encrypted notes are only
 * included when the vault is open; otherwise they are listed with included: false.
 */
export async function buildBackup(
  notes: Note[],
  userId: string,
  privateKey: CryptoKey | null,
  groups: Group[],
  metaByNote: Map<string, NoteMeta>,
  onProgress?: (done: number, total: number) => void,
): Promise<BackupResult> {
  const live = notes.filter((note) => !note.deletedAt).sort((a, b) => b.createdAt - a.createdAt);
  const groupNames = new Map(groups.map((group) => [group.id, group.title]));
  const entries: BackupEntry[] = [];
  let skipped = 0;

  for (const [index, note] of live.entries()) {
    const meta = metaByNote.get(note.id) ?? EMPTY_META;
    let read: { title: string; delta: RichDelta } | null = null;
    try { read = await readNote(note, userId, privateKey); }
    catch { read = null; }
    if (!read) skipped += 1;
    const title = read?.title || (isNormalNote(note) ? note.title : "Encrypted note");
    entries.push({
      id: note.id,
      type: noteModeInfo(note.mode).label,
      title,
      createdAt: new Date(note.createdAt).toISOString(),
      updatedAt: new Date(note.updatedAt || note.createdAt).toISOString(),
      groups: (note.groupIds ?? []).map((id) => groupNames.get(id)).filter((name): name is string => Boolean(name)),
      tags: meta.tags,
      archived: meta.archived,
      included: Boolean(read),
      text: read ? plainFromDelta(read.delta) : "",
      markdown: read ? deltaToMarkdown(title, read.delta) : `# ${title}\n\n*Encrypted. Unlock your vault and export again to include this note.*`,
    });
    onProgress?.(index + 1, live.length);
  }
  return { entries, skipped };
}

export function backupToJson(result: BackupResult, exportedAt: Date): string {
  return JSON.stringify({
    app: "Notes Taker",
    version: 1,
    exportedAt: exportedAt.toISOString(),
    // The Markdown rendering is only for the .md export; JSON keeps plain text.
    notes: result.entries.map((entry) => ({
      id: entry.id, type: entry.type, title: entry.title, createdAt: entry.createdAt, updatedAt: entry.updatedAt,
      groups: entry.groups, tags: entry.tags, archived: entry.archived, included: entry.included, text: entry.text,
    })),
  }, null, 2);
}

export function backupToMarkdown(result: BackupResult, exportedAt: Date): string {
  const header = `Notes Taker backup, exported ${exportedAt.toLocaleString()}. ${result.entries.length} notes.`;
  return [header, ...result.entries.map((entry) => {
    const details = [
      `Type: ${entry.type}`,
      `Created: ${new Date(entry.createdAt).toLocaleString()}`,
      entry.groups.length ? `Groups: ${entry.groups.join(", ")}` : "",
      entry.tags.length ? `Tags: ${entry.tags.map((tag) => `#${tag}`).join(" ")}` : "",
      entry.archived ? "Archived" : "",
    ].filter(Boolean).join(" | ");
    // deltaToMarkdown starts with the title heading; put the details right under it.
    const [heading, ...body] = entry.markdown.split("\n");
    return [heading, "", `_${details}_`, ...body].join("\n");
  })].join("\n\n---\n\n");
}
