import { describe, expect, test } from "vitest";
import {
  computeTextDelta,
  transformSelectionForRemoteDelta,
} from "../src/lib/textDelta";

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

describe("transformSelectionForRemoteDelta", () => {
  test("keeps the local cursor before a remote insert at the same position", () => {
    expect(
      transformSelectionForRemoteDelta(5, 5, [
        { retain: 5 },
        { insert: "remote" },
      ])
    ).toEqual({ start: 5, end: 5 });
  });

  test("moves the local cursor when a remote insert occurs before it", () => {
    expect(
      transformSelectionForRemoteDelta(8, 8, [
        { retain: 3 },
        { insert: "abc" },
      ])
    ).toEqual({ start: 11, end: 11 });
  });

  test("maps deletions using positions in the original text", () => {
    expect(
      transformSelectionForRemoteDelta(9, 9, [
        { retain: 2 },
        { delete: 4 },
        { retain: 3 },
        { insert: "!" },
      ])
    ).toEqual({ start: 5, end: 5 });
  });

  test("preserves a selection across a remote replacement", () => {
    expect(
      transformSelectionForRemoteDelta(6, 10, [
        { retain: 2 },
        { delete: 2 },
        { insert: "hello" },
      ])
    ).toEqual({ start: 9, end: 13 });
  });
});
