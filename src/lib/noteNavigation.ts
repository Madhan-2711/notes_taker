import { isCollabNote, type Note } from "./validations";

export function recentNoteHref(note: Note): string {
  const id = encodeURIComponent(note.id);
  return isCollabNote(note) ? `/collab/${id}` : `/notes?open=${id}`;
}
