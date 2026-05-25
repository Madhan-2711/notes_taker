"use client";

/**
 * Hook that manages the Yjs lifecycle for a single collaborative note.
 *
 * - Loads initial snapshot from Firestore
 * - Subscribes to note_updates for real-time sync
 * - Publishes local changes as encrypted updates
 * - Performs periodic snapshot compaction
 */

import { useState, useEffect, useRef, useCallback } from "react";
import * as Y from "yjs";
import {
  collection,
  addDoc,
  updateDoc,
  doc,
  query,
  where,
  onSnapshot,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "../lib/firebaseConfig";
import { loadCollabNote } from "../lib/services/notes/collaborativeNotesService";
import { encryptData } from "../lib/services/crypto/encrypt";
import { decryptData } from "../lib/services/crypto/decrypt";
import { arrayBufferToBase64, base64ToArrayBuffer } from "../lib/services/crypto/serialization";

interface UseCollabEditorReturn {
  text: Y.Text | null;
  title: string;
  isLoading: boolean;
  isSynced: boolean;
  error: string | null;
  /** Manually save the current state as an encrypted snapshot. */
  saveSnapshot: () => Promise<void>;
}

const COMPACTION_THRESHOLD = 50;
const DEBOUNCE_MS = 300;

export function useCollabEditor(
  noteId: string,
  userId: string,
  privateKey: CryptoKey | null
): UseCollabEditorReturn {
  const [text, setText] = useState<Y.Text | null>(null);
  const [title, setTitle] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSynced, setIsSynced] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ydocRef = useRef<Y.Doc | null>(null);
  const noteKeyRef = useRef<CryptoKey | null>(null);
  const updateCountRef = useRef(0);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isApplyingRemoteRef = useRef(false);
  const processedUpdateIdsRef = useRef(new Set<string>());

  // Initialize: load the note and set up Yjs
  useEffect(() => {
    if (!noteId || !userId || !privateKey) return;

    let cancelled = false;
    let unsubUpdates: Unsubscribe | null = null;

    async function init() {
      try {
        setIsLoading(true);
        setError(null);

        const { ydoc, noteKey, title: noteTitle } = await loadCollabNote(
          noteId,
          userId,
          privateKey!
        );

        if (cancelled) {
          ydoc.destroy();
          return;
        }

        ydocRef.current = ydoc;
        noteKeyRef.current = noteKey;
        setTitle(noteTitle);

        const ytext = ydoc.getText("content");
        setText(ytext);

        // Listen for local changes and publish them
        ydoc.on("update", (update: Uint8Array, origin: string) => {
          if (origin === "remote" || isApplyingRemoteRef.current) return;

          // Debounce: batch local changes before encrypting & publishing
          if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
          }

          debounceTimerRef.current = setTimeout(async () => {
            try {
              const fullUpdate = Y.encodeStateAsUpdate(ydoc);
              const base64 = arrayBufferToBase64(fullUpdate.buffer);
              const encrypted = await encryptData(base64, noteKey);

              await addDoc(collection(db, "note_updates"), {
                noteId,
                senderId: userId,
                encryptedUpdate: encrypted.ciphertext,
                iv: encrypted.iv,
                createdAt: Date.now(),
              });

              updateCountRef.current++;

              // Compaction: save full snapshot every N updates
              if (updateCountRef.current >= COMPACTION_THRESHOLD) {
                await compactSnapshot(noteId, ydoc, noteKey);
                updateCountRef.current = 0;
              }

              setIsSynced(true);
            } catch (err) {
              console.error("Failed to publish update:", err);
              setIsSynced(false);
            }
          }, DEBOUNCE_MS);
        });

        // Subscribe to remote updates.
        // NOTE: No orderBy — Yjs CRDT handles out-of-order updates natively,
        // and using orderBy would require a Firestore composite index.
        const updatesQuery = query(
          collection(db, "note_updates"),
          where("noteId", "==", noteId)
        );

        unsubUpdates = onSnapshot(
          updatesQuery,
          async (snap) => {
            for (const change of snap.docChanges()) {
              if (change.type !== "added") continue;

              const updateData = change.doc.data();

              // Skip own updates and already-processed updates
              if (updateData.senderId === userId) continue;
              if (processedUpdateIdsRef.current.has(change.doc.id)) continue;

              processedUpdateIdsRef.current.add(change.doc.id);

              try {
                const decryptedBase64 = await decryptData(
                  updateData.encryptedUpdate,
                  updateData.iv,
                  noteKey
                );
                const updateBytes = new Uint8Array(base64ToArrayBuffer(decryptedBase64));

                isApplyingRemoteRef.current = true;
                Y.applyUpdate(ydoc, updateBytes, "remote");
                isApplyingRemoteRef.current = false;

                setIsSynced(true);
              } catch (err) {
                console.error("Failed to apply remote update:", err);
                isApplyingRemoteRef.current = false;
              }
            }
          },
          (err) => {
            console.error("note_updates subscription error:", err);
            setError("Real-time sync failed. Check console for details.");
            setIsSynced(false);
          }
        );

        setIsLoading(false);
        setIsSynced(true);
      } catch (err) {
        if (!cancelled) {
          console.error("Collab editor init error:", err);
          setError(err instanceof Error ? err.message : "Failed to load collaborative note");
          setIsLoading(false);
        }
      }
    }

    init();

    return () => {
      cancelled = true;
      if (unsubUpdates) unsubUpdates();
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (ydocRef.current) ydocRef.current.destroy();
      ydocRef.current = null;
      noteKeyRef.current = null;
      processedUpdateIdsRef.current.clear();
    };
  }, [noteId, userId, privateKey]);

  /** Manually save the current Yjs state as an encrypted snapshot to Firestore. */
  const saveSnapshot = useCallback(async () => {
    const ydoc = ydocRef.current;
    const noteKey = noteKeyRef.current;
    if (!ydoc || !noteKey) return;

    try {
      await compactSnapshot(noteId, ydoc, noteKey);
      updateCountRef.current = 0;
      setIsSynced(true);
    } catch (err) {
      console.error("Manual snapshot save failed:", err);
    }
  }, [noteId]);

  return { text, title, isLoading, isSynced, error, saveSnapshot };
}

/** Save a full encrypted snapshot and clean up processed updates. */
async function compactSnapshot(
  noteId: string,
  ydoc: Y.Doc,
  noteKey: CryptoKey
): Promise<void> {
  try {
    const fullState = Y.encodeStateAsUpdate(ydoc);
    const base64 = arrayBufferToBase64(fullState.buffer);
    const encrypted = await encryptData(base64, noteKey);

    // Update the note's snapshot
    await updateDoc(doc(db, "notes", noteId), {
      latestSnapshot: encrypted.ciphertext,
      snapshotIv: encrypted.iv,
      updatedAt: Date.now(),
    });

    // Delete processed note_updates (keep last few for late-joining clients)
    const updatesQuery = query(
      collection(db, "note_updates"),
      where("noteId", "==", noteId)
    );
    const { getDocs } = await import("firebase/firestore");
    const snap = await getDocs(updatesQuery);

    if (snap.docs.length > 5) {
      const toDelete = snap.docs.slice(0, snap.docs.length - 5);
      const batch = writeBatch(db);
      toDelete.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  } catch (err) {
    console.error("Snapshot compaction failed:", err);
  }
}
