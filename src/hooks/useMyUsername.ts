"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db, hasValidConfig } from "../lib/firebaseConfig";

/** The signed-in user's username: undefined while loading, null when none is set. */
export function useMyUsername(userId: string | undefined): string | null | undefined {
  const [state, setState] = useState<{ userId: string; username: string | null } | null>(null);

  useEffect(() => {
    if (!userId || !hasValidConfig) return;
    return onSnapshot(doc(db, "public_profiles", userId), { includeMetadataChanges: true }, (snapshot) => {
      if (!snapshot.exists()) return;
      const value = snapshot.data().username;
      const username = typeof value === "string" && value ? value : null;
      // An offline-cache copy may predate the username; only trust "none" once the server confirms it.
      if (username === null && snapshot.metadata.fromCache) return;
      setState({ userId, username });
    }, (error) => console.error("Profile subscription error:", error));
  }, [userId]);

  return state && state.userId === userId ? state.username : undefined;
}
