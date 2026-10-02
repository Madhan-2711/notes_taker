"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "./useAuth";
import { useUserKeys } from "./useUserKeys";
import { useNoteMeta } from "../contexts/NoteMetaContext";
import { useToast } from "../contexts/ToastContext";
import { NOTE_TEMPLATES } from "../lib/noteTemplates";
import { plainFromDelta, serializeDelta } from "../lib/richText";
import { createNormalNote } from "../lib/services/notes/normalNotesService";
import { createSecureNote } from "../lib/services/notes/secureNotesService";
import { recentNoteHref } from "../lib/noteNavigation";
import { dayKey } from "../lib/calendar";
import type { Note } from "../lib/validations";

/** Private tag that marks journal notes created by "Today's note". */
export const JOURNAL_TAG = "journal";

export function todaysJournal(notes: Note[], hasJournalTag: (noteId: string) => boolean, now = Date.now()): Note | undefined {
  const today = dayKey(now);
  return notes.find((note) => !note.deletedAt && dayKey(note.createdAt) === today && hasJournalTag(note.id));
}

/**
 * Opens today's journal note, creating it from the Diary template the first time each day.
 * Journals are private when the vault is ready, so they're end-to-end encrypted by default.
 */
export function useTodaysNote(notes: Note[]) {
  const router = useRouter();
  const { user } = useAuth();
  const { publicKey, hasKeys, isReady } = useUserKeys();
  const { metaByNote, updateMeta } = useNoteMeta();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const openTodaysNote = useCallback(async () => {
    if (!user || busy) return;
    const existing = todaysJournal(notes, (id) => Boolean(metaByNote.get(id)?.tags.includes(JOURNAL_TAG)));
    if (existing) {
      router.push(recentNoteHref(existing));
      return;
    }
    setBusy(true);
    try {
      const template = NOTE_TEMPLATES.find((item) => item.id === "diary") ?? NOTE_TEMPLATES[0];
      const title = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
      const content = plainFromDelta(template.delta);
      const rich = serializeDelta(template.delta);
      const encrypted = isReady && hasKeys && Boolean(publicKey);
      const id = encrypted && publicKey
        ? await createSecureNote(user.uid, title, content, [], publicKey, rich)
        : await createNormalNote(user.uid, title, content, [], rich);
      await updateMeta(id, { tags: [JOURNAL_TAG] });
      toast({ message: encrypted ? "Started today's private journal" : "Started today's journal" });
      router.push(`/notes?open=${encodeURIComponent(id)}&edit=1`);
    } catch (caught) {
      toast({ message: caught instanceof Error ? caught.message : "Couldn't create today's note.", tone: "error" });
    } finally {
      setBusy(false);
    }
  }, [user, busy, notes, metaByNote, router, isReady, hasKeys, publicKey, updateMeta, toast]);

  return { openTodaysNote, busy };
}
