"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { downloadBlob, exportText, printNote, safeFilename } from "../lib/noteExport";

export function NoteExport({ title, content, encrypted = false }: {
  title: string; content: string; encrypted?: boolean;
}) {
  const [error, setError] = useState("");
  return <section className="my-5 rounded-2xl border border-slate-200 bg-slate-50 p-4" aria-label="Export note">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h3 className="flex items-center gap-2 text-sm font-bold"><Download size={16} /> Take your words with you</h3>
        <p className="mt-1 text-xs text-slate-600">Text export · attachments and drawings downloaded separately.</p></div>
      <div className="flex flex-wrap gap-2">
        {(["Markdown", "Text", "PDF"] as const).map((format) => <button key={format} type="button"
          className="min-h-11 rounded-xl border bg-white px-4 text-sm font-semibold hover:border-indigo-400 focus-visible:outline-2 focus-visible:outline-indigo-500"
          onClick={() => {
            setError("");
            try {
              if (format === "PDF") printNote(title, content);
              else downloadBlob(new Blob([exportText(title, content, format === "Markdown")], { type: "text/plain;charset=utf-8" }), `${safeFilename(title)}.${format === "Markdown" ? "md" : "txt"}`);
            } catch (caught) { setError(caught instanceof Error ? caught.message : "Export failed. Please try again."); }
          }}>{format === "PDF" ? "Print / PDF" : format}</button>)}
      </div>
    </div>
    {encrypted && <p className="mt-3 text-xs text-amber-800">Exported copies are decrypted and are no longer protected by your vault.</p>}
    {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
  </section>;
}
