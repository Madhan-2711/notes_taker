"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db, hasValidConfig } from "../lib/firebaseConfig";

/** The signed-in user's username: undefined while loading, null when none is set. */
export function useMyUsername(userId: string | undefined): string | null | undefined {
  const [state, setState] = useState<{ userId: string; username: string | null } | null>(null);

  useEffect(() => {
    if (!userId || !hasValidConfig) return;
    return onSnapshot(doc(db, "public_profiles", userId), (snapshot) => {
      if (!snapshot.exists()) return;
      const value = snapshot.data().username;
      setState({ userId, username: typeof value === "string" && value ? value : null });
    }, (error) => console.error("Profile subscription error:", error));
  }, [userId]);

  return state && state.userId === userId ? state.username : undefined;
}
