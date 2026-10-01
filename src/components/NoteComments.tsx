"use client";

import { useEffect, useState } from "react";
import { collection, doc, getDoc, onSnapshot, orderBy, query } from "firebase/firestore";
import { MessageCircle, Send, Trash2 } from "lucide-react";
import { db } from "../lib/firebaseConfig";
import { attachmentAccess } from "../lib/services/attachments";
import { decryptData } from "../lib/services/crypto/decrypt";
import { addNoteComment, deleteNoteComment } from "../lib/services/noteComments";

interface Comment { id: string; authorId: string; authorName: string; text: string; createdAt: number; mentions: string[] }
interface Person { uid: string; name: string }

export function NoteComments({ noteId, userId, userName, privateKey }: { noteId: string; userId: string; userName: string; privateKey: CryptoKey | null }) {
  const [key, setKey] = useState<CryptoKey | null>(null);
  const [ownerId, setOwnerId] = useState("");
  const [people, setPeople] = useState<Person[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [message, setMessage] = useState("");
  const [selectedMentions, setSelectedMentions] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!privateKey) return;
    let active = true;
    let unsubscribe: (() => void) | undefined;
    (async () => {
      const [{ key: noteKey }, noteSnap] = await Promise.all([
        attachmentAccess(noteId, userId, privateKey),
        getDoc(doc(db, "notes", noteId)),
      ]);
      if (!active || !noteKey || !noteSnap.exists()) return;
      setKey(noteKey);
      const note = noteSnap.data();
      setOwnerId(note.authorId);
      const ids = Array.from(new Set<string>([note.authorId, ...(note.collaboratorIds || [])]));
      const profiles = await Promise.all(ids.filter((uid) => uid !== userId).map(async (uid) => {
        const profile = await getDoc(doc(db, "public_profiles", uid));
        return { uid, name: profile.data()?.displayName || "Collaborator" };
      }));
      if (active) setPeople(profiles);
      if (!active) return;
      unsubscribe = onSnapshot(query(collection(db, "notes", noteId, "comments"), orderBy("createdAt", "asc")), async (snapshot) => {
        const results = await Promise.allSettled(snapshot.docs.map(async (item): Promise<Comment> => {
          const data = item.data();
          const body = JSON.parse(await decryptData(data.ciphertext, data.iv, noteKey)) as { text: string; mentions?: string[] };
          if (typeof body.text !== "string") throw new Error("Invalid comment.");
          return { id: item.id, authorId: data.authorId, authorName: data.authorName || "Someone", text: body.text, mentions: body.mentions || [], createdAt: data.createdAt };
        }));
        if (active) setComments(results.filter((result): result is PromiseFulfilledResult<Comment> => result.status === "fulfilled").map((result) => result.value));
      }, () => { if (active) setError("Could not load discussion. Check your access and connection."); });
    })().catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : "Could not open discussion."); });
    return () => { active = false; unsubscribe?.(); };
  }, [noteId, userId, privateKey]);

  async function send() {
    if (!key || busy) return;
    setBusy(true); setError("");
    try {
      const mentions = selectedMentions.filter((uid) => {
        const person = people.find((item) => item.uid === uid);
        return person && message.includes(`@${person.name}`);
      });
      await addNoteComment(noteId, userId, userName, message, mentions, key);
      setMessage(""); setSelectedMentions([]);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not send comment."); }
    finally { setBusy(false); }
  }

  return <details open className="rounded-2xl border border-slate-200 bg-white px-4">
    <summary className="flex min-h-12 cursor-pointer items-center gap-2 text-sm font-bold text-slate-800 focus-visible:outline-2 focus-visible:outline-indigo-600"><MessageCircle size={17} /> Discussion <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{comments.length}</span></summary>
    {!privateKey ? <p className="mb-4 text-sm text-slate-700">Unlock your vault to read and write comments.</p> : <div className="pb-4">
      {comments.length === 0 && <p className="mb-3 text-sm text-slate-600">No comments yet. Start the conversation.</p>}
      <ol className="max-h-72 space-y-3 overflow-y-auto" aria-label="Comments">{comments.map((comment) => <li key={comment.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <div className="flex items-center justify-between gap-2"><p className="min-w-0 truncate text-xs font-bold text-slate-800">{comment.authorName} · {new Date(comment.createdAt).toLocaleString()}</p>
          {(comment.authorId === userId || ownerId === userId) && <button type="button" aria-label={`Delete comment by ${comment.authorName}`} onClick={() => void deleteNoteComment(noteId, comment.id).catch(() => setError("Could not delete comment."))} className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg text-slate-600 hover:bg-red-50 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-indigo-600"><Trash2 size={15} /></button>}
        </div>
        <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-800">{comment.text}</p>
      </li>)}</ol>
      {people.length > 0 && <div className="mt-4 flex flex-wrap items-center gap-2"><span className="text-xs font-semibold text-slate-600">Mention:</span>{people.map((person) => <button key={person.uid} type="button" onClick={() => { setMessage((value) => `${value}${value && !value.endsWith(" ") ? " " : ""}@${person.name} `); setSelectedMentions((ids) => ids.includes(person.uid) ? ids : [...ids, person.uid]); }} className="min-h-10 rounded-full border border-indigo-200 px-3 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 focus-visible:outline-2 focus-visible:outline-indigo-600">@{person.name}</button>)}</div>}
      <label htmlFor={`comment-${noteId}`} className="mt-4 block text-xs font-bold text-slate-700">Add a comment</label>
      <textarea id={`comment-${noteId}`} value={message} maxLength={2000} onChange={(event) => setMessage(event.target.value)} placeholder="Share an idea or ask a question…" className="mt-2 min-h-24 w-full resize-y rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900 focus-visible:outline-2 focus-visible:outline-indigo-600" />
      <button type="button" disabled={!message.trim() || !key || busy} onClick={() => void send()} className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50"><Send size={15} />{busy ? "Sending…" : "Send comment"}</button>
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    </div>}
  </details>;
}
