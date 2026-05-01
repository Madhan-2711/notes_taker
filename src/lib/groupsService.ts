import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  writeBatch,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import { db } from "./firebaseConfig";
import { type Group } from "./validations";

// ── Create ────────────────────────────────────────────────────────────────────

/**
 * Creates a new group document and adds it to each selected note's groupIds.
 * Returns the new group's Firestore ID.
 */
export async function createGroup(
  userId: string,
  title: string,
  color: string,
  noteIds: string[] = []
): Promise<string> {
  const groupRef = await addDoc(collection(db, "groups"), {
    title,
    color,
    authorId: userId,
    createdAt: Date.now(),
  });

  if (noteIds.length > 0) {
    const batch = writeBatch(db);
    noteIds.forEach((noteId) => {
      batch.update(doc(db, "notes", noteId), {
        groupIds: arrayUnion(groupRef.id),
      });
    });
    await batch.commit();
  }

  return groupRef.id;
}

// ── Update ────────────────────────────────────────────────────────────────────

/** Updates a group's title and/or color. */
export async function updateGroup(
  groupId: string,
  data: Partial<Pick<Group, "title" | "color">>
): Promise<void> {
  await updateDoc(doc(db, "groups", groupId), data);
}

// ── Delete ────────────────────────────────────────────────────────────────────

/**
 * Deletes a group and removes its ID from all of the user's notes.
 * Notes themselves are NOT deleted.
 */
export async function deleteGroup(
  groupId: string,
  userId: string
): Promise<void> {
  const notesQuery = query(
    collection(db, "notes"),
    where("authorId", "==", userId),
    where("groupIds", "array-contains", groupId)
  );
  const snapshot = await getDocs(notesQuery);

  const batch = writeBatch(db);
  snapshot.docs.forEach((noteDoc) => {
    batch.update(noteDoc.ref, { groupIds: arrayRemove(groupId) });
  });
  batch.delete(doc(db, "groups", groupId));
  await batch.commit();
}

// ── Note membership ───────────────────────────────────────────────────────────

/** Adds a group ID to several notes (arrayUnion, idempotent). */
export async function addNotesToGroup(
  groupId: string,
  noteIds: string[]
): Promise<void> {
  if (noteIds.length === 0) return;
  const batch = writeBatch(db);
  noteIds.forEach((noteId) => {
    batch.update(doc(db, "notes", noteId), {
      groupIds: arrayUnion(groupId),
    });
  });
  await batch.commit();
}

/** Removes a group ID from a single note (arrayRemove, idempotent). */
export async function removeNoteFromGroup(
  groupId: string,
  noteId: string
): Promise<void> {
  await updateDoc(doc(db, "notes", noteId), {
    groupIds: arrayRemove(groupId),
  });
}

/**
 * Fully replaces a note's groupIds array.
 * Used by EditNoteModal to set exactly which groups the note belongs to.
 */
export async function setNoteGroupIds(
  noteId: string,
  groupIds: string[]
): Promise<void> {
  await updateDoc(doc(db, "notes", noteId), { groupIds });
}

/**
 * Syncs a group's note membership:
 * - Adds groupId to notes in `addIds`
 * - Removes groupId from notes in `removeIds`
 */
export async function syncGroupNotes(
  groupId: string,
  addIds: string[],
  removeIds: string[]
): Promise<void> {
  if (addIds.length === 0 && removeIds.length === 0) return;
  const batch = writeBatch(db);
  addIds.forEach((id) =>
    batch.update(doc(db, "notes", id), { groupIds: arrayUnion(groupId) })
  );
  removeIds.forEach((id) =>
    batch.update(doc(db, "notes", id), { groupIds: arrayRemove(groupId) })
  );
  await batch.commit();
}
