"use client";

import { useEffect, useState } from "react";
import { History, RotateCcw } from "lucide-react";
import { decryptKeyFromUser } from "../lib/services/crypto/sharing";
import { decryptData } from "../lib/services/crypto/decrypt";
import { listRevisions, restoreRevision, type NoteRevision } from "../lib/services/noteRevisions";
import { isSecureNote, type Note } from "../lib/validations";

export function NoteHistory({ note, userId, privateKey, onRestored }: { note: Note; userId: string; privateKey: CryptoKey | null; onRestored: () => void }) {
  const [versions, setVersions] = useState<NoteRevision[]>([]);
  const [selected, setSelected] = useState<{ id: string; title: string; content: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (note.authorId !== userId) return;
    let active = true;
    listRevisions(note.id).then((items) => { if (active) setVersions(items); })
      .catch(() => { if (active) setError("Could not load version history."); });
    return () => { active = false; };
  }, [note.id, note.authorId, userId]);

  async function preview(version: NoteRevision) {
    setError("");
    try {
      if (version.mode === "normal") {
        setSelected({ id: version.id, title: version.title || "Untitled", content: version.content || "" });
        return;
      }
      if (!isSecureNote(note) || !privateKey || !version.encryptedTitle || !version.encryptedContent || !version.iv) throw new Error("Unlock your vault to preview this version.");
      const key = await decryptKeyFromUser(note.encryptedKeys[userId], privateKey);
      const ivs = JSON.parse(version.iv) as { title: string; content: string };
      const [title, content] = await Promise.all([
        decryptData(version.encryptedTitle, ivs.title, key),
        decryptData(version.encryptedContent, ivs.content, key),
      ]);
      setSelected({ id: version.id, title, content });
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not preview this version."); }
  }

  async function restore() {
    if (!selected || !window.confirm("Restore this version? Your current text will be kept in history.")) return;
    setBusy(true);
    try { await restoreRevision(note.id, selected.id); onRestored(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not restore version."); }
    finally { setBusy(false); }
  }

  return <details className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
    <summary className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-bold text-slate-800 focus-visible:outline-2 focus-visible:outline-indigo-600"><History size={17} /> Version history ({versions.length})</summary>
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    {versions.length === 0 ? <p className="mt-3 text-sm text-slate-600">Earlier versions appear after you edit this note.</p> : <div className="mt-3 flex flex-wrap gap-2">
      {versions.map((version) => <button key={version.id} type="button" onClick={() => void preview(version)} className={`min-h-11 rounded-xl border px-3 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-indigo-600 ${selected?.id === version.id ? "border-indigo-500 bg-indigo-50 text-indigo-800" : "border-slate-300 text-slate-700 hover:border-indigo-400"}`}>{new Date(version.createdAt).toLocaleString()}</button>)}
    </div>}
    {selected && <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <h4 className="font-bold text-slate-900">{selected.title}</h4>
      <p className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words text-sm text-slate-700">{selected.content}</p>
      <button type="button" disabled={busy} onClick={() => void restore()} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50"><RotateCcw size={16} /> Restore this version</button>
    </div>}
  </details>;
}
