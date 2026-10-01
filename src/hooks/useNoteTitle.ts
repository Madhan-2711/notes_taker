"use client";

import { useEffect, useState } from "react";
import { getNoteTitle, isCollabNote, isSecureNote, type Note } from "../lib/validations";
import { decryptNoteTitle } from "../lib/services/notes/noteTitles";
import { useAuth } from "./useAuth";
import { useUserKeysContext } from "../contexts/UserKeysContext";

/** A note's readable title, decrypted on this device for private and shared notes when the vault is open. */
export function useNoteTitle(note: Note): string {
  const { user } = useAuth();
  const { privateKey } = useUserKeysContext();
  const [decrypted, setDecrypted] = useState<{ id: string; title: string } | null>(null);

  useEffect(() => {
    if (!user || !privateKey || (!isSecureNote(note) && !isCollabNote(note))) return;
    let cancelled = false;
    void decryptNoteTitle(note, user.uid, privateKey).then((title) => {
      if (!cancelled && title) setDecrypted({ id: note.id, title });
    });
    return () => { cancelled = true; };
  }, [note, user, privateKey]);

  return (decrypted?.id === note.id && decrypted.title.trim()) || getNoteTitle(note);
}
