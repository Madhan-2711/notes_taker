"use client";

import { useMemo, useState } from "react";
import { Archive, ArchiveRestore, Bell, BellOff, Hash, X } from "lucide-react";
import { useNoteMeta } from "../contexts/NoteMetaContext";
import { useNow } from "../hooks/useNow";
import { MAX_TAGS, addTag, toLocalInputValue } from "../lib/noteMeta";

/** Tags, reminder and archive controls for one note; all private to the signed-in user. */
export function NoteOrganizer({ noteId }: { noteId: string }) {
  const { metaByNote, getMeta, updateMeta } = useNoteMeta();
  const meta = getMeta(noteId);
  const now = useNow();
  const [tagInput, setTagInput] = useState("");
  const [reminderInput, setReminderInput] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const knownTags = useMemo(() => {
    const all = new Set<string>();
    metaByNote.forEach((entry) => entry.tags.forEach((tag) => all.add(tag)));
    return [...all].sort();
  }, [metaByNote]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try { await action(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not save. Please retry."); }
    finally { setBusy(false); }
  };

  const submitTag = () => {
    const tags = addTag(meta.tags, tagInput);
    setTagInput("");
    if (tags !== meta.tags) void run(() => updateMeta(noteId, { tags }));
  };

  const setReminder = () => {
    const at = new Date(reminderInput).getTime();
    if (!Number.isFinite(at)) { setError("Choose a date and time for the reminder."); return; }
    if (at <= Date.now()) { setError("Choose a time in the future."); return; }
    if ("Notification" in window && Notification.permission === "default") void Notification.requestPermission();
    void run(async () => { await updateMeta(noteId, { reminderAt: at }); setReminderInput(""); });
  };

  const listId = `known-tags-${noteId}`;

  return (
    <section aria-label="Organise this note" className="mt-8 rounded-2xl border border-slate-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-bold text-slate-800">Organise <span className="font-normal text-slate-500">(only you see these)</span></h3>

      <div className="flex flex-wrap items-center gap-2">
        {meta.tags.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 py-1 pl-3 pr-1 text-xs font-semibold text-indigo-800">
            #{tag}
            <button type="button" disabled={busy} onClick={() => void run(() => updateMeta(noteId, { tags: meta.tags.filter((item) => item !== tag) }))}
              aria-label={`Remove tag ${tag}`} className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-indigo-100 focus-visible:outline-2 focus-visible:outline-indigo-600">
              <X size={13} />
            </button>
          </span>
        ))}
        {meta.tags.length < MAX_TAGS && (
          <form className="flex items-center gap-1" onSubmit={(event) => { event.preventDefault(); submitTag(); }}>
            <label className="sr-only" htmlFor={`tag-${noteId}`}>Add a tag</label>
            <div className="relative">
              <Hash size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden />
              <input id={`tag-${noteId}`} list={listId} value={tagInput} onChange={(event) => setTagInput(event.target.value)} placeholder="Add tag" maxLength={30}
                className="h-11 w-36 rounded-xl border border-slate-300 bg-white pl-7 pr-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200" />
              <datalist id={listId}>{knownTags.filter((tag) => !meta.tags.includes(tag)).map((tag) => <option key={tag} value={tag} />)}</datalist>
            </div>
            <button type="submit" disabled={busy || !tagInput.trim()} className="min-h-11 rounded-xl border border-indigo-300 px-3 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-indigo-600">Add</button>
          </form>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {meta.reminderAt ? (
          <>
            <span className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold ${meta.reminderAt < now ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-900"}`}>
              <Bell size={16} /> Reminder {new Date(meta.reminderAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
            </span>
            <button type="button" disabled={busy} onClick={() => void run(() => updateMeta(noteId, { reminderAt: null }))}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-indigo-600">
              <BellOff size={15} /> Clear
            </button>
          </>
        ) : (
          <form className="flex flex-wrap items-center gap-2" onSubmit={(event) => { event.preventDefault(); setReminder(); }}>
            <label htmlFor={`reminder-${noteId}`} className="flex items-center gap-1.5 text-sm font-semibold text-slate-700"><Bell size={15} /> Remind me</label>
            <input id={`reminder-${noteId}`} type="datetime-local" value={reminderInput} min={toLocalInputValue(now)} onChange={(event) => setReminderInput(event.target.value)}
              className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200" />
            <button type="submit" disabled={busy || !reminderInput} className="min-h-11 rounded-xl border border-amber-300 px-3 text-sm font-semibold text-amber-900 hover:bg-amber-50 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-indigo-600">Set</button>
          </form>
        )}

        <button type="button" disabled={busy} onClick={() => void run(() => updateMeta(noteId, { archived: !meta.archived }))}
          className="ml-auto inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-indigo-600">
          {meta.archived ? <ArchiveRestore size={16} /> : <Archive size={16} />}
          {meta.archived ? "Unarchive" : "Archive"}
        </button>
      </div>
      <p className="mt-2 text-xs text-slate-500">Reminders alert you while Notes Taker is open in a tab or installed as an app.</p>
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    </section>
  );
}
