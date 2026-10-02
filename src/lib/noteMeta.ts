/**
 * Personal organisation for a note: tags, archive state and a reminder.
 * Stored per user at users/{uid}/noteMeta/{noteId}, so collaborators each keep
 * their own and nothing is written to the shared note.
 */
export type ReminderRepeat = "daily" | "weekly" | "monthly";

export interface NoteMeta {
  tags: string[];
  archived: boolean;
  reminderAt: number | null;
  /** Only meaningful together with reminderAt. */
  repeat: ReminderRepeat | null;
}

export const MAX_TAGS = 10;
export const MAX_TAG_LENGTH = 30;
export const EMPTY_META: NoteMeta = { tags: [], archived: false, reminderAt: null, repeat: null };

export const REPEAT_OPTIONS: { value: ReminderRepeat | ""; label: string }[] = [
  { value: "", label: "Doesn't repeat" },
  { value: "daily", label: "Every day" },
  { value: "weekly", label: "Every week" },
  { value: "monthly", label: "Every month" },
];

export function repeatLabel(repeat: ReminderRepeat | null): string {
  return repeat === "daily" ? "Daily" : repeat === "weekly" ? "Weekly" : repeat === "monthly" ? "Monthly" : "";
}

export function normalizeTag(raw: string): string {
  return raw.replace(/^#+/, "").replace(/\s+/g, " ").trim().slice(0, MAX_TAG_LENGTH).toLocaleLowerCase();
}

export function addTag(tags: string[], raw: string): string[] {
  const tag = normalizeTag(raw);
  if (!tag || tags.includes(tag) || tags.length >= MAX_TAGS) return tags;
  return [...tags, tag];
}

function isRepeat(value: unknown): value is ReminderRepeat {
  return value === "daily" || value === "weekly" || value === "monthly";
}

export function parseNoteMeta(value: unknown): NoteMeta {
  if (!value || typeof value !== "object") return EMPTY_META;
  const raw = value as Record<string, unknown>;
  const tags = Array.isArray(raw.tags)
    ? raw.tags.filter((tag): tag is string => typeof tag === "string").map(normalizeTag).filter(Boolean).slice(0, MAX_TAGS)
    : [];
  const reminderAt = typeof raw.reminderAt === "number" && Number.isFinite(raw.reminderAt) ? raw.reminderAt : null;
  return {
    tags: [...new Set(tags)],
    archived: raw.archived === true,
    reminderAt,
    repeat: reminderAt !== null && isRepeat(raw.repeat) ? raw.repeat : null,
  };
}

export function isEmptyMeta(meta: NoteMeta): boolean {
  return meta.tags.length === 0 && !meta.archived && meta.reminderAt === null;
}

/**
 * The Firestore document for a note's meta. "repeat" is only written when set, so
 * one-off reminders keep working with security rules that predate repeating ones.
 */
export function serializeNoteMeta(meta: NoteMeta, updatedAt: number): Record<string, unknown> {
  const data: Record<string, unknown> = { tags: meta.tags, archived: meta.archived, reminderAt: meta.reminderAt, updatedAt };
  if (meta.reminderAt !== null && meta.repeat) data.repeat = meta.repeat;
  return data;
}

/** Same wall-clock time `count` steps later, in the viewer's time zone. Months clamp to their last day. */
function step(from: Date, repeat: ReminderRepeat, count: number): Date {
  const next = new Date(from);
  if (repeat === "daily") next.setDate(from.getDate() + count);
  else if (repeat === "weekly") next.setDate(from.getDate() + 7 * count);
  else {
    const day = from.getDate();
    next.setDate(1);
    next.setMonth(from.getMonth() + count);
    const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
    next.setDate(Math.min(day, lastDay));
  }
  return next;
}

/** The first occurrence strictly after `now`, skipping any that were missed while the app was closed. */
export function nextOccurrence(at: number, repeat: ReminderRepeat, now: number): number {
  const start = new Date(at);
  let count = 1;
  let next = step(start, repeat, count);
  while (next.getTime() <= now) {
    count += 1;
    next = step(start, repeat, count);
  }
  return next.getTime();
}

/** Occurrences of a reminder between two times, for the calendar (capped to keep months cheap). */
export function occurrencesBetween(at: number, repeat: ReminderRepeat | null, from: number, to: number, limit = 62): number[] {
  if (!repeat) return at >= from && at < to ? [at] : [];
  const result: number[] = [];
  const start = new Date(at);
  for (let count = 0; result.length < limit; count += 1) {
    const time = count === 0 ? at : step(start, repeat, count).getTime();
    if (time >= to) break;
    if (time >= from) result.push(time);
  }
  return result;
}

/** Value for a datetime-local input in the viewer's time zone. */
export function toLocalInputValue(timestamp: number): string {
  const date = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
