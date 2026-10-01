/**
 * Personal organisation for a note: tags, archive state and a reminder.
 * Stored per user at users/{uid}/noteMeta/{noteId}, so collaborators each keep
 * their own and nothing is written to the shared note.
 */
export interface NoteMeta {
  tags: string[];
  archived: boolean;
  reminderAt: number | null;
}

export const MAX_TAGS = 10;
export const MAX_TAG_LENGTH = 30;
export const EMPTY_META: NoteMeta = { tags: [], archived: false, reminderAt: null };

export function normalizeTag(raw: string): string {
  return raw.replace(/^#+/, "").replace(/\s+/g, " ").trim().slice(0, MAX_TAG_LENGTH).toLocaleLowerCase();
}

export function addTag(tags: string[], raw: string): string[] {
  const tag = normalizeTag(raw);
  if (!tag || tags.includes(tag) || tags.length >= MAX_TAGS) return tags;
  return [...tags, tag];
}

export function parseNoteMeta(value: unknown): NoteMeta {
  if (!value || typeof value !== "object") return EMPTY_META;
  const raw = value as Record<string, unknown>;
  const tags = Array.isArray(raw.tags)
    ? raw.tags.filter((tag): tag is string => typeof tag === "string").map(normalizeTag).filter(Boolean).slice(0, MAX_TAGS)
    : [];
  return {
    tags: [...new Set(tags)],
    archived: raw.archived === true,
    reminderAt: typeof raw.reminderAt === "number" && Number.isFinite(raw.reminderAt) ? raw.reminderAt : null,
  };
}

export function isEmptyMeta(meta: NoteMeta): boolean {
  return meta.tags.length === 0 && !meta.archived && meta.reminderAt === null;
}

/** Value for a datetime-local input in the viewer's time zone. */
export function toLocalInputValue(timestamp: number): string {
  const date = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
