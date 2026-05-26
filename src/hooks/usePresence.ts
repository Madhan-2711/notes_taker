"use client";

/**
 * Presence hook for collaborative editing.
 * Publishes and subscribes to user presence via Firestore subcollection
 * at /notes/{noteId}/presence/{uid} with a heartbeat-based expiry mechanism.
 *
 * Includes cursor position for remote cursor rendering.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../lib/firebaseConfig";

// Assign consistent colors to remote users
const CURSOR_COLORS = [
  "#ef4444", // red
  "#3b82f6", // blue
  "#f59e0b", // amber
  "#8b5cf6", // purple
  "#06b6d4", // cyan
  "#ec4899", // pink
  "#14b8a6", // teal
];

export interface PresenceUser {
  uid: string;
  displayName: string;
  photoURL: string | null;
  lastSeen: number;
  cursorPosition: number | null;
  cursorColor: string;
}

const PRESENCE_TTL = 30_000; // 30 seconds
const HEARTBEAT_INTERVAL = 10_000; // 10 seconds

export function usePresence(
  noteId: string,
  userId: string,
  displayName: string,
  photoURL: string | null
) {
  const [activeUsers, setActiveUsers] = useState<PresenceUser[]>([]);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cursorRef = useRef<number | null>(null);

  // Publish presence with optional cursor position
  const publishPresence = useCallback(async () => {
    if (!noteId || !userId) return;
    const presenceRef = doc(db, "notes", noteId, "presence", userId);
    try {
      await setDoc(presenceRef, {
        uid: userId,
        displayName,
        photoURL,
        lastSeen: Date.now(),
        cursorPosition: cursorRef.current,
      });
    } catch (err) {
      console.error("Presence publish failed:", err);
    }
  }, [noteId, userId, displayName, photoURL]);

  // Update cursor position (called from editor on cursor change)
  const cursorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const updateCursor = useCallback((position: number) => {
    cursorRef.current = position;
    // Debounce cursor publish to avoid excessive Firestore writes
    if (cursorTimerRef.current) clearTimeout(cursorTimerRef.current);
    cursorTimerRef.current = setTimeout(() => {
      publishPresence();
    }, 500);
  }, [publishPresence]);

  useEffect(() => {
    if (!noteId || !userId) return;

    const presenceRef = doc(db, "notes", noteId, "presence", userId);
    const presenceCollectionRef = collection(db, "notes", noteId, "presence");

    // Initial publish
    publishPresence();

    // Heartbeat
    heartbeatRef.current = setInterval(publishPresence, HEARTBEAT_INTERVAL);

    // Subscribe to all presence docs in the subcollection
    const unsub = onSnapshot(presenceCollectionRef, (snap) => {
      const now = Date.now();
      const users: PresenceUser[] = [];
      let colorIndex = 0;

      snap.docs.forEach((d) => {
        const data = d.data();
        // Only include other users with recent heartbeats (not stale)
        if (data.uid !== userId && now - data.lastSeen < PRESENCE_TTL) {
          users.push({
            uid: data.uid,
            displayName: data.displayName || "Anonymous",
            photoURL: data.photoURL || null,
            lastSeen: data.lastSeen,
            cursorPosition: data.cursorPosition ?? null,
            cursorColor: CURSOR_COLORS[colorIndex % CURSOR_COLORS.length],
          });
          colorIndex++;
        }
      });

      setActiveUsers(users);
    });

    // Cleanup on unmount
    return () => {
      unsub();
      if (heartbeatRef.current) {
        clearInterval(heartbeatRef.current);
      }
      // Remove presence doc
      deleteDoc(presenceRef).catch(() => {});
    };
  }, [noteId, userId, displayName, photoURL, publishPresence]);

  return { activeUsers, updateCursor };
}
