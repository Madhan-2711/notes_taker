"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { collection, deleteDoc, doc, onSnapshot, setDoc } from "firebase/firestore";
import { db, hasValidConfig } from "../lib/firebaseConfig";
import { useAuth } from "../hooks/useAuth";
import { EMPTY_META, isEmptyMeta, parseNoteMeta, type NoteMeta } from "../lib/noteMeta";

interface NoteMetaContextValue {
  metaByNote: Map<string, NoteMeta>;
  getMeta: (noteId: string) => NoteMeta;
  updateMeta: (noteId: string, changes: Partial<NoteMeta>) => Promise<void>;
}

const NoteMetaContext = createContext<NoteMetaContextValue | null>(null);

/** One live subscription to the signed-in user's tags, archive flags and reminders. */
export function NoteMetaProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.uid;
  const [state, setState] = useState<{ userId: string; meta: Map<string, NoteMeta> } | null>(null);
  const metaByNote = useMemo(() => (state && state.userId === userId ? state.meta : new Map<string, NoteMeta>()), [state, userId]);

  useEffect(() => {
    if (!userId || !hasValidConfig) return;
    return onSnapshot(collection(db, "users", userId, "noteMeta"), (snapshot) => {
      const next = new Map<string, NoteMeta>();
      snapshot.forEach((item) => next.set(item.id, parseNoteMeta(item.data())));
      setState({ userId, meta: next });
    }, (error) => console.error("Note settings subscription error:", error));
  }, [userId]);

  const getMeta = useCallback((noteId: string) => metaByNote.get(noteId) ?? EMPTY_META, [metaByNote]);

  const updateMeta = useCallback(async (noteId: string, changes: Partial<NoteMeta>) => {
    if (!userId) throw new Error("Sign in to organise notes.");
    const next = { ...(metaByNote.get(noteId) ?? EMPTY_META), ...changes };
    const ref = doc(db, "users", userId, "noteMeta", noteId);
    if (isEmptyMeta(next)) await deleteDoc(ref);
    else await setDoc(ref, { ...next, updatedAt: Date.now() });
  }, [userId, metaByNote]);

  const value = useMemo(() => ({ metaByNote, getMeta, updateMeta }), [metaByNote, getMeta, updateMeta]);
  return <NoteMetaContext.Provider value={value}>{children}</NoteMetaContext.Provider>;
}

export function useNoteMeta(): NoteMetaContextValue {
  const value = useContext(NoteMetaContext);
  if (!value) throw new Error("useNoteMeta must be used inside NoteMetaProvider");
  return value;
}
