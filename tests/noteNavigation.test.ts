import { describe, expect, test } from "vitest";
import { recentNoteHref } from "../src/lib/noteNavigation";
import type { Note } from "../src/lib/validations";

describe("recent note navigation", () => {
  test.each(["normal", "secure"] as const)("opens a %s note directly", (mode) => {
    expect(recentNoteHref({ id: "note 1", mode } as Note)).toBe("/notes?open=note%201");
  });

  test("opens collaborative notes in their editor", () => {
    expect(recentNoteHref({ id: "room 1", mode: "collab" } as Note)).toBe("/collab/room%201");
  });
});
