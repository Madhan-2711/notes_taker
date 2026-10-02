"use client";

import { useMemo, useState } from "react";
import { Archive, ArchiveRestore, Bell, BellOff, Hash, Plus, Repeat, X } from "lucide-react";
import { useNoteMeta } from "../contexts/NoteMetaContext";
import { useNow } from "../hooks/useNow";
import { MAX_TAGS, REPEAT_OPTIONS, addTag, toLocalInputValue, type ReminderRepeat } from "../lib/noteMeta";

/** Shared busy/error handling for the private organise controls. */
function useMetaAction() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try { await action(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not save. Please retry."); }
    finally { setBusy(false); }
  };
  return { error, setError, busy, run };
}

/** Tag chips with an inline "add tag" field; tags are private to the signed-in user. */
export function NoteTagEditor({ noteId }: { noteId: string }) {
  const { metaByNote, getMeta, updateMeta } = useNoteMeta();
  const meta = getMeta(noteId);
  const [tagInput, setTagInput] = useState("");
  const [adding, setAdding] = useState(false);
  const { error, busy, run } = useMetaAction();

  const knownTags = useMemo(() => {
    const all = new Set<string>();
    metaByNote.forEach((entry) => entry.tags.forEach((tag) => all.add(tag)));
    return [...all].sort();
  }, [metaByNote]);

  const submitTag = () => {
    const tags = addTag(meta.tags, tagInput);
    setTagInput("");
    setAdding(false);
    if (tags !== meta.tags) void run(() => updateMeta(noteId, { tags }));
  };

  const listId = `known-tags-${noteId}`;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {meta.tags.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-0.5 rounded-full border border-indigo-200 bg-indigo-50 py-0.5 pl-2.5 pr-0.5 text-xs font-semibold text-indigo-800">
            #{tag}
            <button type="button" disabled={busy} onClick={() => void run(() => updateMeta(noteId, { tags: meta.tags.filter((item) => item !== tag) }))}
              aria-label={`Remove tag ${tag}`} className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-indigo-100">
              <X size={13} aria-hidden="true" />
            </button>
          </span>
        ))}
        {meta.tags.length < MAX_TAGS && (adding ? (
          <form className="flex items-center gap-1" onSubmit={(event) => { event.preventDefault(); submitTag(); }}>
            <label className="sr-only" htmlFor={`tag-${noteId}`}>Add a tag</label>
            <div className="relative">
              <Hash size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden="true" />
              <input id={`tag-${noteId}`} list={listId} value={tagInput} autoFocus onChange={(event) => setTagInput(event.target.value)} placeholder="tag name…" maxLength={30} autoComplete="off"
                onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); setAdding(false); setTagInput(""); } }}
                onBlur={() => { if (!tagInput.trim()) setAdding(false); }}
                className="h-9 w-36 rounded-full border border-slate-300 bg-white pl-7 pr-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200" />
              <datalist id={listId}>{knownTags.filter((tag) => !meta.tags.includes(tag)).map((tag) => <option key={tag} value={tag} />)}</datalist>
            </div>
            <button type="submit" disabled={busy || !tagInput.trim()} className="min-h-9 rounded-full px-3 text-sm font-semibold text-indigo-800 hover:bg-indigo-50 disabled:opacity-45">Add</button>
          </form>
        ) : (
          <button type="button" onClick={() => setAdding(true)} className="inline-flex min-h-9 items-center gap-1 rounded-full border border-dashed border-slate-400 px-3 text-xs font-semibold text-slate-700 hover:border-indigo-500 hover:text-indigo-800">
            <Plus size={13} aria-hidden="true" /> {meta.tags.length ? "Tag" : "Add tag"}
          </button>
        ))}
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}

/** Set, repeat or clear a reminder for one note. */
export function NoteReminderControl({ noteId }: { noteId: string }) {
  const { getMeta, updateMeta } = useNoteMeta();
  const meta = getMeta(noteId);
  const now = useNow();
  const [reminderInput, setReminderInput] = useState("");
  const [repeatInput, setRepeatInput] = useState<ReminderRepeat | "">("");
  const { error, setError, busy, run } = useMetaAction();

  const save = (at: number) => {
    if (!Number.isFinite(at)) { setError("Choose a date and time for the reminder."); return; }
    if (at <= Date.now()) { setError("Choose a time in the future."); return; }
    if ("Notification" in window && Notification.permission === "default") void Notification.requestPermission();
    void run(async () => {
      await updateMeta(noteId, { reminderAt: at, repeat: repeatInput || null });
      setReminderInput("");
      setRepeatInput("");
    });
  };

  // One-tap preset: tomorrow at 9 AM local time.
  const tomorrowMorning = () => {
    const date = new Date(now);
    date.setDate(date.getDate() + 1);
    date.setHours(9, 0, 0, 0);
    return date.getTime();
  };

  return (
    <div>
      {meta.reminderAt ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold ${meta.reminderAt < now ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-900"}`}>
            {meta.repeat ? <Repeat size={16} aria-hidden="true" /> : <Bell size={16} aria-hidden="true" />}
            {meta.reminderAt < now ? "Was due" : meta.repeat ? "Next" : "Reminds you"} {new Date(meta.reminderAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
          </span>
          <label className="sr-only" htmlFor={`repeat-change-${noteId}`}>Repeat</label>
          <select
            id={`repeat-change-${noteId}`}
            value={meta.repeat ?? ""}
            disabled={busy}
            onChange={(event) => void run(() => updateMeta(noteId, { repeat: (event.target.value || null) as ReminderRepeat | null }))}
            className="field w-auto cursor-pointer pr-8"
          >
            {REPEAT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <button type="button" disabled={busy} onClick={() => void run(() => updateMeta(noteId, { reminderAt: null }))} className="btn-secondary">
            <BellOff size={15} aria-hidden="true" /> Clear
          </button>
        </div>
      ) : (
        <form className="flex flex-wrap items-end gap-2" onSubmit={(event) => { event.preventDefault(); save(new Date(reminderInput).getTime()); }}>
          <div>
            <label htmlFor={`reminder-${noteId}`} className="label">Remind me on</label>
            <input id={`reminder-${noteId}`} type="datetime-local" value={reminderInput} min={toLocalInputValue(now)} onChange={(event) => setReminderInput(event.target.value)} className="field w-auto" />
          </div>
          <div>
            <label htmlFor={`repeat-${noteId}`} className="label">Repeat</label>
            <select id={`repeat-${noteId}`} value={repeatInput} onChange={(event) => setRepeatInput(event.target.value as ReminderRepeat | "")} className="field w-auto cursor-pointer pr-8">
              {REPEAT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
          <button type="submit" disabled={busy || !reminderInput} className="btn-secondary">Set reminder</button>
          <button type="button" disabled={busy} onClick={() => save(tomorrowMorning())} className="btn-quiet">Tomorrow, 9 AM</button>
        </form>
      )}
      <p className="mt-2 text-xs text-slate-600">
        Reminders alert you while Notes Taker is open. Turn on push notifications in Settings to get them when it&apos;s closed.
      </p>
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}

/** Archive state and toggle for one note. */
export function useNoteArchive(noteId: string) {
  const { getMeta, updateMeta } = useNoteMeta();
  const archived = getMeta(noteId).archived;
  const setArchived = (value: boolean) => updateMeta(noteId, { archived: value });
  return { archived, setArchived, toggle: () => setArchived(!archived) };
}

/** All organise controls together, used beside the shared-note editor. */
export function NoteOrganizer({ noteId }: { noteId: string }) {
  const { archived, toggle } = useNoteArchive(noteId);
  const { error, busy, run } = useMetaAction();
  return (
    <section aria-label="Organise this note" className="space-y-5">
      <div>
        <h3 className="label">Tags</h3>
        <NoteTagEditor noteId={noteId} />
      </div>
      <NoteReminderControl noteId={noteId} />
      <div>
        <button type="button" disabled={busy} onClick={() => void run(toggle)} className="btn-secondary">
          {archived ? <ArchiveRestore size={16} aria-hidden="true" /> : <Archive size={16} aria-hidden="true" />}
          {archived ? "Unarchive" : "Archive"}
        </button>
        {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
      </div>
      <p className="text-xs text-slate-600">Only you see tags, reminders and archive status.</p>
    </section>
  );
}
