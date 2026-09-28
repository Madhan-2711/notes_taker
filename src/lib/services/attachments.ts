import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  collection,
  query,
  orderBy,
  documentId,
  limit as fbLimit,
  startAfter,
} from "firebase/firestore";
import { auth, db } from "../firebaseConfig";
import { decryptKeyFromUser } from "./crypto/sharing";
import { arrayBufferToBase64, base64ToArrayBuffer } from "./crypto/serialization";
import {
  MAX_INLINE_B64,
  MAX_INLINE_PLAINTEXT,
  IMAGE_EXT,
  validateAttachment,
  normalizeImage,
  sealAttachment,
  openAttachment,
} from "../attachmentCrypto";
import { isCollabNote, isSecureNote, type Note } from "../validations";

const PAGE_SIZE = 20;

export interface Attachment { path: string; name: string; size: number; uploader: string }

export async function attachmentAccess(noteId: string, uid: string, privateKey: CryptoKey, knownNote?: Note) {
  const note = knownNote?.id === noteId ? knownNote : (await getDoc(doc(db, "notes", noteId))).data() as Note | undefined;
  if (!note || (!isSecureNote(note) && !isCollabNote(note)) || !note.encryptedKeys?.[uid]) throw new Error("You no longer have access to this note.");
  const owner = note.authorId === uid;
  const editor = owner || (isCollabNote(note) && note.collaboratorIds?.includes(uid) && (note.collaboratorRoles?.[uid] ?? "editor") === "editor");
  return { key: await decryptKeyFromUser(note.encryptedKeys[uid], privateKey), owner, editor: Boolean(editor) };
}

/**
 * List a page of attachments for a note. Each attachment is one Firestore
 * document under notes/{noteId}/attachments, holding the base64 ciphertext and
 * an encrypted filename. One malformed document is skipped rather than hiding
 * the whole list.
 */
export async function listAttachments(noteId: string, key: CryptoKey, pageToken?: string) {
  const col = collection(db, "notes", noteId, "attachments");
  let cursor: { createdAt: number; id: string } | undefined;
  if (pageToken) {
    try {
      cursor = JSON.parse(pageToken);
    } catch {
      throw new Error("Invalid attachment page. Refresh the list and try again.");
    }
    if (!cursor || !Number.isFinite(cursor.createdAt) || typeof cursor.id !== "string" || !cursor.id) {
      throw new Error("Invalid attachment page. Refresh the list and try again.");
    }
  }
  const sorting = [orderBy("createdAt", "desc"), orderBy(documentId(), "desc")];
  const constraints = pageToken
    ? [...sorting, startAfter(cursor!.createdAt, cursor!.id), fbLimit(PAGE_SIZE)]
    : [...sorting, fbLimit(PAGE_SIZE)];
  const snap = await getDocs(query(col, ...constraints));

  const results = await Promise.allSettled(snap.docs.map(async (item): Promise<Attachment> => {
    const data = item.data();
    if (typeof data.name !== "string" || typeof data.nameIv !== "string") throw new Error("Invalid attachment metadata.");
    const decoded = await openAttachment(base64ToArrayBuffer(data.name), data.nameIv, key, `${item.ref.path}:label`);
    const label = JSON.parse(new TextDecoder().decode(decoded));
    if (typeof label.name !== "string" || label.name.length > 255) throw new Error("Invalid attachment name.");
    return { path: item.ref.path, name: label.name, size: Number(data.size) || 0, uploader: String(data.uploader ?? "") };
  }));

  const files = results.filter((r): r is PromiseFulfilledResult<Attachment> => r.status === "fulfilled").map((r) => r.value);
  const last = snap.docs[snap.docs.length - 1];
  const nextPage = snap.size === PAGE_SIZE && last
    ? JSON.stringify({ createdAt: last.data().createdAt, id: last.id })
    : undefined;
  return { files, nextPage };
}

/**
 * Encrypt a file and store it inline in Firestore. Images are downscaled to
 * WebP so they fit a single document; other files must be small enough to fit.
 */
export async function uploadAttachment(
  noteId: string,
  uid: string,
  key: CryptoKey,
  file: File,
  progress: (value: number) => void,
  signal: AbortSignal
) {
  validateAttachment(file.name, file.size);
  progress(5);

  let bytes: ArrayBuffer;
  let displayName: string;
  if (IMAGE_EXT.test(file.name)) {
    const optimized = await normalizeImage(file);
    bytes = await optimized.blob.arrayBuffer();
    displayName = optimized.name;
  } else {
    if (file.size > MAX_INLINE_PLAINTEXT) {
      throw new Error("This file is too large to store without file storage. Keep non-image files under ~650 KB, or attach an image instead.");
    }
    bytes = await file.arrayBuffer();
    displayName = file.name.slice(0, 255);
  }
  if (signal.aborted) throw new Error("Upload cancelled.");
  progress(40);

  const ref = doc(collection(db, "notes", noteId, "attachments"));
  const path = ref.path;

  const sealed = await sealAttachment(bytes, key, path);
  const ciphertext = arrayBufferToBase64(sealed.ciphertext);
  if (ciphertext.length > MAX_INLINE_B64) throw new Error("This file is too large to store inline. Try a smaller image or file.");

  const label = await sealAttachment(
    new TextEncoder().encode(JSON.stringify({ name: displayName })).buffer,
    key,
    `${path}:label`
  );
  if (signal.aborted) throw new Error("Upload cancelled.");
  progress(75);

  await setDoc(ref, {
    ciphertext,
    iv: sealed.iv,
    name: arrayBufferToBase64(label.ciphertext),
    nameIv: label.iv,
    uploader: uid,
    size: bytes.byteLength,
    createdAt: Date.now(),
  });
  progress(100);
}

/** Decrypt an attachment and return it as a Blob (forced download, never rendered as HTML). */
export async function downloadAttachment(file: Attachment, key: CryptoKey) {
  const snap = await getDoc(doc(db, file.path));
  if (!snap.exists()) throw new Error("Attachment not found.");
  const data = snap.data();
  if (typeof data.ciphertext !== "string" || typeof data.iv !== "string") throw new Error("Invalid attachment.");
  const decrypted = await openAttachment(base64ToArrayBuffer(data.ciphertext), data.iv, key, file.path);
  return new Blob([decrypted], { type: "application/octet-stream" });
}

export async function removeAttachment(file: Attachment) {
  await deleteDoc(doc(db, file.path));
}

/** Delete every attachment under a note. Call before deleting the note itself. */
export async function deleteAllAttachments(noteId: string) {
  const parent = await getDoc(doc(db, "notes", noteId));
  if (!parent.exists() || parent.data().authorId !== auth.currentUser?.uid) {
    throw new Error("Only the note owner can delete this note and its attachments.");
  }
  const col = collection(db, "notes", noteId, "attachments");
  // Page through so a note with many attachments is fully cleared.
  for (;;) {
    const snap = await getDocs(query(col, fbLimit(100)));
    if (snap.empty) break;
    await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
    if (snap.size < 100) break;
  }
}
