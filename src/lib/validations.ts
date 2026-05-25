import { z } from "zod";

// ── Note Modes ────────────────────────────────────────────────────────────────

export type NoteMode = "normal" | "secure" | "collab";

// ── Zod Schemas ───────────────────────────────────────────────────────────────

/** Schema for normal note input (title + content). */
export const normalNoteSchema = z.object({
  title: z
    .string()
    .min(1, "Title is required")
    .max(100, "Title must be 100 characters or less")
    .trim(),
  content: z
    .string()
    .min(1, "Content is required")
    .max(5000, "Content is too long")
    .trim(),
});

/** Backward-compatible alias — existing code references `noteSchema`. */
export const noteSchema = normalNoteSchema;

export type NoteInput = z.infer<typeof normalNoteSchema>;

// ── Base Note ─────────────────────────────────────────────────────────────────

interface BaseNote {
  id: string;
  mode: NoteMode;
  authorId: string;
  groupIds?: string[];
  createdAt: number;
  updatedAt: number;
}

// ── Normal Note ───────────────────────────────────────────────────────────────

export interface NormalNote extends BaseNote {
  mode: "normal";
  title: string;
  content: string;
}

// ── Secure Note ───────────────────────────────────────────────────────────────

export interface SecureNote extends BaseNote {
  mode: "secure";
  encryptedTitle: string;
  encryptedContent: string;
  iv: string;
  /** Map of userId → RSA-wrapped AES key (base64) */
  encryptedKeys: Record<string, string>;
}

// ── Collaborative Note ────────────────────────────────────────────────────────

export interface CollabNote extends BaseNote {
  mode: "collab";
  title: string;
  collaboratorIds: string[];
  /** Map of userId → RSA-wrapped AES key (base64) */
  encryptedKeys: Record<string, string>;
  /** Encrypted Yjs state snapshot (base64) */
  latestSnapshot?: string;
  /** IV for the latest snapshot */
  snapshotIv?: string;
}

// ── Discriminated Union ───────────────────────────────────────────────────────

export type Note = NormalNote | SecureNote | CollabNote;

// ── Type Guards ───────────────────────────────────────────────────────────────

export function isNormalNote(note: Note): note is NormalNote {
  return !note.mode || note.mode === "normal";
}

export function isSecureNote(note: Note): note is SecureNote {
  return note.mode === "secure";
}

export function isCollabNote(note: Note): note is CollabNote {
  return note.mode === "collab";
}
// ── Display Helpers ───────────────────────────────────────────────────────────

/** Get a display-safe title for any note variant. */
export function getNoteTitle(note: Note): string {
  if (isSecureNote(note)) return "🔒 Encrypted Note";
  if (isCollabNote(note)) return note.title || "Collaborative Note";
  return note.title || "Untitled";
}

/** Get display-safe content for any note variant. */
export function getNoteContent(note: Note): string {
  if (isSecureNote(note)) return "This note is end-to-end encrypted.";
  if (isCollabNote(note)) return `Collaborative note with ${note.collaboratorIds?.length || 0} collaborator(s)`;
  return note.content || "";
}

// ── Legacy Note Type (backward compat for existing Firestore docs) ────────────
// Existing notes in Firestore don't have a `mode` field.
// `isNormalNote()` handles this by treating missing mode as "normal".

// ── Groups ────────────────────────────────────────────────────────────────────

export const groupSchema = z.object({
  title: z
    .string()
    .min(1, "Group name is required")
    .max(50, "Group name must be 50 characters or less")
    .trim(),
  color: z.string().default("#6366f1"),
});

export type GroupInput = z.infer<typeof groupSchema>;

export interface Group extends GroupInput {
  id: string;
  authorId: string;
  createdAt: number;
}

export const GROUP_COLORS = [
  { value: "#6366f1", label: "Indigo" },
  { value: "#10b981", label: "Emerald" },
  { value: "#f59e0b", label: "Amber" },
  { value: "#f43f5e", label: "Rose" },
  { value: "#0ea5e9", label: "Sky" },
  { value: "#a855f7", label: "Purple" },
] as const;

// ── Social Types ──────────────────────────────────────────────────────────────

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
  publicKey: string;
  wrappedPrivateKey?: string;
  createdAt: number;
}

export interface FriendRequest {
  id: string;
  senderId: string;
  senderEmail: string;
  senderName: string;
  senderPhoto: string | null;
  receiverId: string;
  receiverEmail: string;
  receiverName: string;
  receiverPhoto: string | null;
  status: "pending" | "accepted" | "rejected";
  createdAt: number;
}

export interface Friend {
  id: string;
  users: [string, string];
  createdAt: number;
}

export interface CollabInvite {
  id: string;
  noteId: string;
  senderId: string;
  senderName: string;
  senderEmail: string;
  receiverId: string;
  receiverName: string;
  /** RSA-encrypted AES note key for the recipient */
  encryptedNoteKey: string;
  permission: "viewer" | "editor";
  status: "pending" | "accepted" | "rejected";
  createdAt: number;
}

export interface NoteUpdate {
  id: string;
  noteId: string;
  senderId: string;
  encryptedUpdate: string;
  iv: string;
  createdAt: number;
}
