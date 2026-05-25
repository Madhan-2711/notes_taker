"use client";

/**
 * Presence hook for collaborative editing.
 * Publishes and subscribes to user presence via Firestore subcollection
 * at /notes/{noteId}/presence/{uid} with a heartbeat-based expiry mechanism.
 */

import { useState, useEffect, useRef } from "react";
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../lib/firebaseConfig";

interface PresenceUser {
  uid: string;
  displayName: string;
  photoURL: string | null;
  lastSeen: number;
}

const PRESENCE_TTL = 30_000; // 30 seconds
const HEARTBEAT_INTERVAL = 15_000; // 15 seconds

export function usePresence(
  noteId: string,
  userId: string,
  displayName: string,
  photoURL: string | null
) {
  const [activeUsers, setActiveUsers] = useState<PresenceUser[]>([]);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!noteId || !userId) return;

    // Subcollection: /notes/{noteId}/presence/{uid}
    const presenceRef = doc(db, "notes", noteId, "presence", userId);
    const presenceCollectionRef = collection(db, "notes", noteId, "presence");

    // Publish presence
    const publishPresence = async () => {
      try {
        await setDoc(presenceRef, {
          uid: userId,
          displayName,
          photoURL,
          lastSeen: Date.now(),
        });
      } catch (err) {
        console.error("Presence publish failed:", err);
      }
    };

    // Initial publish
    publishPresence();

    // Heartbeat
    heartbeatRef.current = setInterval(publishPresence, HEARTBEAT_INTERVAL);

    // Subscribe to all presence docs in the subcollection
    const unsub = onSnapshot(presenceCollectionRef, (snap) => {
      const now = Date.now();
      const users: PresenceUser[] = [];

      snap.docs.forEach((d) => {
        const data = d.data() as PresenceUser;
        // Only include other users with recent heartbeats (not stale)
        if (data.uid !== userId && now - data.lastSeen < PRESENCE_TTL) {
          users.push({
            uid: data.uid,
            displayName: data.displayName,
            photoURL: data.photoURL,
            lastSeen: data.lastSeen,
          });
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
  }, [noteId, userId, displayName, photoURL]);

  return activeUsers;
}
