"use client";

import { useEffect, useState } from "react";
import { arrayRemove, arrayUnion, doc, onSnapshot, setDoc } from "firebase/firestore";
import { db, hasValidConfig } from "../lib/firebaseConfig";

export function useNotePins(userId: string | undefined) {
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!userId || !hasValidConfig) return;
    return onSnapshot(doc(db, "users", userId, "preferences", "notes"), (snapshot) => {
      const ids = snapshot.data()?.pinnedIds;
      setPinnedIds(new Set(Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : []));
    });
  }, [userId]);

  async function toggle(noteId: string) {
    if (!userId) return;
    await setDoc(doc(db, "users", userId, "preferences", "notes"), {
      pinnedIds: pinnedIds.has(noteId) ? arrayRemove(noteId) : arrayUnion(noteId),
    }, { merge: true });
  }
  return { pinnedIds, toggle };
}
