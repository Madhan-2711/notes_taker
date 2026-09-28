import { collection, getDocs, query, where } from "firebase/firestore";
import * as Y from "yjs";
import { db } from "./firebaseConfig";
import { base64ToArrayBuffer } from "./services/crypto/serialization";
import { decryptData } from "./services/crypto/decrypt";
import { decryptKeyFromUser } from "./services/crypto/sharing";
import { isCollabNote, isNormalNote, type Note } from "./validations";

/** Search text stays in browser memory; encrypted content is never uploaded as an index. */
export async function searchableText(note: Note, userId: string, privateKey: CryptoKey | null): Promise<string> {
  if (isNormalNote(note)) return `${note.title} ${note.content}`.toLocaleLowerCase();
  if (!privateKey || !note.encryptedKeys?.[userId]) return "";

  const key = await decryptKeyFromUser(note.encryptedKeys[userId], privateKey);
  if (!isCollabNote(note)) {
    const ivs = JSON.parse(note.iv) as { title: string; content: string };
    const [title, content] = await Promise.all([
      decryptData(note.encryptedTitle, ivs.title, key),
      decryptData(note.encryptedContent, ivs.content, key),
    ]);
    return `${title} ${content}`.toLocaleLowerCase();
  }

  const title = note.encryptedTitle && note.titleIv
    ? await decryptData(note.encryptedTitle, note.titleIv, key)
    : note.title;
  const ydoc = new Y.Doc();
  try {
    if (note.latestSnapshot && note.snapshotIv) {
      const snapshot = await decryptData(note.latestSnapshot, note.snapshotIv, key);
      Y.applyUpdate(ydoc, new Uint8Array(base64ToArrayBuffer(snapshot)));
    }
    const updates = await getDocs(query(collection(db, "note_updates"), where("noteId", "==", note.id)));
    for (const item of updates.docs) {
      const data = item.data();
      if (typeof data.encryptedUpdate !== "string" || typeof data.iv !== "string") continue;
      const decrypted = await decryptData(data.encryptedUpdate, data.iv, key);
      Y.applyUpdate(ydoc, new Uint8Array(base64ToArrayBuffer(decrypted)));
    }
    return `${title} ${ydoc.getText("content").toString()}`.toLocaleLowerCase();
  } finally {
    ydoc.destroy();
  }
}

export async function buildSearchIndex(notes: Note[], userId: string, privateKey: CryptoKey | null): Promise<Map<string, string>> {
  const index = new Map<string, string>();
  let next = 0;
  const workers = Array.from({ length: Math.min(4, notes.length) }, async () => {
    while (next < notes.length) {
      const note = notes[next++];
      try { index.set(note.id, await searchableText(note, userId, privateKey)); }
      catch { index.set(note.id, ""); }
    }
  });
  await Promise.all(workers);
  return index;
}
