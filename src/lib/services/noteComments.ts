import { addDoc, collection, deleteDoc, doc, getDoc, getDocs, limit, query } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";
import { encryptData } from "./crypto/encrypt";

export async function addNoteComment(noteId: string, uid: string, authorName: string, text: string, mentions: string[], key: CryptoKey) {
  const body = text.trim();
  if (!body || body.length > 2000) throw new Error("Write a comment under 2,000 characters.");
  const encrypted = await encryptData(JSON.stringify({ text: body, mentions }), key);
  await addDoc(collection(db, "notes", noteId, "comments"), {
    authorId: uid, authorName: authorName.slice(0, 100),
    ciphertext: encrypted.ciphertext, iv: encrypted.iv, createdAt: Date.now(),
  });
}

export async function deleteNoteComment(noteId: string, commentId: string) {
  await deleteDoc(doc(db, "notes", noteId, "comments", commentId));
}

export async function deleteAllComments(noteId: string) {
  const parent = await getDoc(doc(db, "notes", noteId));
  if (!parent.exists() || parent.data().authorId !== auth.currentUser?.uid) throw new Error("Only the note owner can remove its discussion.");
  for (;;) {
    const snap = await getDocs(query(collection(db, "notes", noteId, "comments"), limit(100)));
    if (snap.empty) break;
    await Promise.all(snap.docs.map((item) => deleteDoc(item.ref)));
    if (snap.size < 100) break;
  }
}
