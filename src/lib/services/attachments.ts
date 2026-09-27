import { doc, getDoc } from "firebase/firestore";
import { getStorage, ref, list, getMetadata, getBytes, deleteObject, uploadBytesResumable } from "firebase/storage";
import { app, db } from "../firebaseConfig";
import { decryptKeyFromUser } from "./crypto/sharing";
import { arrayBufferToBase64, base64ToArrayBuffer } from "./crypto/serialization";
import { MAX_ATTACHMENT_BYTES, validateAttachment, sealAttachment, openAttachment } from "../attachmentCrypto";

function storage() {
  if (!app?.options.storageBucket) throw new Error("File storage is not configured yet. Contact the workspace owner.");
  return getStorage(app);
}

export async function attachmentAccess(noteId: string, uid: string, privateKey: CryptoKey) {
  const snapshot = await getDoc(doc(db, "notes", noteId));
  const note = snapshot.data();
  if (!note || !["secure", "collab"].includes(note.mode) || !note.encryptedKeys?.[uid]) throw new Error("You no longer have access to this note.");
  const owner = note.authorId === uid;
  const editor = owner || (note.collaboratorIds?.includes(uid) && (note.collaboratorRoles?.[uid] ?? "editor") === "editor");
  return { key: await decryptKeyFromUser(note.encryptedKeys[uid], privateKey), owner, editor: Boolean(editor) };
}

export interface Attachment { path: string; name: string; size: number; uploader: string }

export async function listAttachments(noteId: string, key: CryptoKey, pageToken?: string) {
  const page = await list(ref(storage(), `attachments/${noteId}`), { maxResults: 20, ...(pageToken ? { pageToken } : {}) });
  const files = await Promise.all(page.items.map(async (item): Promise<Attachment> => {
    const metadata = await getMetadata(item);
    const custom = metadata.customMetadata;
    if (!custom?.label || !custom.labelIv) throw new Error("An attachment has invalid metadata.");
    const decoded = await openAttachment(base64ToArrayBuffer(custom.label), custom.labelIv, key, `${item.fullPath}:label`);
    const label = JSON.parse(new TextDecoder().decode(decoded));
    if (typeof label.name !== "string" || label.name.length > 255) throw new Error("Invalid attachment name.");
    return { path: item.fullPath, name: label.name, size: metadata.size - 16, uploader: custom.uploader };
  }));
  return { files, nextPage: page.nextPageToken };
}

export async function uploadAttachment(noteId: string, uid: string, key: CryptoKey, file: File, progress: (value: number) => void, signal: AbortSignal) {
  validateAttachment(file.name, file.size);
  const path = `attachments/${noteId}/${crypto.randomUUID()}`;
  const payload = await sealAttachment(await file.arrayBuffer(), key, path);
  const label = await sealAttachment(new TextEncoder().encode(JSON.stringify({ name: file.name.slice(0, 255) })).buffer, key, `${path}:label`);
  if (signal.aborted) throw new Error("Upload cancelled.");
  const task = uploadBytesResumable(ref(storage(), path), payload.ciphertext, {
    contentType: "application/octet-stream",
    customMetadata: { uploader: uid, iv: payload.iv, label: arrayBufferToBase64(label.ciphertext), labelIv: label.iv },
  });
  const cancel = () => task.cancel();
  signal.addEventListener("abort", cancel, { once: true });
  try {
    await new Promise<void>((resolve, reject) => task.on("state_changed", (snapshot) => progress(Math.round(snapshot.bytesTransferred / snapshot.totalBytes * 100)), reject, resolve));
  } finally { signal.removeEventListener("abort", cancel); }
}

export async function downloadAttachment(file: Attachment, key: CryptoKey) {
  const target = ref(storage(), file.path);
  const metadata = await getMetadata(target);
  if (!metadata.customMetadata?.iv) throw new Error("Invalid attachment.");
  const bytes = await getBytes(target, MAX_ATTACHMENT_BYTES + 16);
  const decrypted = await openAttachment(bytes, metadata.customMetadata.iv, key, file.path);
  // Force download; never execute or embed user-supplied documents as HTML.
  return new Blob([decrypted], { type: "application/octet-stream" });
}

export async function removeAttachment(file: Attachment) {
  await deleteObject(ref(storage(), file.path));
}
