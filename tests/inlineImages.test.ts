import { describe, expect, test } from "vitest";
import { IMAGE_MARKER, applyVisibleEdit, hideImageTokens, imageToken, parseNoteParts, visibleToContentIndex } from "../src/lib/inlineImages";

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

describe("hidden image tokens while editing", () => {
  const token = imageToken({ path: "notes/abc/attachments/img1", name: "photo.webp", size: 1, uploader: "u" });
  const content = `Hello\n${token}\nWorld`;
  const visible = hideImageTokens(content);

  test("replaces each token with a single marker", () => {
    expect(visible).toBe(`Hello\n${IMAGE_MARKER}\nWorld`);
  });

  test("keeps the token when text is typed after it", () => {
    expect(applyVisibleEdit(content, visible, `${visible}!`)).toBe(`${content}!`);
  });

  test("keeps the token when text is typed before it", () => {
    expect(applyVisibleEdit(content, visible, `Hi ${visible}`)).toBe(`Hi ${content}`);
  });

  test("removes the whole token when its marker is deleted", () => {
    const edited = visible.replace(IMAGE_MARKER, "");
    expect(applyVisibleEdit(content, visible, edited)).toBe("Hello\n\nWorld");
  });

  test("maps a caret after the marker past the full token", () => {
    const afterMarker = visible.indexOf(IMAGE_MARKER) + 1;
    expect(visibleToContentIndex(content, afterMarker)).toBe(content.indexOf(token) + token.length);
  });
});
