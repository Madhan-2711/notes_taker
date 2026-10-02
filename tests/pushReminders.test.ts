import { describe, expect, test } from "vitest";
import { nextOccurrence, planReminder, reminderMessage } from "../functions/reminders.js";

const day = 24 * 60 * 60 * 1000;
const at = Date.UTC(2026, 9, 2, 9);

describe("server reminder planning", () => {
  test("only due reminders are planned; one-off ones are cleared", () => {
    expect(planReminder({ reminderAt: at + 1000 }, at)).toBeNull();
    expect(planReminder({ reminderAt: null }, at)).toBeNull();
    expect(planReminder({ reminderAt: at }, at)).toEqual({ notify: true, nextReminderAt: null });
  });

  test("repeating reminders move to the next time after now, skipping missed ones", () => {
    expect(planReminder({ reminderAt: at, repeat: "daily" }, at + 3 * day + 5)).toEqual({ notify: true, nextReminderAt: at + 4 * day });
    expect(nextOccurrence(at, "weekly", at)).toBe(at + 7 * day);
    expect(nextOccurrence(Date.UTC(2026, 0, 31, 9), "monthly", Date.UTC(2026, 0, 31, 9))).toBe(Date.UTC(2026, 1, 28, 9));
  });

  test("messages never reveal encrypted titles", () => {
    expect(reminderMessage({ mode: "normal", title: "Call the bank" }, "n1")).toMatchObject({ body: "Call the bank", url: "/notes?open=n1", tag: "reminder-n1" });
    expect(reminderMessage({ mode: "secure", title: "" }, "n2").body).toBe("A private note");
    expect(reminderMessage({ mode: "collab" }, "n3")).toMatchObject({ body: "A shared note", url: "/collab/n3" });
  });
});
