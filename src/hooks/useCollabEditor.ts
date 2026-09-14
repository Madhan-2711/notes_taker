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
  serverTimestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "../lib/firebaseConfig";
import { loadCollabNote } from "../lib/services/notes/collaborativeNotesService";
import { encryptData } from "../lib/services/crypto/encrypt";
import { decryptData } from "../lib/services/crypto/decrypt";
import { arrayBufferToBase64, base64ToArrayBuffer } from "../lib/services/crypto/serialization";
import type { Stroke } from "../lib/drawing";

interface UseCollabEditorReturn {
  text: Y.Text | null;
  /**
   * Shared drawing layer. Lives in the same Y.Doc as `text`, so every stroke
   * change flows through the same encrypted note_updates pipeline as the text.
   */
  strokes: Y.Map<Stroke> | null;
  title: string;
  isLoading: boolean;
  isSynced: boolean;
  error: string | null;
  canEdit: boolean;
  canCompact: boolean;
  /** Manually save the current state as an encrypted snapshot. */
  saveSnapshot: () => Promise<void>;
}

const COMPACTION_THRESHOLD = 50;
const DEBOUNCE_MS = 150;

export function useCollabEditor(
  noteId: string,
  userId: string,
  privateKey: CryptoKey | null
): UseCollabEditorReturn {
  const [text, setText] = useState<Y.Text | null>(null);
  const [strokes, setStrokes] = useState<Y.Map<Stroke> | null>(null);
  const [title, setTitle] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSynced, setIsSynced] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [canCompact, setCanCompact] = useState(false);
  const [clientId] = useState(() => crypto.randomUUID());

  const ydocRef = useRef<Y.Doc | null>(null);
  const noteKeyRef = useRef<CryptoKey | null>(null);
  const updateCountRef = useRef(0);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isApplyingRemoteRef = useRef(false);
  const processedUpdateIdsRef = useRef(new Set<string>());
  const pendingUpdatesRef = useRef<Uint8Array[]>([]);
  const publishingRef = useRef(false);

  // Initialize: load the note and set up Yjs
  useEffect(() => {
    if (!noteId || !userId || !privateKey) return;

    let cancelled = false;
    let unsubUpdates: Unsubscribe | null = null;
    const processedUpdateIds = processedUpdateIdsRef.current;

    async function init() {
      try {
        setIsLoading(true);
        setError(null);

        const { ydoc, noteKey, title: noteTitle, role } = await loadCollabNote(
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
        setCanEdit(role === "owner" || role === "editor");
        setCanCompact(role === "owner");

        const ytext = ydoc.getText("content");
        setText(ytext);

        // Drawing layer shares the same Y.Doc. Because the "update" listener
        // below fires for any doc change, stroke edits publish and sync through
        // the exact same encrypted pipeline as text — no extra wiring needed.
        const ystrokes = ydoc.getMap<Stroke>("strokes");
        setStrokes(ystrokes);

        const scheduleFlush = (delay = DEBOUNCE_MS) => {
          if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = setTimeout(flushPendingUpdates, delay);
        };

        const flushPendingUpdates = async () => {
          if (publishingRef.current) {
            scheduleFlush(50);
            return;
          }

          const pending = pendingUpdatesRef.current.splice(0);
          if (pending.length === 0) return;
          publishingRef.current = true;

          try {
            const mergedUpdate = Y.mergeUpdates(pending);
            const base64 = arrayBufferToBase64(mergedUpdate.buffer);
            const encrypted = await encryptData(base64, noteKey);

            const updateRef = await addDoc(collection(db, "note_updates"), {
              noteId,
              senderId: userId,
              clientId,
              encryptedUpdate: encrypted.ciphertext,
              iv: encrypted.iv,
              createdAt: serverTimestamp(),
            });

            processedUpdateIdsRef.current.add(updateRef.id);
            updateCountRef.current++;

            if (role === "owner" && updateCountRef.current >= COMPACTION_THRESHOLD) {
              const includedIds = Array.from(processedUpdateIdsRef.current);
              try {
                await compactSnapshot(noteId, ydoc, noteKey, includedIds);
                includedIds.forEach((id) => processedUpdateIdsRef.current.delete(id));
                updateCountRef.current = 0;
              } catch (checkpointError) {
                // The update itself is already durable. Keep the threshold reached
                // so a later edit or manual checkpoint retries compaction.
                console.error("Snapshot checkpoint failed:", checkpointError);
              }
            }

            setIsSynced(pendingUpdatesRef.current.length === 0);
          } catch (err) {
            pendingUpdatesRef.current.unshift(...pending);
            console.error("Failed to publish update:", err);
            setIsSynced(false);
            scheduleFlush(1_000);
          } finally {
            publishingRef.current = false;
            if (pendingUpdatesRef.current.length > 0) scheduleFlush(0);
          }
        };

        // Listen for local changes and publish incremental Yjs updates.
        ydoc.on("update", (update: Uint8Array, origin: string) => {
          if (origin === "remote" || isApplyingRemoteRef.current) return;
          pendingUpdatesRef.current.push(new Uint8Array(update));
          setIsSynced(false);
          scheduleFlush();
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

              // Only skip this browser tab's own updates. Other tabs and devices
              // for the same Firebase user must still receive each other's work.
              if (updateData.clientId === clientId) continue;
              if (processedUpdateIdsRef.current.has(change.doc.id)) continue;

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
                processedUpdateIdsRef.current.add(change.doc.id);

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
      processedUpdateIds.clear();
      pendingUpdatesRef.current = [];
      publishingRef.current = false;
    };
  }, [noteId, userId, privateKey, clientId]);

  /** Manually save the current Yjs state as an encrypted snapshot to Firestore. */
  const saveSnapshot = useCallback(async () => {
    const ydoc = ydocRef.current;
    const noteKey = noteKeyRef.current;
    if (!ydoc || !noteKey || !canCompact) return;

    try {
      const includedIds = Array.from(processedUpdateIdsRef.current);
      await compactSnapshot(noteId, ydoc, noteKey, includedIds);
      includedIds.forEach((id) => processedUpdateIdsRef.current.delete(id));
      updateCountRef.current = 0;
      setIsSynced(true);
    } catch (err) {
      console.error("Manual snapshot save failed:", err);
    }
  }, [noteId, canCompact]);

  return { text, strokes, title, isLoading, isSynced, error, canEdit, canCompact, saveSnapshot };
}

/** Save a full encrypted snapshot and clean up processed updates. */
async function compactSnapshot(
  noteId: string,
  ydoc: Y.Doc,
  noteKey: CryptoKey,
  includedUpdateIds: string[]
): Promise<void> {
  const fullState = Y.encodeStateAsUpdate(ydoc);
  const base64 = arrayBufferToBase64(fullState.buffer);
  const encrypted = await encryptData(base64, noteKey);

    // Update the note's snapshot
  await updateDoc(doc(db, "notes", noteId), {
    latestSnapshot: encrypted.ciphertext,
    snapshotIv: encrypted.iv,
    updatedAt: Date.now(),
  });

  // Delete only update IDs known to be represented by this exact snapshot.
  // Concurrent updates that arrive after encoding are not in this list and survive.
  for (let offset = 0; offset < includedUpdateIds.length; offset += 400) {
    const batch = writeBatch(db);
    for (const updateId of includedUpdateIds.slice(offset, offset + 400)) {
      batch.delete(doc(db, "note_updates", updateId));
    }
    await batch.commit();
  }
}
