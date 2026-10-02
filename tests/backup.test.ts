import { describe, expect, test, vi } from "vitest";

// Encrypted reads and Firestore are not exercised here; regular notes are read from the note itself.
vi.mock("../src/lib/firebaseConfig", () => ({ db: {} }));
vi.mock("../src/lib/services/notes/secureNotesService", () => ({ readSecureNote: vi.fn() }));

import { backupToJson, backupToMarkdown, buildBackup } from "../src/lib/backup";
import type { Group, Note } from "../src/lib/validations";

const regular = { id: "n1", mode: "normal", title: "Groceries", content: "Milk\nEggs", authorId: "me", createdAt: Date.UTC(2026, 0, 2), updatedAt: Date.UTC(2026, 0, 3), groupIds: ["g1"] } as unknown as Note;
const privateNote = { id: "n2", mode: "secure", title: "", encryptedTitle: "x", authorId: "me", createdAt: Date.UTC(2026, 0, 1), updatedAt: Date.UTC(2026, 0, 1), groupIds: [] } as unknown as Note;
const trashed = { ...regular, id: "n3", deletedAt: Date.UTC(2026, 0, 4) } as unknown as Note;
const groups = [{ id: "g1", title: "Home" }] as Group[];
const meta = new Map([["n1", { tags: ["shopping"], archived: false, reminderAt: null }]]);

describe("buildBackup", () => {
  test("includes regular notes, skips trash, and lists locked encrypted notes without content", async () => {
    const result = await buildBackup([regular, privateNote, trashed], "me", null, groups, meta);
    expect(result.entries.map((entry) => entry.id)).toEqual(["n1", "n2"]);
    expect(result.skipped).toBe(1);
    expect(result.entries[0]).toMatchObject({ title: "Groceries", type: "Note", groups: ["Home"], tags: ["shopping"], included: true });
    expect(result.entries[0].text).toContain("Milk");
    expect(result.entries[1]).toMatchObject({ type: "Private", included: false, text: "" });
  });

  test("JSON and Markdown outputs carry the notes", async () => {
    const result = await buildBackup([regular], "me", null, groups, meta);
    const json = JSON.parse(backupToJson(result, new Date(Date.UTC(2026, 9, 2))));
    expect(json.notes[0]).toMatchObject({ title: "Groceries", tags: ["shopping"] });
    expect(json.notes[0].markdown).toBeUndefined();
    const markdown = backupToMarkdown(result, new Date(Date.UTC(2026, 9, 2)));
    expect(markdown).toContain("# Groceries");
    expect(markdown).toContain("Groups: Home");
    expect(markdown).toContain("#shopping");
  });
});
