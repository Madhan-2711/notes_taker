import { describe, expect, test } from "vitest";
import { imageToken, parseNoteParts, previewText } from "../src/lib/inlineImages";

describe("inline image markers", () => {
  test("round-trips image markers without changing surrounding prose", () => {
    const token = imageToken({ path: "notes/abc/attachments/xyz123", name: "sketch.webp", size: 12, uploader: "u" });
    expect(parseNoteParts(`Before\n${token}\nAfter`)).toEqual([
      { kind: "text", value: "Before\n" },
      { kind: "image", id: "xyz123", alt: "sketch.webp" },
      { kind: "text", value: "\nAfter" },
    ]);
  });

  test("does not parse external URLs as attachment images", () => {
    expect(parseNoteParts("![bad](https://example.com/x.webp)")).toEqual([{ kind: "text", value: "![bad](https://example.com/x.webp)" }]);
  });
});


test("previews show a picture label instead of the raw token", () => {
  expect(previewText("Hi\n![cat.webp](attachment:img1)")).toBe("Hi\n📷 cat.webp");
});
