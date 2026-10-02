import { describe, expect, test } from "vitest";
import { shareToNote } from "../src/lib/shareInbox";

describe("shareToNote", () => {
  test("uses the shared title and text, and doesn't repeat a link already in the text", async () => {
    const note = await shareToNote({ title: "Recipe", text: "Try this https://example.com/pie", url: "https://example.com/pie", files: [] });
    expect(note).toEqual({ title: "Recipe", text: "Try this https://example.com/pie", attachments: [] });
  });

  test("a bare link gets the site name as its title", async () => {
    const note = await shareToNote({ title: "", text: "", url: "https://www.example.org/article", files: [] });
    expect(note.title).toBe("example.org");
    expect(note.text).toBe("https://www.example.org/article");
  });

  test("text files are read into the note; images and PDFs are attached", async () => {
    const files = [
      new File(["Line from a file"], "notes.txt", { type: "text/plain" }),
      new File(["png"], "photo.png", { type: "image/png" }),
    ];
    const note = await shareToNote({ title: "", text: "", url: "", files });
    expect(note.text).toBe("Line from a file");
    expect(note.title).toBe("Line from a file");
    expect(note.attachments.map((file) => file.name)).toEqual(["photo.png"]);
  });
});
