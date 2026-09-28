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
  updateDoc,
} from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { encryptData } from "../crypto/encrypt";
import { decryptData } from "../crypto/decrypt";
import { generateAESKey } from "../crypto/keys";
import { encryptKeyForUser, decryptKeyFromUser } from "../crypto/sharing";
import { addNotesToGroup } from "../../groupsService";
import { arrayBufferToBase64, base64ToArrayBuffer } from "../crypto/serialization";
import * as Y from "yjs";
import type { CollabRole } from "../../validations";
import { deleteAllAttachments } from "../attachments";
import { addRevisionToBatch, deleteAllRevisions } from "../noteRevisions";
import { deleteAllComments } from "../noteComments";

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

  // Generate one AES key and encrypt both title and document snapshot.
  const noteKey = await generateAESKey();
  const encryptedSnapshot = await encryptData(snapshotBase64, noteKey);
  const encryptedTitle = await encryptData(title, noteKey);

  // Wrap the AES key with the author's public key
  const wrappedKey = await encryptKeyForUser(noteKey, publicKey);

  const newNote = {
    mode: "collab" as const,
    title: "Encrypted collaborative note",
    encryptedTitle: encryptedTitle.ciphertext,
    titleIv: encryptedTitle.iv,
    collaboratorIds: [] as string[],
    collaboratorRoles: {} as Record<string, "editor" | "viewer">,
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
  authorId: string;
  role: CollabRole;
}> {
  const ref = doc(db, "notes", noteId);
  const snap = await getDoc(ref);

  if (!snap.exists()) throw new Error("Note not found");

  const data = snap.data();
  if (data.authorId === userId && !data.collaboratorRoles) {
    const legacyRoles = Object.fromEntries(
      ((data.collaboratorIds || []) as string[]).map((uid) => [uid, "editor"])
    );
    await updateDoc(ref, { collaboratorRoles: legacyRoles });
    data.collaboratorRoles = legacyRoles;
  }
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

  const title =
    data.encryptedTitle && data.titleIv
      ? await decryptData(data.encryptedTitle, data.titleIv, noteKey)
      : data.title || "Untitled";

  return {
    ydoc,
    noteKey,
    title,
    authorId: data.authorId,
    role:
      data.authorId === userId
        ? "owner"
        : data.collaboratorRoles?.[userId] === "viewer"
          ? "viewer"
          : "editor",
  };
}

/** Place images uploaded during creation into the encrypted shared document. */
export async function appendImagesToCollabNote(noteId: string, userId: string, privateKey: CryptoKey, content: string, tokens: string[]) {
  if (!tokens.length) return;
  const { ydoc, noteKey } = await loadCollabNote(noteId, userId, privateKey);
  try {
    const text = ydoc.getText("content");
    const addition = `\n\n${tokens.join("\n\n")}`;
    if (content.length + addition.length > 5000) throw new Error("The note is too long to place its images. Shorten the text and retry; your uploaded files are safe.");
    text.delete(0, text.length);
    text.insert(0, content + addition);
    const snapshot = Y.encodeStateAsUpdate(ydoc);
    const encrypted = await encryptData(arrayBufferToBase64(snapshot.buffer), noteKey);
    const noteRef = doc(db, "notes", noteId);
    const previous = await getDoc(noteRef);
    if (!previous.exists() || previous.data().authorId !== userId) throw new Error("Only the owner can add images to this note.");
    const batch = writeBatch(db);
    addRevisionToBatch(batch, noteId, previous.data(), userId);
    batch.update(noteRef, { latestSnapshot: encrypted.ciphertext, snapshotIv: encrypted.iv, updatedAt: Date.now() });
    await batch.commit();
  } finally { ydoc.destroy(); }
}

/** Deletes a collaborative note and all its update documents. */
export async function deleteCollabNote(
  noteId: string
): Promise<void> {
  await deleteAllAttachments(noteId);
  await deleteAllRevisions(noteId);
  await deleteAllComments(noteId);
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
