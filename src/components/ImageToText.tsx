"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Check, Copy, ImageUp, Loader2, RotateCcw, ScanText, X } from "lucide-react";
import { recognizeText, type OcrProgress } from "../lib/ocr";
import { Dialog, useDialogTitleId } from "./ui/Dialog";

type Phase = { name: "pick" } | { name: "working"; progress: OcrProgress } | { name: "done"; text: string } | { name: "error"; message: string };

/**
 * "Text from image": pick or snap a photo, read its text on this device, review it, then
 * insert it into the note. Also accepts a pasted or dropped image.
 */
export function ImageToText({ onInsert, triggerClassName = "btn-quiet min-h-10 px-3", compact = false }: {
  onInsert: (text: string) => void;
  triggerClassName?: string;
  /** Icon-only trigger on small screens. */
  compact?: boolean;
}) {
  const titleId = useDialogTitleId();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>({ name: "pick" });
  const [preview, setPreview] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const pickRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const reset = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setPhase({ name: "pick" });
    setCopied(false);
  };

  const close = () => { reset(); setOpen(false); };

  const read = async (file: File | Blob | null | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setPhase({ name: "error", message: "Choose an image file, such as a photo or screenshot." }); return; }
    reset();
    setPreview(URL.createObjectURL(file));
    const controller = new AbortController();
    abortRef.current = controller;
    setPhase({ name: "working", progress: { stage: "loading", progress: 0 } });
    try {
      const text = await recognizeText(file, (progress) => setPhase({ name: "working", progress }), controller.signal);
      if (controller.signal.aborted) return;
      setPhase(text ? { name: "done", text } : { name: "error", message: "No text found. Try a sharper, well-lit photo with the text filling more of the frame." });
    } catch {
      if (!controller.signal.aborted) setPhase({ name: "error", message: "The text reader couldn't start. Check your connection the first time you use it, then try again." });
    }
  };

  // Paste an image while the dialog is open.
  useEffect(() => {
    if (!open) return;
    const onPaste = (event: ClipboardEvent) => {
      const file = [...(event.clipboardData?.files ?? [])].find((item) => item.type.startsWith("image/"));
      if (file) { event.preventDefault(); void read(file); }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
    // read only depends on refs and setters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const working = phase.name === "working";
  const percent = working ? Math.round(phase.progress.progress * 100) : 0;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={triggerClassName} aria-label="Text from image">
        <ScanText size={16} aria-hidden="true" />
        <span className={compact ? "hidden sm:inline" : ""}>Text from image</span>
      </button>

      <Dialog open={open} onClose={close} labelledBy={titleId} size="lg" sheetOnMobile>
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-3 sm:px-6">
          <h2 id={titleId} className="text-lg font-bold tracking-tight">Text from image</h2>
          <button type="button" onClick={close} className="icon-btn -mr-2" aria-label="Close"><X size={20} aria-hidden="true" /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <input ref={pickRef} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-label="Choose an image" onChange={(event) => { void read(event.target.files?.[0]); event.target.value = ""; }} />
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-label="Take a photo" onChange={(event) => { void read(event.target.files?.[0]); event.target.value = ""; }} />

          {phase.name === "pick" && (
            <div
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => { event.preventDefault(); void read(event.dataTransfer.files[0]); }}
              className="flex flex-col items-center gap-4 rounded-xl border-2 border-dashed border-slate-300 px-4 py-10 text-center"
            >
              <ScanText size={28} className="text-indigo-700" aria-hidden="true" />
              <div>
                <p className="font-semibold text-slate-900">Turn a photo into editable text</p>
                <p className="mt-1 max-w-sm text-sm text-slate-600">Whiteboards, receipts, printed pages and screenshots work best. You can also paste or drop an image here.</p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                <button type="button" onClick={() => cameraRef.current?.click()} className="btn-primary sm:hidden" data-autofocus>
                  <Camera size={16} aria-hidden="true" /> Take photo
                </button>
                <button type="button" onClick={() => pickRef.current?.click()} className="btn-secondary">
                  <ImageUp size={16} aria-hidden="true" /> Choose image
                </button>
              </div>
            </div>
          )}

          {phase.name !== "pick" && (
            <div className="grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)]">
              {preview && (
                // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
                <img src={preview} alt="The image being read" className="max-h-48 w-full rounded-xl border border-slate-200 object-contain sm:max-h-64" />
              )}
              <div className="min-w-0">
                {working && (
                  <div role="status" aria-live="polite">
                    <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                      <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                      {phase.progress.stage === "loading" ? "Getting the text reader ready…" : `Reading text… ${percent}%`}
                    </p>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200" aria-hidden="true">
                      <div className="h-full rounded-full bg-primary-strong transition-[width] duration-300" style={{ width: `${phase.progress.stage === "loading" ? 8 : Math.max(8, percent)}%` }} />
                    </div>
                    <p className="mt-2 text-xs text-slate-600">The first time, about 7 MB downloads from this site. The image stays on your device.</p>
                  </div>
                )}
                {phase.name === "done" && (
                  <>
                    <label htmlFor="ocr-result" className="label">Recognised text <span className="font-normal text-slate-600">(edit before inserting)</span></label>
                    <textarea
                      id="ocr-result"
                      value={phase.text}
                      onChange={(event) => setPhase({ name: "done", text: event.target.value })}
                      rows={10}
                      className="field h-auto min-h-48 resize-y py-2 leading-6"
                    />
                  </>
                )}
                {phase.name === "error" && <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{phase.message}</p>}
              </div>
            </div>
          )}
        </div>

        {phase.name !== "pick" && (
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
            <button type="button" onClick={reset} className="btn-quiet">
              <RotateCcw size={15} aria-hidden="true" /> {working ? "Cancel" : "Another image"}
            </button>
            {phase.name === "done" && (
              <div className="flex gap-2">
                <button type="button" onClick={() => void navigator.clipboard?.writeText(phase.text).then(() => setCopied(true))} className="btn-secondary">
                  {copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />} {copied ? "Copied" : "Copy"}
                </button>
                <button type="button" onClick={() => { onInsert(phase.text); close(); }} disabled={!phase.text.trim()} className="btn-primary">
                  Insert into note
                </button>
              </div>
            )}
          </div>
        )}
      </Dialog>
    </>
  );
}
