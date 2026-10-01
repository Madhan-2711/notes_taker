"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { downloadBlob, exportText, safeFilename } from "../lib/noteExport";
import { buildDocx, deltaToMarkdown, openPrintWindow, prepareExportImages, printRichNote } from "../lib/richExport";
import { deltaFromPlain, type RichDelta } from "../lib/richText";
import { loadAttachmentImage } from "../lib/services/attachments";
import type { NoteImageContext } from "./RichNoteEditor";

type Format = "Word" | "PDF" | "Markdown" | "Text";
const FORMATS: { value: Format; label: string }[] = [
  { value: "Word", label: "Word (.docx)" },
  { value: "PDF", label: "Print / PDF" },
  { value: "Markdown", label: "Markdown" },
  { value: "Text", label: "Text" },
];

export function NoteExport({ title, content, delta, images = null, encrypted = false }: {
  title: string;
  content: string;
  /** Formatted body; plain content is used when absent. */
  delta?: RichDelta | null;
  /** Lets PDF and Word exports include decrypted pictures. */
  images?: NoteImageContext | null;
  encrypted?: boolean;
}) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<Format | null>(null);
  const body = delta ?? deltaFromPlain(content);

  const loadImages = () => prepareExportImages(body, (id) => {
    if (!images) return Promise.reject(new Error("Pictures need the note's access."));
    return loadAttachmentImage(images.noteId, images.userId, images.privateKey, id, "");
  });

  const run = async (format: Format) => {
    setError("");
    let popup: Window | null = null;
    try {
      if (format === "PDF") popup = openPrintWindow();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Export failed. Please try again.");
      return;
    }
    setBusy(format);
    try {
      const name = safeFilename(title);
      if (format === "Text") {
        downloadBlob(new Blob([exportText(title, content, false)], { type: "text/plain;charset=utf-8" }), `${name}.txt`);
      } else if (format === "Markdown") {
        downloadBlob(new Blob([deltaToMarkdown(title, body)], { type: "text/markdown;charset=utf-8" }), `${name}.md`);
      } else if (popup) {
        printRichNote(popup, title, body, await loadImages());
      } else {
        downloadBlob(await buildDocx(title, body, await loadImages()), `${name}.docx`);
      }
    } catch (caught) {
      popup?.close();
      setError(caught instanceof Error ? caught.message : "Export failed. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  return <section className="my-5 rounded-2xl border border-slate-200 bg-slate-50 p-4" aria-label="Export note">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="flex items-center gap-2 text-sm font-bold"><Download size={16} /> Take your words with you</h3>
        <p className="mt-1 text-xs text-slate-600">Word and PDF keep formatting, checklists and pictures. Other attachments download separately.</p></div>
      <div className="flex flex-wrap gap-2">
        {FORMATS.map(({ value, label }) => <button key={value} type="button" disabled={busy !== null}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border bg-white px-4 text-sm font-semibold hover:border-indigo-400 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-indigo-500"
          onClick={() => void run(value)}>{busy === value && <Loader2 size={14} className="animate-spin" />}{label}</button>)}
      </div>
    </div>
    {encrypted && <p className="mt-3 text-xs text-amber-800">Exported copies are decrypted and are no longer protected by your vault.</p>}
    {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
  </section>;
}
