import { describe, expect, test } from "vitest";
import { deltaFromPlain, deltaToBlocks, deltaToHtml, parseRichContent, plainFromDelta, sanitizeDelta } from "../src/lib/richText";

describe("rich text sanitizing", () => {
  test("drops unknown formats, unsafe values and foreign embeds", () => {
    const delta = sanitizeDelta({
      ops: [
        { insert: "Hi", attributes: { bold: true, link: "javascript:alert(1)", color: "red;background:url(x)", size: "99px" } },
        { insert: { image: "https://evil.example/x.png" } },
        { insert: { noteImage: { id: "../../x", alt: "bad" } } },
        { insert: "\n", attributes: { header: 7, list: "checked" } },
      ],
    });
    expect(delta.ops).toEqual([
      { insert: "Hi", attributes: { bold: true } },
      { insert: "\n", attributes: { list: "checked" } },
    ]);
  });

  test("always ends with a newline and survives junk JSON", () => {
    expect(sanitizeDelta({ ops: [{ insert: "a" }] }).ops.at(-1)).toEqual({ insert: "\n" });
    expect(parseRichContent("not json")).toBeNull();
    expect(parseRichContent(JSON.stringify({ ops: "x" }))?.ops).toEqual([{ insert: "\n" }]);
  });
});

describe("rich text conversion", () => {
  test("converts legacy image tokens into picture embeds", () => {
    const delta = deltaFromPlain("Before\n![cat.webp](attachment:img1)\nAfter");
    expect(deltaToBlocks(delta).map((block) => block.kind)).toEqual(["line", "image", "line"]);
  });

  test("plain text keeps list markers and skips pictures", () => {
    const delta = sanitizeDelta({
      ops: [
        { insert: "Buy milk" }, { insert: "\n", attributes: { list: "unchecked" } },
        { insert: "Call mum" }, { insert: "\n", attributes: { list: "checked" } },
        { insert: { noteImage: { id: "img1", alt: "x" } } },
        { insert: "First" }, { insert: "\n", attributes: { list: "ordered" } },
        { insert: "Second" }, { insert: "\n", attributes: { list: "ordered" } },
      ],
    });
    expect(plainFromDelta(delta)).toBe("☐ Buy milk\n☑ Call mum\n1. First\n2. Second");
  });

  test("HTML export escapes text and groups list items", () => {
    const delta = sanitizeDelta({
      ops: [
        { insert: "<script>x</script>", attributes: { bold: true, color: "#ff0000" } }, { insert: "\n", attributes: { header: 1 } },
        { insert: "a" }, { insert: "\n", attributes: { list: "bullet" } },
        { insert: "b" }, { insert: "\n", attributes: { list: "bullet" } },
      ],
    });
    const html = deltaToHtml(delta);
    expect(html).not.toContain("<script>");
    expect(html).toContain('<h1><strong><span style="color:#ff0000">&lt;script&gt;x&lt;/script&gt;</span></strong></h1>');
    expect(html.match(/<ul>/g)).toHaveLength(1);
  });
});
