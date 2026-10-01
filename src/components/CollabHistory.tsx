"use client";

import { useState } from "react";
import * as Y from "yjs";
import { History } from "lucide-react";
import { attachmentAccess } from "../lib/services/attachments";
import { decryptData } from "../lib/services/crypto/decrypt";
import { base64ToArrayBuffer } from "../lib/services/crypto/serialization";
import { listRevisions, type NoteRevision } from "../lib/services/noteRevisions";

export function CollabHistory({ noteId, userId, privateKey }: { noteId: string; userId: string; privateKey: CryptoKey | null }) {
  const [versions, setVersions] = useState<NoteRevision[]>([]);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    setBusy(true); setError("");
    try { setVersions(await listRevisions(noteId)); }
    catch { setError("Could not load earlier checkpoints."); }
    finally { setBusy(false); }
  }

  async function openVersion(version: NoteRevision) {
    if (!privateKey || !version.latestSnapshot || !version.snapshotIv) return;
    setBusy(true); setError("");
    try {
      const { key } = await attachmentAccess(noteId, userId, privateKey);
      if (!key) throw new Error("Unlock your vault to read this checkpoint.");
      const encoded = await decryptData(version.latestSnapshot, version.snapshotIv, key);
      const ydoc = new Y.Doc();
      try {
        Y.applyUpdate(ydoc, new Uint8Array(base64ToArrayBuffer(encoded)));
        setPreview(ydoc.getText("content").toString());
      } finally { ydoc.destroy(); }
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not read this checkpoint."); }
    finally { setBusy(false); }
  }

  return <details className="rounded-2xl border border-slate-200 bg-white px-4" onToggle={(event) => { if (event.currentTarget.open) void load(); }}>
    <summary className="flex min-h-12 cursor-pointer items-center gap-2 text-sm font-bold text-slate-800 focus-visible:outline-2 focus-visible:outline-indigo-600"><History size={17} /> Checkpoint history</summary>
    <div className="pb-4">
      {busy && <p role="status" className="text-sm text-slate-600">Loading checkpoint…</p>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {!busy && versions.length === 0 && <p className="text-sm text-slate-600">Save a checkpoint to keep an earlier shared version.</p>}
      <div className="mt-2 flex flex-wrap gap-2">{versions.map((version) => <button key={version.id} type="button" disabled={busy} onClick={() => void openVersion(version)} className="min-h-11 rounded-xl border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:border-indigo-400 focus-visible:outline-2 focus-visible:outline-indigo-600 disabled:opacity-50">{new Date(version.createdAt).toLocaleString()}</button>)}</div>
      {preview && <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="mb-2 text-xs font-bold text-slate-700">Earlier content (read only)</p><p className="max-h-64 overflow-auto whitespace-pre-wrap break-words text-sm text-slate-800">{preview}</p></div>}
    </div>
  </details>;
}
