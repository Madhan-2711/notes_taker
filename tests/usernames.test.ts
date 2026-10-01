import { describe, expect, test } from "vitest";
import { isEmailLike, normalizeUsername, suggestUsername, usernameProblem } from "../src/lib/usernames";

describe("usernames", () => {
  test("normalizes case and a leading @", () => {
    expect(normalizeUsername("  @Alice_01 ")).toBe("alice_01");
  });

  test("validates length and characters", () => {
    expect(usernameProblem("ab")).not.toBeNull();
    expect(usernameProblem("a".repeat(21))).not.toBeNull();
    expect(usernameProblem("bad name")).not.toBeNull();
    expect(usernameProblem("good_name1")).toBeNull();
  });

  test("suggests a valid handle from a display name or email", () => {
    expect(suggestUsername("Madhan Kumar", null)).toBe("madhan_kumar");
    expect(suggestUsername(null, "jo.smith@example.com")).toBe("jo_smith");
    expect(suggestUsername("A", null)).toBe("");
  });

  test("tells emails apart from usernames", () => {
    expect(isEmailLike("friend@example.com")).toBe(true);
    expect(isEmailLike("@friend")).toBe(false);
    expect(isEmailLike("friend")).toBe(false);
  });
});
