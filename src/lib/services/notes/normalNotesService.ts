import {
  collection,
  addDoc,
  deleteDoc,
  updateDoc,
  doc,
  query,
  where,
  onSnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { type Note } from "../../validations";
import { addNotesToGroup } from "../../groupsService";

// ── Create ────────────────────────────────────────────────────────────────────

/**
 * Creates a new normal (unencrypted) note.
 * Returns the new Firestore document ID.
 */
export async function createNormalNote(
  userId: string,
  title: string,
  content: string,
  groupIds: string[] = []
): Promise<string> {
  const newNote = {
    mode: "normal" as const,
    title,
    content,
    groupIds,
    authorId: userId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const ref = await addDoc(collection(db, "notes"), newNote);

  // Link the note to each selected group
  if (groupIds.length > 0) {
    await Promise.all(groupIds.map((gid) => addNotesToGroup(gid, [ref.id])));
  }

  return ref.id;
}

// ── Update ────────────────────────────────────────────────────────────────────

/** Updates a normal note's title and content. */
export async function updateNormalNote(
  noteId: string,
  title: string,
  content: string
): Promise<void> {
  await updateDoc(doc(db, "notes", noteId), {
    title,
    content,
    updatedAt: Date.now(),
  });
}

// ── Delete ────────────────────────────────────────────────────────────────────

/** Deletes a note by ID (works for any mode). */
export async function deleteNote(noteId: string): Promise<void> {
  await deleteDoc(doc(db, "notes", noteId));
}

// ── Subscribe ─────────────────────────────────────────────────────────────────

/**
 * Real-time subscription to all notes authored by a user.
 * Returns an unsubscribe function.
 */
export function subscribeToNotes(
  userId: string,
  callback: (notes: Note[]) => void
): Unsubscribe {
  const q = query(
    collection(db, "notes"),
    where("authorId", "==", userId)
  );

  return onSnapshot(
    q,
    (snap) => {
      const data = snap.docs.map((d) => {
        const raw = d.data();
        return {
          id: d.id,
          // Treat missing mode as "normal" (backward compat for old docs)
          mode: raw.mode || "normal",
          ...raw,
        } as Note;
      });
      data.sort((a, b) => b.createdAt - a.createdAt);
      callback(data);
    },
    (err) => console.error("Firestore notes subscription error:", err)
  );
}
