import {
  collection,
  addDoc,
  deleteDoc,
  updateDoc,
  deleteField,
  getDoc,
  writeBatch,
  doc,
  query,
  where,
  onSnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { type Note } from "../../validations";
import { addNotesToGroup } from "../../groupsService";
import { deleteAllAttachments } from "../attachments";
import { addRevisionToBatch, deleteAllRevisions } from "../noteRevisions";
import { auth } from "../../firebaseConfig";

// ── Create ────────────────────────────────────────────────────────────────────

/**
 * Creates a new normal (unencrypted) note.
 * Returns the new Firestore document ID.
 */
export async function createNormalNote(
  userId: string,
  title: string,
  content: string,
  groupIds: string[] = [],
  richContent?: string
): Promise<string> {
  const newNote = {
    mode: "normal" as const,
    title,
    content,
    ...(richContent ? { richContent } : {}),
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

/** Updates a normal note's title and content. `richContent: null` drops formatting. */
export async function updateNormalNote(
  noteId: string,
  title: string,
  content: string,
  richContent: string | null = null
): Promise<void> {
  const ref = doc(db, "notes", noteId);
  const current = await getDoc(ref);
  if (!current.exists()) throw new Error("Note not found.");
  const uid = auth.currentUser?.uid;
  if (!uid || current.data().authorId !== uid) throw new Error("Only the owner can edit this note.");
  const data = current.data();
  if (data.title === title && data.content === content && (data.richContent ?? null) === richContent) return;
  const batch = writeBatch(db);
  addRevisionToBatch(batch, noteId, data, uid);
  batch.update(ref, { title, content, richContent: richContent ?? deleteField(), updatedAt: Date.now() });
  await batch.commit();
}

// ── Delete ────────────────────────────────────────────────────────────────────

/** Deletes a note by ID (works for any mode). */
export async function deleteNote(noteId: string): Promise<void> {
  await deleteAllAttachments(noteId);
  await deleteAllRevisions(noteId);
  await deleteDoc(doc(db, "notes", noteId));
}

/** Move a note out of active views without deleting its attachments or history. */
export async function moveNoteToTrash(noteId: string): Promise<void> {
  await updateDoc(doc(db, "notes", noteId), { deletedAt: Date.now(), updatedAt: Date.now() });
}

export async function restoreNote(noteId: string): Promise<void> {
  await updateDoc(doc(db, "notes", noteId), { deletedAt: deleteField(), updatedAt: Date.now() });
}

// ── Subscribe ─────────────────────────────────────────────────────────────────

/**
 * Real-time subscription to all notes authored by a user
 * AND all notes where the user is a collaborator.
 * Returns an unsubscribe function.
 */
export function subscribeToNotes(
  userId: string,
  callback: (notes: Note[]) => void,
  includeTrashed = false
): Unsubscribe {
  // Query 1: Notes authored by the user
  const authorQuery = query(
    collection(db, "notes"),
    where("authorId", "==", userId)
  );

  // Query 2: Notes where the user is a collaborator
  const collabQuery = query(
    collection(db, "notes"),
    where("collaboratorIds", "array-contains", userId)
  );

  let authorNotes: Note[] = [];
  let collabNotes: Note[] = [];

  const merge = () => {
    // Merge and deduplicate by id
    const map = new Map<string, Note>();
    for (const n of authorNotes) map.set(n.id, n);
    for (const n of collabNotes) map.set(n.id, n);
    const merged = Array.from(map.values()).filter((note) => includeTrashed || !note.deletedAt);
    merged.sort((a, b) => b.createdAt - a.createdAt);
    callback(merged);
  };

  const parseSnap = (snap: import("firebase/firestore").QuerySnapshot): Note[] =>
    snap.docs.map((d) => {
      const raw = d.data();
      return {
        id: d.id,
        mode: raw.mode || "normal",
        ...raw,
      } as Note;
    });

  const unsub1 = onSnapshot(
    authorQuery,
    (snap) => { authorNotes = parseSnap(snap); merge(); },
    (err) => console.error("Firestore author notes subscription error:", err)
  );

  const unsub2 = onSnapshot(
    collabQuery,
    (snap) => { collabNotes = parseSnap(snap); merge(); },
    (err) => console.error("Firestore collab notes subscription error:", err)
  );

  return () => { unsub1(); unsub2(); };
}
