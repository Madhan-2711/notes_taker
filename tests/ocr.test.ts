import { describe, expect, test } from "vitest";
import { tidyRecognizedText } from "../src/lib/ocr";

describe("tidyRecognizedText", () => {
  test("trims lines, drops empty ones and keeps paragraph breaks", () => {
    expect(tidyRecognizedText("  Line one \n\n\n  Line two\r\n line three \n\n")).toBe("Line one\n\nLine two\nline three");
  });
});
