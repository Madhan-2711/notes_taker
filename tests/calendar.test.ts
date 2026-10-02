import { describe, expect, test } from "vitest";
import { dayKey, monthGrid, weekdayLabels } from "../src/lib/calendar";

describe("monthGrid", () => {
  test("covers whole weeks and marks days outside the month", () => {
    // October 2026 starts on a Thursday and has 31 days.
    const sundayFirst = monthGrid(2026, 9, 0);
    expect(sundayFirst).toHaveLength(35);
    expect(sundayFirst[0].key).toBe("2026-09-27");
    expect(sundayFirst[4].key).toBe("2026-10-01");
    expect(sundayFirst.filter((day) => day.inMonth)).toHaveLength(31);

    const mondayFirst = monthGrid(2026, 9, 1);
    expect(mondayFirst[0].key).toBe("2026-09-28");
    expect(mondayFirst[3].key).toBe("2026-10-01");
  });

  test("uses six rows when the month needs them", () => {
    // August 2026 starts on a Saturday.
    expect(monthGrid(2026, 7, 0)).toHaveLength(42);
  });
});

describe("helpers", () => {
  test("dayKey uses local dates", () => {
    expect(dayKey(new Date(2026, 0, 5, 23, 30))).toBe("2026-01-05");
  });

  test("weekday labels follow the week start", () => {
    expect(weekdayLabels(1, "en-US")[0].long).toBe("Monday");
    expect(weekdayLabels(0, "en-US")[6].long).toBe("Saturday");
  });
});
