import { describe, expect, test } from "vitest";
import { EMPTY_META, nextOccurrence, occurrencesBetween, parseNoteMeta, serializeNoteMeta } from "../src/lib/noteMeta";

const at = (y: number, m: number, d: number, h = 9, min = 0) => new Date(y, m, d, h, min).getTime();

describe("nextOccurrence", () => {
  test("daily, weekly and monthly move forward from the reminder time", () => {
    const start = at(2026, 9, 2);
    expect(nextOccurrence(start, "daily", start)).toBe(at(2026, 9, 3));
    expect(nextOccurrence(start, "weekly", start)).toBe(at(2026, 9, 9));
    expect(nextOccurrence(start, "monthly", start)).toBe(at(2026, 10, 2));
  });

  test("skips occurrences missed while the app was closed", () => {
    const start = at(2026, 9, 2);
    expect(nextOccurrence(start, "daily", at(2026, 9, 5, 12))).toBe(at(2026, 9, 6));
  });

  test("monthly on the 31st clamps to shorter months and keeps the original day after", () => {
    const start = at(2026, 0, 31);
    expect(nextOccurrence(start, "monthly", start)).toBe(at(2026, 1, 28));
    expect(nextOccurrence(start, "monthly", at(2026, 1, 28, 10))).toBe(at(2026, 2, 31));
  });
});

describe("occurrencesBetween", () => {
  test("one-off reminders appear only inside the range", () => {
    expect(occurrencesBetween(at(2026, 9, 2), null, at(2026, 9, 1), at(2026, 10, 1))).toHaveLength(1);
    expect(occurrencesBetween(at(2026, 8, 2), null, at(2026, 9, 1), at(2026, 10, 1))).toHaveLength(0);
  });

  test("weekly reminders repeat through the month", () => {
    const times = occurrencesBetween(at(2026, 8, 25), "weekly", at(2026, 9, 1), at(2026, 10, 1));
    expect(times.map((time) => new Date(time).getDate())).toEqual([2, 9, 16, 23, 30]);
  });
});

describe("meta serialisation", () => {
  test("repeat is dropped without a reminder and omitted from Firestore when unset", () => {
    expect(parseNoteMeta({ tags: [], archived: false, reminderAt: null, repeat: "daily" }).repeat).toBeNull();
    expect(serializeNoteMeta({ ...EMPTY_META, reminderAt: 5 }, 1)).not.toHaveProperty("repeat");
    expect(serializeNoteMeta({ ...EMPTY_META, reminderAt: 5, repeat: "weekly" }, 1)).toMatchObject({ repeat: "weekly" });
  });
});
