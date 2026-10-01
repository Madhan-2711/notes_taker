/** Usernames are lowercase handles, unique across the app, used to find friends. */
export const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

export function normalizeUsername(raw: string): string {
  return raw.trim().replace(/^@+/, "").toLowerCase();
}

/** Returns a message describing what is wrong, or null when the username is valid. */
export function usernameProblem(raw: string): string | null {
  const name = normalizeUsername(raw);
  if (name.length < 3) return "Use at least 3 characters.";
  if (name.length > 20) return "Use at most 20 characters.";
  if (!USERNAME_PATTERN.test(name)) return "Use only letters, numbers and underscores.";
  return null;
}

/** A starting suggestion built from the person's name or email. */
export function suggestUsername(displayName: string | null | undefined, email: string | null | undefined): string {
  const base = (displayName || email?.split("@")[0] || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 20);
  return base.length >= 3 ? base : "";
}

/** Friend search accepts an email address or a username (with or without @). */
export function isEmailLike(value: string): boolean {
  const trimmed = value.trim();
  return !trimmed.startsWith("@") && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}
