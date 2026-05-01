import { z } from "zod";

export const noteSchema = z.object({
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

export type NoteInput = z.infer<typeof noteSchema>;

export interface Note extends NoteInput {
  id: string;
  authorId: string;
  createdAt: number;
  updatedAt: number;
  groupIds?: string[];
}

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
