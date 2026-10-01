"use client";

import { useCallback } from "react";
import { moveNoteToTrash, restoreNote } from "../lib/services/notes/normalNotesService";
import { useToast } from "../contexts/ToastContext";

/** Moves a note to trash straight away and offers Undo, instead of asking first. */
export function useTrashWithUndo() {
  const toast = useToast();
  return useCallback(async (noteId: string) => {
    try {
      await moveNoteToTrash(noteId);
      toast({ message: "Moved to trash", actionLabel: "Undo", onAction: () => restoreNote(noteId) });
    } catch (caught) {
      toast({ message: caught instanceof Error ? caught.message : "Could not move the note to trash.", tone: "error" });
    }
  }, [toast]);
}
