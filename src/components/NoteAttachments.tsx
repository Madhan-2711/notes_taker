"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Paperclip, RefreshCw, Trash2, Upload, X } from "lucide-react";
import { ATTACHMENT_ACCEPT } from "../lib/attachmentCrypto";
import { attachmentAccess, downloadAttachment, listAttachments, removeAttachment, uploadAttachment, type Attachment } from "../lib/services/attachments";
import { downloadBlob } from "../lib/noteExport";

export function NoteAttachments({ noteId, userId, privateKey }: {
  noteId: string; userId: string; privateKey: CryptoKey;
}) {
  const [files, setFiles] = useState<Attachment[]>([]);
  const [nextPage, setNextPage] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [access, setAccess] = useState<{ key: CryptoKey; owner: boolean; editor: boolean }>();
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const operation = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);
  const refresh = useCallback(async (token?: string) => {
    setLoading(true);
    setError("");
    try {
      const currentAccess = await attachmentAccess(noteId, userId, privateKey);
      const page = await listAttachments(noteId, currentAccess.key, token);
      if (!mounted.current) return;
      setAccess(currentAccess);
      setFiles((previous) => token ? [...previous, ...page.files] : page.files);
      setNextPage(page.nextPage);
    } catch {
      if (mounted.current) setError("Could not load files. Check your connection and note access. If this continues, Firebase Storage may need setup.");
    } finally { if (mounted.current) setLoading(false); }
  }, [noteId, userId, privateKey]);

  useEffect(() => {
    mounted.current = true;
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => { window.clearTimeout(timer); mounted.current = false; controller.current?.abort(); };
  }, [refresh]);

  async function upload(file?: File) {
    if (!file || operation.current || !access?.editor) return;
    operation.current = true;
    setBusy(true); setError(""); setMessage(""); setProgress(0);
    const cancellation = new AbortController();
    controller.current = cancellation;
    try {
      const currentAccess = await attachmentAccess(noteId, userId, privateKey);
      if (!currentAccess.editor) throw new Error("You have read-only access.");
      await uploadAttachment(noteId, userId, currentAccess.key, file, (value) => { if (mounted.current) setProgress(value); }, cancellation.signal);
      if (mounted.current) { setMessage("File encrypted and uploaded."); await refresh(); }
    } catch (caught) {
      if (mounted.current) setError(cancellation.signal.aborted ? "Upload cancelled." : caught instanceof Error ? caught.message : "Upload failed. Please retry.");
    } finally {
      operation.current = false;
      if (mounted.current) { setBusy(false); setProgress(null); }
      if (input.current) input.current.value = "";
    }
  }

  async function action(file: Attachment, deleting: boolean) {
    if (operation.current) return;
    operation.current = true;
    setBusy(true); setError(""); setMessage("");
    try {
      const currentAccess = await attachmentAccess(noteId, userId, privateKey);
      if (deleting) {
        await removeAttachment(file);
        if (mounted.current) { setConfirmDelete(null); setMessage("Attachment deleted."); await refresh(); }
      } else {
        const blob = await downloadAttachment(file, currentAccess.key);
        if (mounted.current) { downloadBlob(blob, file.name); setMessage("Decrypted file ready to download."); }
      }
    } catch { if (mounted.current) setError("Could not complete this action. Check your connection and access, then retry."); }
    finally { operation.current = false; if (mounted.current) setBusy(false); }
  }

  const buttonStyle = "inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-xl border bg-white px-3 text-sm font-semibold hover:border-indigo-400 focus-visible:outline-2 focus-visible:outline-indigo-500 disabled:opacity-50";
  return <section className="my-5 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5" aria-label="Encrypted attachments" aria-busy={busy || loading}>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="flex items-center gap-2 font-bold"><Paperclip size={18} /> Files & images</h3>
        <p className="mt-1 text-xs leading-5 text-slate-600">Encrypted before upload. Up to 10 MB per file.</p></div>
      <button className={buttonStyle} disabled={loading || busy} onClick={() => void refresh()} aria-label="Refresh attachments"><RefreshCw size={16} /></button>
    </div>
    {access?.editor && <div className="mt-4 rounded-xl border-2 border-dashed border-indigo-200 bg-indigo-50/50 p-4 text-center"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => { event.preventDefault(); if (event.dataTransfer.files.length > 1) setError("Please upload one file at a time."); else void upload(event.dataTransfer.files[0]); }}>
      <input ref={input} type="file" className="sr-only" tabIndex={-1} aria-label="Choose attachment" accept={ATTACHMENT_ACCEPT} disabled={busy || loading} onChange={(event) => void upload(event.target.files?.[0])} />
      <button className={buttonStyle} disabled={busy || loading} onClick={() => input.current?.click()}><Upload size={16} /> Choose a file</button>
      <p className="mt-2 text-xs text-slate-600">Or drop an image, PDF, text or Office document here</p>
    </div>}
    {progress !== null && <div className="mt-4 flex items-center gap-3"><progress className="h-2 min-w-0 flex-1 accent-indigo-500" value={progress} max={100} aria-label="Upload progress" /><span className="text-xs">{progress}%</span><button className={buttonStyle} onClick={() => controller.current?.abort()} aria-label="Cancel upload"><X size={16} /></button></div>}
    <div role="status" className="mt-3 text-sm text-slate-600">{loading ? "Loading attachments…" : message || (!files.length && !error ? "No attachments yet." : "")}</div>
    {error && <p role="alert" className="mt-3 break-words rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <ul className="mt-3 space-y-2">{files.map((file) => <li key={file.path} className="rounded-xl border border-slate-100 p-3">
      <div className="flex flex-wrap items-center gap-2"><div className="min-w-0 flex-1 basis-36"><p className="break-all text-sm font-semibold">{file.name}</p><p className="text-xs text-slate-500">{(file.size / 1024).toFixed(0)} KB · encrypted</p></div>
        <button className={buttonStyle} disabled={busy} aria-label={`Download ${file.name}`} onClick={() => void action(file, false)}><Download size={16} /></button>
        {access?.editor && (access.owner || file.uploader === userId) && <button className={buttonStyle} disabled={busy} aria-label={`Delete ${file.name}`} onClick={() => setConfirmDelete(file.path)}><Trash2 size={16} /></button>}
      </div>
      {confirmDelete === file.path && <div className="mt-3 flex flex-wrap items-center gap-2 text-sm"><p>Delete this file for everyone?</p><button className={buttonStyle} disabled={busy} onClick={() => void action(file, true)}>Delete permanently</button><button className={buttonStyle} onClick={() => setConfirmDelete(null)}>Keep file</button></div>}
    </li>)}</ul>
    {nextPage && <button className={`${buttonStyle} mt-3`} disabled={loading || busy} onClick={() => void refresh(nextPage)}>Load more</button>}
    <p className="mt-3 text-xs leading-5 text-slate-500">Downloaded copies are decrypted. Only open documents from people you trust.</p>
  </section>;
}
