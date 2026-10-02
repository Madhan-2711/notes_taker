import { describe, expect, test, vi } from "vitest";

// Firestore-backed services are not needed to test the selection logic.
vi.mock("../src/lib/services/notes/normalNotesService", () => ({ deleteNote: vi.fn() }));
vi.mock("../src/lib/services/notes/collaborativeNotesService", () => ({ deleteCollabNote: vi.fn() }));

import { expiredTrash } from "../src/lib/trash";
import type { Note } from "../src/lib/validations";

const day = 24 * 60 * 60 * 1000;
const now = new Date(2026, 9, 2).getTime();
const note = (id: string, authorId: string, deletedAt?: number) =>
  ({ id, authorId, deletedAt, createdAt: 0, updatedAt: 0, mode: "normal" }) as unknown as Note;

describe("expiredTrash", () => {
  const notes = [
    note("old-mine", "me", now - 31 * day),
    note("exactly-30", "me", now - 30 * day),
    note("recent-mine", "me", now - 2 * day),
    note("old-theirs", "them", now - 60 * day),
    note("live", "me"),
  ];

  test("returns only the user's notes trashed 30 or more days ago", () => {
    expect(expiredTrash(notes, "me", now).map((n) => n.id)).toEqual(["old-mine", "exactly-30"]);
  });

  test("respects a custom retention period", () => {
    expect(expiredTrash(notes, "me", now, 1).map((n) => n.id)).toEqual(["old-mine", "exactly-30", "recent-mine"]);
  });
});
