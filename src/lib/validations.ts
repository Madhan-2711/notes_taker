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
}
