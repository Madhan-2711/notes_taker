import type { Note } from "./validations";

export type NoteSort = "updated" | "created" | "title";
export type NoteLayout = "grid" | "list";

export const NOTE_SORTS: { value: NoteSort; label: string }[] = [
  { value: "updated", label: "Last edited" },
  { value: "created", label: "Date created" },
  { value: "title", label: "Title (A to Z)" },
];

export function noteTimestamp(note: Note, sort: NoteSort): number {
  return sort === "updated" ? note.updatedAt || note.createdAt : note.createdAt;
}

/** Newest first for date sorts; alphabetical (locale-aware, case-insensitive) for title. */
export function sortNotes(notes: Note[], sort: NoteSort, titleOf: (note: Note) => string): Note[] {
  const sorted = [...notes];
  if (sort === "title") {
    const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });
    sorted.sort((a, b) => collator.compare(titleOf(a).trim(), titleOf(b).trim()) || b.createdAt - a.createdAt);
  } else {
    sorted.sort((a, b) => noteTimestamp(b, sort) - noteTimestamp(a, sort));
  }
  return sorted;
}

export interface NoteSection {
  key: string;
  label: string;
  notes: Note[];
}

/**
 * Splits already-sorted notes into labelled sections: by calendar day for date sorts,
 * by first letter for title sort. Order of the input is preserved.
 */
export function sectionNotes(notes: Note[], sort: NoteSort, titleOf: (note: Note) => string, locale?: string): NoteSection[] {
  const sections: NoteSection[] = [];
  const byKey = new Map<string, NoteSection>();
  for (const note of notes) {
    let key: string;
    let label: string;
    if (sort === "title") {
      const first = titleOf(note).trim().charAt(0).toLocaleUpperCase(locale);
      key = /\p{L}/u.test(first) ? first : "#";
      label = key;
    } else {
      const date = new Date(noteTimestamp(note, sort));
      key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      label = date.toLocaleDateString(locale, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    }
    let section = byKey.get(key);
    if (!section) {
      section = { key, label, notes: [] };
      byKey.set(key, section);
      sections.push(section);
    }
    section.notes.push(note);
  }
  return sections;
}

const SORT_KEY = "notes_taker_note_sort";
const LAYOUT_KEY = "notes_taker_note_layout";

/** Per-device view preferences; storage can be unavailable (private windows), so fall back quietly. */
export function readViewPreferences(): { sort: NoteSort; layout: NoteLayout } {
  try {
    const sort = window.localStorage.getItem(SORT_KEY);
    const layout = window.localStorage.getItem(LAYOUT_KEY);
    return {
      sort: sort === "created" || sort === "title" ? sort : "updated",
      layout: layout === "list" ? "list" : "grid",
    };
  } catch {
    return { sort: "updated", layout: "grid" };
  }
}

export function saveViewPreferences(preferences: { sort: NoteSort; layout: NoteLayout }) {
  try {
    window.localStorage.setItem(SORT_KEY, preferences.sort);
    window.localStorage.setItem(LAYOUT_KEY, preferences.layout);
  } catch {
    /* Preferences are a convenience; ignore storage failures. */
  }
}
