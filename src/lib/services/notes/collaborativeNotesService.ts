/**
 * Collaborative Notes Service
 *
 * Handles creation and loading of collaborative notes with Yjs CRDT integration.
 * Each collab note has an encrypted Yjs snapshot stored in Firestore.
 */

import {
  collection,
  addDoc,
  deleteDoc,
  getDoc,
  getDocs,
  doc,
  query,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { encryptData } from "../crypto/encrypt";
import { decryptData } from "../crypto/decrypt";
import { generateAESKey } from "../crypto/keys";
import { encryptKeyForUser, decryptKeyFromUser } from "../crypto/sharing";
import { addNotesToGroup } from "../../groupsService";
import { arrayBufferToBase64, base64ToArrayBuffer } from "../crypto/serialization";
import * as Y from "yjs";

/**
 * Creates a collaborative note.
 * - Initializes a Yjs document with the initial content
 * - Encrypts the snapshot with a new AES key
 * - Wraps the AES key with the author's public key
 */
export async function createCollabNote(
  userId: string,
  title: string,
  content: string,
  groupIds: string[],
  publicKey: CryptoKey
): Promise<string> {
  // Create Yjs doc with initial content
  const ydoc = new Y.Doc();
  const ytext = ydoc.getText("content");
  ytext.insert(0, content);

  // Encode the initial state
  const snapshot = Y.encodeStateAsUpdate(ydoc);
  const snapshotBase64 = arrayBufferToBase64(snapshot.buffer);

  // Generate AES key and encrypt the snapshot
  const noteKey = await generateAESKey();
  const encryptedSnapshot = await encryptData(snapshotBase64, noteKey);

  // Wrap the AES key with the author's public key
  const wrappedKey = await encryptKeyForUser(noteKey, publicKey);

  const newNote = {
    mode: "collab" as const,
    title,
    collaboratorIds: [] as string[],
    encryptedKeys: { [userId]: wrappedKey },
    latestSnapshot: encryptedSnapshot.ciphertext,
    snapshotIv: encryptedSnapshot.iv,
    groupIds,
    authorId: userId,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const ref = await addDoc(collection(db, "notes"), newNote);

  if (groupIds.length > 0) {
    await Promise.all(groupIds.map((gid) => addNotesToGroup(gid, [ref.id])));
  }

  ydoc.destroy();
  return ref.id;
}

/**
 * Loads a collaborative note, decrypting the snapshot.
 * Returns a Yjs Doc and the note's AES key for future updates.
 */
export async function loadCollabNote(
  noteId: string,
  userId: string,
  privateKey: CryptoKey
): Promise<{
  ydoc: Y.Doc;
  noteKey: CryptoKey;
  title: string;
}> {
  const ref = doc(db, "notes", noteId);
  const snap = await getDoc(ref);

  if (!snap.exists()) throw new Error("Note not found");

  const data = snap.data();
  const wrappedKey = data.encryptedKeys?.[userId];

  if (!wrappedKey) {
    throw new Error("You don't have access to this note's encryption key");
  }

  // Unwrap the AES key
  const noteKey = await decryptKeyFromUser(wrappedKey, privateKey);

  // Create Yjs doc
  const ydoc = new Y.Doc();

  // Decrypt and apply the snapshot if it exists
  if (data.latestSnapshot && data.snapshotIv) {
    const decryptedBase64 = await decryptData(
      data.latestSnapshot,
      data.snapshotIv,
      noteKey
    );
    const snapshotBytes = new Uint8Array(base64ToArrayBuffer(decryptedBase64));
    Y.applyUpdate(ydoc, snapshotBytes);
  }

  return {
    ydoc,
    noteKey,
    title: data.title || "Untitled",
  };
}

/** Deletes a collaborative note and all its update documents. */
export async function deleteCollabNote(
  noteId: string
): Promise<void> {
  // Delete all note_updates for this note
  const updatesQuery = query(
    collection(db, "note_updates"),
    where("noteId", "==", noteId)
  );
  const updatesSnap = await getDocs(updatesQuery);

  if (updatesSnap.docs.length > 0) {
    const batch = writeBatch(db);
    updatesSnap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }

  // Delete the note itself
  await deleteDoc(doc(db, "notes", noteId));
}
