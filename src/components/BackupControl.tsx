"use client";

import { useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { Download, Loader2 } from "lucide-react";
import { db } from "../lib/firebaseConfig";
import { downloadBlob } from "../lib/noteExport";
import { useNoteMeta } from "../contexts/NoteMetaContext";
import type { Group, Note } from "../lib/validations";

/** One-off read of every note the user can see: their own plus notes shared with them. */
async function fetchAllNotes(userId: string): Promise<Note[]> {
  const [own, shared] = await Promise.all([
    getDocs(query(collection(db, "notes"), where("authorId", "==", userId))),
    getDocs(query(collection(db, "notes"), where("collaboratorIds", "array-contains", userId))),
  ]);
  const byId = new Map<string, Note>();
  [...own.docs, ...shared.docs].forEach((item) => byId.set(item.id, { id: item.id, ...item.data() } as Note));
  return [...byId.values()];
}

/** Exports every note as one decrypted Markdown or JSON file. */
export function BackupControl({ userId, privateKey }: { userId: string; privateKey: CryptoKey | null }) {
  const { metaByNote } = useNoteMeta();
  const [busy, setBusy] = useState<"md" | "json" | null>(null);
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState("");
  const [error, setError] = useState("");

  const run = async (format: "md" | "json") => {
    setBusy(format);
    setError("");
    setResult("");
    setProgress("Gathering notes…");
    try {
      const [notes, groupSnap] = await Promise.all([
        fetchAllNotes(userId),
        getDocs(query(collection(db, "groups"), where("authorId", "==", userId))),
      ]);
      // Decrypting shared notes needs Yjs, so the backup code loads on demand.
      const { backupToJson, backupToMarkdown, buildBackup } = await import("../lib/backup");
      const groups = groupSnap.docs.map((item) => ({ id: item.id, ...item.data() })) as Group[];
      const backup = await buildBackup(notes, userId, privateKey, groups, metaByNote, (done, total) => setProgress(`Preparing ${done} of ${total}…`));
      const now = new Date();
      const stamp = now.toISOString().slice(0, 10);
      if (format === "md") downloadBlob(new Blob([backupToMarkdown(backup, now)], { type: "text/markdown;charset=utf-8" }), `notes-taker-backup-${stamp}.md`);
      else downloadBlob(new Blob([backupToJson(backup, now)], { type: "application/json;charset=utf-8" }), `notes-taker-backup-${stamp}.json`);
      const included = backup.entries.length - backup.skipped;
      setResult(`Exported ${included} ${included === 1 ? "note" : "notes"}.${backup.skipped ? ` ${backup.skipped} encrypted ${backup.skipped === 1 ? "note was" : "notes were"} left out because the vault is locked.` : ""}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The backup couldn't be created. Check your connection and try again.");
    } finally {
      setBusy(null);
      setProgress("");
    }
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy !== null} onClick={() => void run("md")} className="btn-secondary">
          {busy === "md" ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Download size={16} aria-hidden="true" />} Download as Markdown
        </button>
        <button type="button" disabled={busy !== null} onClick={() => void run("json")} className="btn-secondary">
          {busy === "json" ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Download size={16} aria-hidden="true" />} Download as JSON
        </button>
      </div>
      <div aria-live="polite" className="mt-3 text-sm">
        {progress && <p className="text-slate-700">{progress}</p>}
        {result && <p className="text-emerald-800">{result}</p>}
        {error && <p role="alert" className="text-red-700">{error}</p>}
      </div>
      <p className="mt-3 text-xs text-slate-600">
        Includes every note outside the trash, with groups and tags. Private and shared notes are decrypted into the file, so keep it somewhere safe. Attachments download separately from each note.
      </p>
    </div>
  );
}
