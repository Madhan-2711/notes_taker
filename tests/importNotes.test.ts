import { describe, expect, test } from "vitest";
import { markdownToDelta, parseImportFile } from "../src/lib/importNotes";
import { plainFromDelta, type RichDelta } from "../src/lib/richText";
import { deltaToMarkdown } from "../src/lib/richExport";

/** Attributes of each line break, i.e. the block formats in order. */
const lineFormats = (delta: RichDelta) =>
  delta.ops.filter((op) => op.insert === "\n").map((op) => ("attributes" in op ? op.attributes : undefined));

describe("markdownToDelta", () => {
  test("headings, lists, tasks and inline styles", () => {
    const delta = markdownToDelta("## Plan\n- milk\n1. first\n- [x] done\n- [ ] todo\n**bold** and *it* and ~~gone~~");
    expect(lineFormats(delta).map((attributes) => attributes ?? {})).toEqual([{ header: 2 }, { list: "bullet" }, { list: "ordered" }, { list: "checked" }, { list: "unchecked" }, {}]);
    expect(delta.ops).toContainEqual({ insert: "bold", attributes: { bold: true } });
    expect(delta.ops).toContainEqual({ insert: "it", attributes: { italic: true } });
    expect(delta.ops).toContainEqual({ insert: "gone", attributes: { strike: true } });
  });

  test("reads the plain-text list markers Notes Taker exports", () => {
    expect(lineFormats(markdownToDelta("• a\n☐ b\n☑ c"))).toEqual([{ list: "bullet" }, { list: "unchecked" }, { list: "checked" }]);
  });

  test("round-trips through the Markdown export", () => {
    const original = markdownToDelta("Intro\n- [ ] one\n- two");
    const exported = deltaToMarkdown("Title", original);
    const back = parseImportFile("note.md", exported)[0];
    expect(back.title).toBe("Title");
    expect(plainFromDelta(back.delta)).toBe(plainFromDelta(original));
  });
});

describe("parseImportFile", () => {
  test("a single Markdown file uses its first heading as the title, or the file name", () => {
    expect(parseImportFile("trip.md", "# Lisbon trip\n\nPack light")[0]).toMatchObject({ title: "Lisbon trip" });
    expect(parseImportFile("packing_list.md", "socks")[0].title).toBe("packing list");
  });

  test("the combined Markdown backup splits into notes with groups, tags and archive", () => {
    const backup = [
      "Notes Taker backup, exported today. 2 notes.",
      "# Groceries\n\n_Type: Note | Created: today | Groups: Home | Tags: #shopping | Archived_\n- milk\n",
      "# Locked\n\n_Type: Private | Created: today_\n\n*Encrypted. Unlock your vault and export again to include this note.*\n",
    ].join("\n\n---\n\n");
    const notes = parseImportFile("backup.md", backup);
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ title: "Groceries", groups: ["Home"], tags: ["shopping"], archived: true });
    expect(plainFromDelta(notes[0].delta)).toContain("milk");
  });

  test("the JSON backup skips notes that weren't included", () => {
    const json = JSON.stringify({ app: "Notes Taker", version: 1, notes: [
      { title: "A", text: "• one", tags: ["x"], groups: ["G"], archived: false, included: true },
      { title: "B", text: "", included: false },
    ] });
    const notes = parseImportFile("notes.json", json);
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ title: "A", tags: ["x"], groups: ["G"] });
  });

  test("Google Keep notes: text, checklists, labels; trashed notes are skipped", () => {
    const text = parseImportFile("a.json", JSON.stringify({ title: "", textContent: "Call the plumber\nTomorrow", labels: [{ name: "Home" }], isArchived: true }))[0];
    expect(text).toMatchObject({ title: "Call the plumber", tags: ["home"], archived: true });
    const list = parseImportFile("b.json", JSON.stringify({ title: "Shopping", listContent: [{ text: "Eggs", isChecked: true }, { text: "Bread", isChecked: false }] }))[0];
    expect(lineFormats(list.delta)).toEqual([{ list: "checked" }, { list: "unchecked" }]);
    expect(parseImportFile("c.json", JSON.stringify({ title: "Old", textContent: "x", isTrashed: true }))).toEqual([]);
  });

  test("unsupported files explain themselves", () => {
    expect(() => parseImportFile("photo.png", "")).toThrow(/only .json, .md and .txt/);
    expect(() => parseImportFile("data.json", "{\"x\":1}")).toThrow(/isn't a Notes Taker backup or a Google Keep note/);
  });
});
