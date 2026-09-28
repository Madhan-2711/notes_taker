import { describe, expect, test } from "vitest";
import { computeTextDelta } from "../src/lib/textDelta";

function applyDelta(value: string, delta: ReturnType<typeof computeTextDelta>) {
  return value.slice(0, delta.start) + delta.insertText + value.slice(delta.start + delta.deleteCount);
}

describe("computeTextDelta", () => {
  test.each([
    ["hello", "hello world"],
    ["hello world", "hello"],
    ["hello world", "hello Yjs"],
    ["abcde", "abXYZde"],
    ["same", "same"],
    ["नमस्ते", "नमस्कार"],
  ])("transforms %j into %j", (before, after) => {
    expect(applyDelta(before, computeTextDelta(before, after))).toBe(after);
  });
});
