"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getNoteTitle, isCollabNote, isSecureNote, type Note } from "../lib/validations";
import { decryptNoteTitle } from "../lib/services/notes/noteTitles";
import { useAuth } from "./useAuth";
import { useUserKeysContext } from "../contexts/UserKeysContext";

/** Readable titles for a list of notes; encrypted titles are decrypted on this device when the vault is open. */
export function useNoteTitles(notes: Note[]): (note: Note) => string {
  const { user } = useAuth();
  const { privateKey } = useUserKeysContext();
  const [decrypted, setDecrypted] = useState<Map<string, string>>(new Map());
  // Keyed by note id and last update, so an edited title is decrypted again but a failure is not retried forever.
  const attempted = useRef(new Set<string>());

  useEffect(() => {
    if (!user || !privateKey) return;
    const pending = notes.filter((note) => {
      if (!isSecureNote(note) && !isCollabNote(note)) return false;
      const key = `${note.id}:${note.updatedAt}`;
      if (attempted.current.has(key)) return false;
      attempted.current.add(key);
      return true;
    });
    if (pending.length === 0) return;
    // Results are kept even if the list changes meanwhile; these notes are marked as attempted.
    void Promise.all(pending.map(async (note) => [note.id, await decryptNoteTitle(note, user.uid, privateKey)] as const)).then((pairs) => {
      setDecrypted((previous) => {
        const next = new Map(previous);
        pairs.forEach(([id, title]) => { if (title?.trim()) next.set(id, title); });
        return next;
      });
    });
  }, [notes, user, privateKey]);

  return useMemo(() => (note: Note) => decrypted.get(note.id) ?? getNoteTitle(note), [decrypted]);
}
