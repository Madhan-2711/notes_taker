import { describe, expect, test } from "vitest";
import { sectionNotes, sortNotes } from "../src/lib/noteSort";
import type { Note } from "../src/lib/validations";

const day = 24 * 60 * 60 * 1000;
const base = new Date(2026, 9, 2, 12).getTime();

function note(id: string, title: string, createdAt: number, updatedAt = createdAt): Note {
  return { id, title, content: "", authorId: "u1", createdAt, updatedAt, mode: "normal", groupIds: [] } as unknown as Note;
}

const notes = [
  note("a", "banana", base - 2 * day, base),
  note("b", "Apple", base - day, base - day),
  note("c", "cherry", base, base),
  note("d", "10 ideas", base - 3 * day, base - 3 * day),
];
const titleOf = (n: Note) => (n as unknown as { title: string }).title;

describe("sortNotes", () => {
  test("last edited puts the most recently updated first", () => {
    expect(sortNotes(notes, "updated", titleOf).map((n) => n.id)).toEqual(["a", "c", "b", "d"]);
  });

  test("date created ignores later edits", () => {
    expect(sortNotes(notes, "created", titleOf).map((n) => n.id)).toEqual(["c", "b", "a", "d"]);
  });

  test("title sorts case-insensitively with numbers first", () => {
    expect(sortNotes(notes, "title", titleOf).map((n) => n.id)).toEqual(["d", "b", "a", "c"]);
  });

  test("does not mutate the input", () => {
    const before = notes.map((n) => n.id);
    sortNotes(notes, "title", titleOf);
    expect(notes.map((n) => n.id)).toEqual(before);
  });
});

describe("sectionNotes", () => {
  test("groups date sorts by calendar day in order", () => {
    const sections = sectionNotes(sortNotes(notes, "updated", titleOf), "updated", titleOf, "en-US");
    expect(sections.map((s) => s.notes.map((n) => n.id))).toEqual([["a", "c"], ["b"], ["d"]]);
    expect(sections[0].label).toContain("2026");
  });

  test("groups title sort by first letter, with non-letters under #", () => {
    const sections = sectionNotes(sortNotes(notes, "title", titleOf), "title", titleOf, "en-US");
    expect(sections.map((s) => s.label)).toEqual(["#", "A", "B", "C"]);
  });
});
