import { auth, db } from "../firebaseConfig";
import { collection, deleteDoc, doc, getDoc, getDocs, limit, orderBy, query, writeBatch, type DocumentData, type WriteBatch } from "firebase/firestore";

export interface NoteRevision {
  id: string;
  mode: "normal" | "secure" | "collab";
  createdAt: number;
  editorId: string;
  title?: string;
  content?: string;
  encryptedTitle?: string;
  encryptedContent?: string;
  iv?: string;
  titleIv?: string;
  latestSnapshot?: string;
  snapshotIv?: string;
}

/** Save the prior state in the same batch as an edit; no plaintext is added for encrypted notes. */
export function addRevisionToBatch(batch: WriteBatch, noteId: string, data: DocumentData, editorId: string) {
  const mode = data.mode || "normal";
  // Older collaborative notes may not have encrypted titles. Do not let an
  // undefined optional field prevent a checkpoint from being saved.
  if (mode === "collab" && (!data.encryptedTitle || !data.titleIv || !data.latestSnapshot || !data.snapshotIv)) return;
  const base = { mode, editorId, createdAt: Date.now() };
  const payload = mode === "secure"
    ? { ...base, encryptedTitle: data.encryptedTitle, encryptedContent: data.encryptedContent, iv: data.iv }
    : mode === "collab"
      ? { ...base, title: data.title, encryptedTitle: data.encryptedTitle, titleIv: data.titleIv, latestSnapshot: data.latestSnapshot, snapshotIv: data.snapshotIv }
      : { ...base, title: data.title, content: data.content };
  batch.set(doc(collection(db, "notes", noteId, "revisions")), payload);
}

export async function listRevisions(noteId: string): Promise<NoteRevision[]> {
  const snap = await getDocs(query(collection(db, "notes", noteId, "revisions"), orderBy("createdAt", "desc"), limit(20)));
  return snap.docs.map((item) => ({ id: item.id, ...item.data() }) as NoteRevision);
}

export async function restoreRevision(noteId: string, revisionId: string): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error("Sign in to restore a version.");
  const [noteSnap, revisionSnap] = await Promise.all([
    getDoc(doc(db, "notes", noteId)),
    getDoc(doc(db, "notes", noteId, "revisions", revisionId)),
  ]);
  if (!noteSnap.exists() || noteSnap.data().authorId !== uid || !revisionSnap.exists()) throw new Error("Version not available.");
  const data = revisionSnap.data() as NoteRevision;
  if (data.mode !== (noteSnap.data().mode || "normal") || data.mode === "collab") throw new Error("This version cannot be restored from here.");
  const replacement = data.mode === "secure"
    ? { encryptedTitle: data.encryptedTitle, encryptedContent: data.encryptedContent, iv: data.iv, updatedAt: Date.now() }
    : { title: data.title, content: data.content, updatedAt: Date.now() };
  const batch = writeBatch(db);
  addRevisionToBatch(batch, noteId, noteSnap.data(), uid);
  batch.update(noteSnap.ref, replacement);
  await batch.commit();
}

/** Call before deleting a parent note, because orphaned subcollections remain in Firestore. */
export async function deleteAllRevisions(noteId: string): Promise<void> {
  const parent = await getDoc(doc(db, "notes", noteId));
  if (!parent.exists() || parent.data().authorId !== auth.currentUser?.uid) throw new Error("Only the note owner can delete revisions.");
  for (;;) {
    const snap = await getDocs(query(collection(db, "notes", noteId, "revisions"), limit(100)));
    if (snap.empty) break;
    await Promise.all(snap.docs.map((item) => deleteDoc(item.ref)));
    if (snap.size < 100) break;
  }
}
