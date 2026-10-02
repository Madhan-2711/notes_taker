import { isCollabNote, type Note } from "./validations";
import { deleteNote } from "./services/notes/normalNotesService";
import { deleteCollabNote } from "./services/notes/collaborativeNotesService";

export const TRASH_RETENTION_DAYS = 30;
const AUTO_EMPTY_KEY = "notes_taker_auto_empty_trash";

/** Notes the user owns that have been in trash longer than the retention period. */
export function expiredTrash(notes: Note[], userId: string, now: number, days = TRASH_RETENTION_DAYS): Note[] {
  const cutoff = now - days * 24 * 60 * 60 * 1000;
  return notes.filter((note) => note.authorId === userId && typeof note.deletedAt === "number" && note.deletedAt <= cutoff);
}

/** Permanently removes a note with its files, history and (for shared notes) live updates and comments. */
export async function deleteNoteForever(note: Note): Promise<void> {
  if (isCollabNote(note)) await deleteCollabNote(note.id);
  else await deleteNote(note.id);
}

/** Deletes notes one at a time so a failure partway reports how many were removed. */
export async function deleteNotesForever(notes: Note[]): Promise<number> {
  let removed = 0;
  for (const note of notes) {
    await deleteNoteForever(note);
    removed += 1;
  }
  return removed;
}

/** Whether this device empties old trash automatically; off unless the user turns it on. */
export function autoEmptyTrashEnabled(): boolean {
  try { return window.localStorage.getItem(AUTO_EMPTY_KEY) === "on"; } catch { return false; }
}

export function setAutoEmptyTrash(enabled: boolean) {
  try {
    if (enabled) window.localStorage.setItem(AUTO_EMPTY_KEY, "on");
    else window.localStorage.removeItem(AUTO_EMPTY_KEY);
  } catch {
    /* Storage unavailable: the setting simply stays off. */
  }
}
