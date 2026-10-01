"use client";

import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import { ConfirmDialog } from "./ui/ConfirmDialog";
import { decryptKeyFromUser } from "../lib/services/crypto/sharing";
import { decryptData } from "../lib/services/crypto/decrypt";
import { listRevisions, restoreRevision, type NoteRevision } from "../lib/services/noteRevisions";
import { isSecureNote, type Note } from "../lib/validations";

export function NoteHistory({ note, userId, privateKey, onRestored }: { note: Note; userId: string; privateKey: CryptoKey | null; onRestored: () => void }) {
  const [versions, setVersions] = useState<NoteRevision[]>([]);
  const [selected, setSelected] = useState<{ id: string; title: string; content: string } | null>(null);
  const [confirming, setConfirming] = useState(false);
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
    if (!selected) return;
    await restoreRevision(note.id, selected.id);
    setConfirming(false);
    onRestored();
  }

  return <section aria-label="Version history">
    {error && <p role="alert" className="mb-3 text-sm text-red-700">{error}</p>}
    {versions.length === 0 ? <p className="text-sm text-slate-600">Earlier versions appear after you edit this note.</p> : <>
      <p className="mb-2 text-sm text-slate-700">Choose a version to preview it.</p>
      <div className="flex flex-wrap gap-2">
        {versions.map((version) => <button key={version.id} type="button" aria-pressed={selected?.id === version.id} onClick={() => void preview(version)} className={`chip min-h-10 ${selected?.id === version.id ? "border-indigo-700 bg-indigo-50 text-indigo-900" : "border-slate-300 bg-white text-slate-800 hover:border-indigo-500"}`}>{new Date(version.createdAt).toLocaleString()}</button>)}
      </div>
    </>}
    {selected && <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <h4 className="font-bold text-slate-900">{selected.title}</h4>
      <p className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words text-sm text-slate-700">{selected.content}</p>
      <button type="button" onClick={() => setConfirming(true)} className="btn-secondary mt-4"><RotateCcw size={16} aria-hidden="true" /> Restore this version</button>
    </div>}
    <ConfirmDialog
      open={confirming}
      title="Restore this version?"
      description="Your current text will be kept in version history, so you can switch back later."
      confirmLabel="Restore version"
      onConfirm={restore}
      onCancel={() => setConfirming(false)}
    />
  </section>;
}
