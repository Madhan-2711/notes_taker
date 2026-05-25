/**
 * Secure Notes Service
 *
 * Handles CRUD for end-to-end encrypted notes.
 * Each secure note gets its own AES-256-GCM key, which is wrapped with
 * the author's RSA public key and stored alongside the encrypted content.
 */

import {
  collection,
  addDoc,
  deleteDoc,
  updateDoc,
  getDoc,
  doc,
} from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { encryptData } from "../crypto/encrypt";
import { decryptData } from "../crypto/decrypt";
import { generateAESKey } from "../crypto/keys";
import { encryptKeyForUser, decryptKeyFromUser } from "../crypto/sharing";
import { addNotesToGroup } from "../../groupsService";

/**
 * Creates an encrypted note.
 * - Generates a unique AES key for this note
 * - Encrypts title and content with AES-GCM
 * - Wraps the AES key with the author's RSA public key
 * - Stores everything in Firestore (no plaintext ever hits the server)
 */
export async function createSecureNote(
  userId: string,
  title: string,
  content: string,
  groupIds: string[],
  publicKey: CryptoKey
): Promise<string> {
  // Generate a per-note AES key
  const noteKey = await generateAESKey();

  // Encrypt title and content
  const encryptedTitle = await encryptData(title, noteKey);
  const encryptedContent = await encryptData(content, noteKey);

  // Wrap the AES key with the author's public key
  const wrappedKey = await encryptKeyForUser(noteKey, publicKey);

  const newNote = {
    mode: "secure" as const,
    encryptedTitle: encryptedTitle.ciphertext,
    encryptedContent: encryptedContent.ciphertext,
    // Store both IVs as a JSON object
    iv: JSON.stringify({
      title: encryptedTitle.iv,
      content: encryptedContent.iv,
    }),
    encryptedKeys: { [userId]: wrappedKey },
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

/**
 * Reads and decrypts a secure note.
 * - Fetches the note from Firestore
 * - Unwraps the AES key using the user's private key
 * - Decrypts title and content
 */
export async function readSecureNote(
  noteId: string,
  userId: string,
  privateKey: CryptoKey
): Promise<{ title: string; content: string }> {
  const ref = doc(db, "notes", noteId);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    throw new Error("Note not found");
  }

  const data = snap.data();
  const wrappedKey = data.encryptedKeys?.[userId];

  if (!wrappedKey) {
    throw new Error("You don't have access to this note's encryption key");
  }

  // Unwrap the AES key
  const noteKey = await decryptKeyFromUser(wrappedKey, privateKey);

  // Parse IVs
  const ivs = JSON.parse(data.iv);

  // Decrypt title and content
  const title = await decryptData(data.encryptedTitle, ivs.title, noteKey);
  const content = await decryptData(data.encryptedContent, ivs.content, noteKey);

  return { title, content };
}

/**
 * Updates an encrypted note.
 * - Unwraps the existing AES key
 * - Re-encrypts with new content (generates new IVs for each field)
 */
export async function updateSecureNote(
  noteId: string,
  userId: string,
  title: string,
  content: string,
  privateKey: CryptoKey
): Promise<void> {
  const ref = doc(db, "notes", noteId);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    throw new Error("Note not found");
  }

  const data = snap.data();
  const wrappedKey = data.encryptedKeys?.[userId];

  if (!wrappedKey) {
    throw new Error("You don't have access to this note's encryption key");
  }

  // Unwrap the AES key
  const noteKey = await decryptKeyFromUser(wrappedKey, privateKey);

  // Re-encrypt with new content
  const encryptedTitle = await encryptData(title, noteKey);
  const encryptedContent = await encryptData(content, noteKey);

  await updateDoc(ref, {
    encryptedTitle: encryptedTitle.ciphertext,
    encryptedContent: encryptedContent.ciphertext,
    iv: JSON.stringify({
      title: encryptedTitle.iv,
      content: encryptedContent.iv,
    }),
    updatedAt: Date.now(),
  });
}

/** Deletes a secure note (same as deleting any note). */
export async function deleteSecureNote(noteId: string): Promise<void> {
  await deleteDoc(doc(db, "notes", noteId));
}
