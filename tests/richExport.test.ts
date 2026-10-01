import { describe, expect, test } from "vitest";
import { buildDocx, deltaToMarkdown } from "../src/lib/richExport";
import { sanitizeDelta } from "../src/lib/richText";

const delta = sanitizeDelta({
  ops: [
    { insert: "Plan" }, { insert: "\n", attributes: { header: 1 } },
    { insert: "Bold", attributes: { bold: true } }, { insert: " and *plain*\n" },
    { insert: "Done" }, { insert: "\n", attributes: { list: "checked" } },
    { insert: "Todo" }, { insert: "\n", attributes: { list: "unchecked" } },
    { insert: "One" }, { insert: "\n", attributes: { list: "ordered" } },
    { insert: "Two", attributes: { color: "#ff0000", size: "24px" } }, { insert: "\n", attributes: { list: "ordered", align: "center" } },
    { insert: { noteImage: { id: "img1", alt: "cat" } } },
  ],
});

describe("formatted exports", () => {
  test("Markdown keeps headings, emphasis, lists and checklists and escapes text", () => {
    expect(deltaToMarkdown("Trip", delta)).toBe(
      "# Trip\n\n## Plan\n**Bold** and \\*plain\\*\n- [x] Done\n- [ ] Todo\n1. One\n2. Two\n*[Image: cat]*\n"
    );
  });

  test("Word export produces a document even when a picture is unavailable", async () => {
    const blob = await buildDocx("Trip", delta, new Map());
    expect(blob.size).toBeGreaterThan(1000);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(String.fromCharCode(bytes[0], bytes[1])).toBe("PK");
  });
});
