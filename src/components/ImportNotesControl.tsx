"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { collection, getDocs, query, where } from "firebase/firestore";
import { AlertTriangle, Check, FileUp, Loader2, X } from "lucide-react";
import { db } from "../lib/firebaseConfig";
import { useUserKeys } from "../hooks/useUserKeys";
import { useNoteMeta } from "../contexts/NoteMetaContext";
import { useToast } from "../contexts/ToastContext";
import { IMPORT_ACCEPT, parseImportFile, type ImportedNote } from "../lib/importNotes";
import { MAX_PLAIN_TEXT, MAX_RICH_JSON, deltaFromPlain, plainFromDelta, serializeDelta } from "../lib/richText";
import { createNormalNote } from "../lib/services/notes/normalNotesService";
import { createSecureNote } from "../lib/services/notes/secureNotesService";
import { createGroup } from "../lib/groupsService";
import { GROUP_COLORS, type Group } from "../lib/validations";
import { Dialog, useDialogTitleId } from "./ui/Dialog";

interface Candidate extends ImportedNote {
  key: string;
  content: string;
  rich: string;
  /** Why the note can't be imported as is, if anything. */
  problem: string | null;
}

/** Plain text and rich JSON within the limits a note accepts; empty notes fall back to their title. */
function toCandidate(note: ImportedNote, index: number): Candidate {
  let delta = note.delta;
  let content = plainFromDelta(delta).trim();
  if (!content) {
    delta = deltaFromPlain(note.title);
    content = note.title;
  }
  const rich = serializeDelta(delta);
  const problem = content.length > MAX_PLAIN_TEXT
    ? `Too long (${content.length.toLocaleString()} characters; notes hold up to ${MAX_PLAIN_TEXT.toLocaleString()})`
    : rich.length > MAX_RICH_JSON ? "Too much formatting to save" : null;
  return { ...note, delta, content, rich, problem, key: `${note.source}:${index}` };
}

/** Bring in notes from a Notes Taker backup, Google Keep (Takeout) or Markdown and text files. */
export function ImportNotesControl({ userId }: { userId: string }) {
  const { publicKey, hasKeys, isReady } = useUserKeys();
  const { updateMeta } = useNoteMeta();
  const toast = useToast();
  const titleId = useDialogTitleId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [asPrivate, setAsPrivate] = useState(false);
  const [keepGroups, setKeepGroups] = useState(true);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState("");
  const vaultReady = isReady && hasKeys && Boolean(publicKey);

  const readFiles = async (files: FileList | File[]) => {
    const list = [...files];
    if (list.length === 0) return;
    const parsed: Candidate[] = [];
    const errors: string[] = [];
    for (const file of list) {
      try {
        const notes = parseImportFile(file.name, await file.text());
        notes.forEach((note) => parsed.push(toCandidate(note, parsed.length)));
      } catch (caught) {
        errors.push(caught instanceof Error ? caught.message : `${file.name} couldn't be read.`);
      }
    }
    setFileErrors(errors);
    setError("");
    setCandidates(parsed);
    setSelected(new Set(parsed.filter((note) => !note.problem).map((note) => note.key)));
    if (inputRef.current) inputRef.current.value = "";
  };

  const close = () => {
    if (progress) return;
    setCandidates(null);
    setFileErrors([]);
    setError("");
  };

  const runImport = async () => {
    if (!candidates) return;
    const chosen = candidates.filter((note) => selected.has(note.key) && !note.problem);
    if (chosen.length === 0) return;
    setError("");
    setProgress({ done: 0, total: chosen.length });
    let imported = 0;
    try {
      // Match group names to existing groups (case-insensitive) and create the missing ones.
      const groupIds = new Map<string, string>();
      if (keepGroups) {
        const names = [...new Set(chosen.flatMap((note) => note.groups))];
        if (names.length) {
          const snapshot = await getDocs(query(collection(db, "groups"), where("authorId", "==", userId)));
          const existing = snapshot.docs.map((item) => ({ id: item.id, ...item.data() })) as Group[];
          for (const [index, name] of names.entries()) {
            const match = existing.find((group) => group.title.toLocaleLowerCase() === name.toLocaleLowerCase());
            groupIds.set(name, match?.id ?? await createGroup(userId, name.slice(0, 50), GROUP_COLORS[index % GROUP_COLORS.length].value));
          }
        }
      }
      for (const note of chosen) {
        const ids = keepGroups ? note.groups.map((name) => groupIds.get(name)).filter((id): id is string => Boolean(id)) : [];
        const id = asPrivate && vaultReady && publicKey
          ? await createSecureNote(userId, note.title, note.content, ids, publicKey, note.rich)
          : await createNormalNote(userId, note.title, note.content, ids, note.rich);
        if (note.tags.length || note.archived) await updateMeta(id, { tags: note.tags, archived: note.archived });
        imported += 1;
        setProgress({ done: imported, total: chosen.length });
      }
      setCandidates(null);
      toast({ message: `Imported ${imported} ${imported === 1 ? "note" : "notes"}` });
    } catch (caught) {
      const reason = caught instanceof Error ? caught.message : "Something went wrong.";
      setError(`Imported ${imported} of ${chosen.length}. ${reason} The rest weren't imported; you can try again.`);
    } finally {
      setProgress(null);
    }
  };

  const importable = candidates?.filter((note) => !note.problem) ?? [];
  const chosenCount = importable.filter((note) => selected.has(note.key)).length;
  const allChosen = importable.length > 0 && chosenCount === importable.length;
  const hasGroups = Boolean(candidates?.some((note) => note.groups.length));

  return (
    <div>
      <div
        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => { event.preventDefault(); setDragging(false); void readFiles(event.dataTransfer.files); }}
        className={`flex flex-col items-center gap-3 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors ${dragging ? "border-indigo-600 bg-indigo-50" : "border-slate-300"}`}
      >
        <FileUp size={22} className="text-indigo-700" aria-hidden="true" />
        <p className="text-sm text-slate-700">Drop files here, or</p>
        <input ref={inputRef} type="file" multiple accept={IMPORT_ACCEPT} className="sr-only" tabIndex={-1} aria-label="Choose files to import" onChange={(event) => event.target.files && void readFiles(event.target.files)} />
        <button type="button" onClick={() => inputRef.current?.click()} className="btn-secondary">Choose files</button>
      </div>
      <ul className="mt-3 space-y-1 text-xs text-slate-600">
        <li><strong className="font-semibold text-slate-800">Notes Taker backups</strong>: the .md or .json file from &ldquo;Back up your notes&rdquo;.</li>
        <li><strong className="font-semibold text-slate-800">Google Keep</strong>: unzip your Google Takeout download and choose the .json files in its Keep folder.</li>
        <li><strong className="font-semibold text-slate-800">Markdown and text</strong>: .md and .txt files, one note each.</li>
      </ul>

      <Dialog open={candidates !== null} onClose={close} labelledBy={titleId} size="lg" sheetOnMobile>
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-3 sm:px-6">
          <h2 id={titleId} className="text-lg font-bold tracking-tight">Import notes</h2>
          <button type="button" onClick={close} disabled={Boolean(progress)} className="icon-btn -mr-2" aria-label="Close"><X size={20} aria-hidden="true" /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
          {fileErrors.length > 0 && (
            <div role="alert" className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="flex items-center gap-2 font-semibold"><AlertTriangle size={16} aria-hidden="true" /> Some files were skipped</p>
              <ul className="mt-1 list-disc pl-5">{fileErrors.map((message) => <li key={message}>{message}</li>)}</ul>
            </div>
          )}
          {candidates && candidates.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-600">No notes found in those files.</p>
          ) : (
            <>
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-800">{chosenCount} of {candidates?.length ?? 0} selected</p>
                <button type="button" onClick={() => setSelected(allChosen ? new Set() : new Set(importable.map((note) => note.key)))} className="btn-quiet min-h-10 px-3">
                  {allChosen ? "Select none" : "Select all"}
                </button>
              </div>
              <ul className="divide-y divide-slate-200 rounded-xl border border-slate-200">
                {candidates?.map((note) => {
                  const checked = selected.has(note.key);
                  const preview = note.content.replace(/\s+/g, " ").slice(0, 120);
                  return (
                    <li key={note.key}>
                      <label className={`flex gap-3 px-3 py-2.5 ${note.problem ? "cursor-not-allowed opacity-70" : "cursor-pointer hover:bg-slate-50"}`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={Boolean(note.problem) || Boolean(progress)}
                          onChange={() => setSelected((current) => {
                            const next = new Set(current);
                            if (next.has(note.key)) next.delete(note.key); else next.add(note.key);
                            return next;
                          })}
                          className="mt-1 h-4 w-4 shrink-0 accent-indigo-700"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-slate-900">{note.title}</span>
                          <span className="block truncate text-xs text-slate-600">{preview}</span>
                          <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                            {note.archived && <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">Archived</span>}
                            {note.groups.map((group) => <span key={group} className="rounded-full border border-slate-200 px-2 py-0.5 font-semibold text-slate-700">{group}</span>)}
                            {note.tags.map((tag) => <span key={tag} className="rounded-full bg-indigo-50 px-2 py-0.5 font-semibold text-indigo-800">#{tag}</span>)}
                            {note.problem && <span className="font-semibold text-red-700">{note.problem}</span>}
                          </span>
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>

              <fieldset className="mt-5" disabled={Boolean(progress)}>
                <legend className="label">Save as</legend>
                <div className="flex flex-wrap gap-2" role="radiogroup">
                  <button type="button" role="radio" aria-checked={!asPrivate} onClick={() => setAsPrivate(false)} className={`chip min-h-10 ${!asPrivate ? "border-indigo-700 bg-indigo-50 text-indigo-900" : "border-slate-300 bg-white text-slate-800"}`}>
                    {!asPrivate && <Check size={13} aria-hidden="true" />} Regular notes
                  </button>
                  <button type="button" role="radio" aria-checked={asPrivate} disabled={!vaultReady} onClick={() => setAsPrivate(true)} className={`chip min-h-10 disabled:opacity-50 ${asPrivate ? "border-indigo-700 bg-indigo-50 text-indigo-900" : "border-slate-300 bg-white text-slate-800"}`}>
                    {asPrivate && <Check size={13} aria-hidden="true" />} Private (encrypted)
                  </button>
                </div>
                {!vaultReady && <p className="mt-1.5 text-xs text-slate-600">Unlock your vault to import as private notes.</p>}
              </fieldset>
              {hasGroups && (
                <label className="mt-4 flex items-center gap-2 text-sm text-slate-800">
                  <input type="checkbox" checked={keepGroups} disabled={Boolean(progress)} onChange={(event) => setKeepGroups(event.target.checked)} className="h-4 w-4 accent-indigo-700" />
                  Put notes back in their groups (missing groups are created)
                </label>
              )}
              <p className="mt-3 text-xs text-slate-600">Imported notes are dated today. Attachments aren&apos;t included in backups, so they can&apos;t be imported.</p>
            </>
          )}
        </div>

        <div className="flex shrink-0 flex-col gap-2 border-t border-slate-200 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="min-w-0 flex-1 text-sm" aria-live="polite">
            {progress && <span className="font-medium text-indigo-800">Importing {progress.done + 1 > progress.total ? progress.total : progress.done + 1} of {progress.total}…</span>}
            {error && <span role="alert" className="text-red-700">{error} <Link href="/notes" className="font-semibold underline">Open notes</Link></span>}
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={close} disabled={Boolean(progress)} className="btn-quiet">Cancel</button>
            <button type="button" onClick={() => void runImport()} disabled={chosenCount === 0 || Boolean(progress)} className="btn-primary">
              {progress ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <FileUp size={16} aria-hidden="true" />}
              Import {chosenCount > 0 ? chosenCount : ""} {chosenCount === 1 ? "note" : "notes"}
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
