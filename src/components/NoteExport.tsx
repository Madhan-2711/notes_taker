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

  return <section aria-label="Export note">
    <p className="text-sm text-slate-700">Word and PDF keep formatting, checklists and pictures. Other attachments download separately.</p>
    <div className="mt-3 flex flex-wrap gap-2">
      {FORMATS.map(({ value, label }) => <button key={value} type="button" disabled={busy !== null} className="btn-secondary" onClick={() => void run(value)}>
        {busy === value ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Download size={15} aria-hidden="true" />}{label}
      </button>)}
    </div>
    {encrypted && <p className="mt-3 text-xs text-amber-900">Exported copies are decrypted and are no longer protected by your vault.</p>}
    {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
  </section>;
}
