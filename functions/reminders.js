// Pure reminder logic used by the scheduled function (and unit-tested from tests/).
// Kept free of Firebase imports so it runs anywhere.

const DAY = 24 * 60 * 60 * 1000;

/**
 * Next occurrence strictly after `now`. The server doesn't know the user's time zone, so
 * daily and weekly steps are exact 24-hour multiples and monthly keeps the UTC day of the
 * month (clamped to short months). If the app is open it reschedules in local time instead.
 */
export function nextOccurrence(at, repeat, now) {
  if (repeat === "daily" || repeat === "weekly") {
    const step = repeat === "daily" ? DAY : 7 * DAY;
    const missed = Math.floor((now - at) / step) + 1;
    return at + Math.max(1, missed) * step;
  }
  const start = new Date(at);
  for (let count = 1; ; count += 1) {
    const next = new Date(start);
    next.setUTCDate(1);
    next.setUTCMonth(start.getUTCMonth() + count);
    const lastDay = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0)).getUTCDate();
    next.setUTCDate(Math.min(start.getUTCDate(), lastDay));
    if (next.getTime() > now) return next.getTime();
  }
}

/** What to do with a reminder that has come due: notify, then clear it or move it on. */
export function planReminder(meta, now) {
  if (typeof meta?.reminderAt !== "number" || meta.reminderAt > now) return null;
  const repeat = ["daily", "weekly", "monthly"].includes(meta.repeat) ? meta.repeat : null;
  return { notify: true, nextReminderAt: repeat ? nextOccurrence(meta.reminderAt, repeat, now) : null };
}

/**
 * Notification text. Private and shared notes are end-to-end encrypted, so the server
 * never sees their titles and says so instead.
 */
export function reminderMessage(note, noteId) {
  const mode = note?.mode || "normal";
  const body = mode === "normal" && typeof note.title === "string" && note.title.trim()
    ? note.title.trim().slice(0, 100)
    : mode === "collab" ? "A shared note" : "A private note";
  const url = mode === "collab" ? `/collab/${encodeURIComponent(noteId)}` : `/notes?open=${encodeURIComponent(noteId)}`;
  return { title: "Note reminder", body, url, tag: `reminder-${noteId}` };
}
