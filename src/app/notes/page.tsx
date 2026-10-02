"use client";

import { Suspense, useState, useEffect, useMemo, useRef } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useUserKeys } from "../../hooks/useUserKeys";
import { hasValidConfig } from "../../lib/firebaseConfig";
import { db } from "../../lib/firebaseConfig";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { type Note, type Group, type NoteMode, isCollabNote } from "../../lib/validations";
import {
  subscribeToNotes,
  updateNormalNote,
  moveNoteToTrash,
  restoreNote,
} from "../../lib/services/notes/normalNotesService";
import { addNotesToGroup } from "../../lib/groupsService";
import { NoteCard } from "../../components/NoteCard";
import { EditNoteModal } from "../../components/EditNoteModal";
import { ViewNoteModal } from "../../components/ViewNoteModal";
import { PageHeader } from "../../components/PageHeader";
import { CardSkeletons, EmptyState, PageLoading, SignInRequired } from "../../components/PageState";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import { Menu } from "../../components/ui/Menu";
import { AnimatePresence, motion } from "framer-motion";
import {
  Calendar, X, Search, SlidersHorizontal, RotateCcw, Trash2, Pin, Archive, ArchiveRestore, Bell, NotebookText, Plus, Lock,
  ChevronDown, Layers, LayoutGrid, List, CheckSquare, FolderPlus, Check,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { buildSearchIndex } from "../../lib/noteSearch";
import { useNotePins } from "../../hooks/useNotePins";
import { useNoteTitle } from "../../hooks/useNoteTitle";
import { useNow } from "../../hooks/useNow";
import { useNoteTitles } from "../../hooks/useNoteTitles";
import { useTrashWithUndo } from "../../hooks/useTrashWithUndo";
import { useProgressiveCount } from "../../hooks/useProgressiveCount";
import { useNoteMeta } from "../../contexts/NoteMetaContext";
import { useToast } from "../../contexts/ToastContext";
import { EMPTY_META, normalizeTag } from "../../lib/noteMeta";
import { NOTE_MODES } from "../../lib/noteModes";
import { NOTE_SORTS, readViewPreferences, saveViewPreferences, sectionNotes, sortNotes, type NoteLayout, type NoteSort } from "../../lib/noteSort";
import { TRASH_RETENTION_DAYS, autoEmptyTrashEnabled, deleteNotesForever, expiredTrash } from "../../lib/trash";

type NotesView = "active" | "archived" | "reminders";

/** Notes rendered per chunk; more load as the user scrolls. */
const PAGE_SIZE = 60;

function localDateKey(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

const MODE_FILTERS: { value: NoteMode | ""; label: string; icon: typeof Lock }[] = [
  { value: "", label: "All types", icon: Layers },
  ...NOTE_MODES.map(({ value, label, icon }) => ({ value, label, icon })),
];

const chipClass = (active: boolean) =>
  `chip ${active ? "border-indigo-700 bg-indigo-700 text-white" : "border-slate-300 bg-white text-slate-800 hover:border-indigo-500 hover:text-indigo-800"}`;

function TrashCard({ note, autoEmpty, selecting, selected, onToggleSelect, onRestore, onDeleteForever }: {
  note: Note; autoEmpty: boolean; selecting: boolean; selected: boolean; onToggleSelect: () => void; onRestore: () => void; onDeleteForever: () => void;
}) {
  const title = useNoteTitle(note);
  const now = useNow();
  const daysLeft = Math.max(0, TRASH_RETENTION_DAYS - Math.floor((now - (note.deletedAt ?? now)) / 86_400_000));
  return (
    <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className={`panel relative flex flex-col p-5 ${selected ? "ring-4 ring-indigo-300" : ""}`}>
      {selecting && (
        <button type="button" onClick={onToggleSelect} aria-pressed={selected} aria-label={`${selected ? "Deselect" : "Select"} ${title}`} className="absolute inset-0 z-10 rounded-card" />
      )}
      <div className="flex items-start gap-2">
        {selecting && (
          <span aria-hidden="true" className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 ${selected ? "border-indigo-700 bg-indigo-700 text-white" : "border-slate-400 bg-white"}`}>
            {selected && <Check size={15} strokeWidth={3} />}
          </span>
        )}
        <div className="min-w-0">
          <h4 className="truncate text-base font-bold text-slate-900">{title}</h4>
          <p className="mt-1 text-sm text-slate-600">
            Deleted {new Date(note.deletedAt!).toLocaleDateString()}
            {autoEmpty && `, removed in ${daysLeft} ${daysLeft === 1 ? "day" : "days"}`}
          </p>
        </div>
      </div>
      {!selecting && (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
          <button type="button" onClick={onRestore} className="btn-secondary">
            <RotateCcw size={16} aria-hidden="true" /> Restore
          </button>
          <button type="button" onClick={onDeleteForever} className="btn min-h-11 px-3 text-red-700 hover:bg-red-50">
            Delete forever
          </button>
        </div>
      )}
    </motion.div>
  );
}

export default function NotesPage() {
  return (
    <Suspense fallback={<PageLoading label="Loading notes" />}>
      <NotesPageContent />
    </Suspense>
  );
}

function NotesPageContent() {
  const router = useRouter();
  const linkedNoteId = useSearchParams().get("open");
  const { user, loading } = useAuth();
  const { privateKey } = useUserKeys();
  const { pinnedIds, toggle: togglePin } = useNotePins(user?.uid);
  const { metaByNote, updateMeta } = useNoteMeta();
  const toast = useToast();
  const trashNote = useTrashWithUndo();
  const [view, setView] = useState<NotesView>("active");
  const [tagFilter, setTagFilter] = useState("");
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [dateFilter, setDateFilter] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [modeFilter, setModeFilter] = useState<NoteMode | "">("");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchIndex, setSearchIndex] = useState<Map<string, string>>(new Map());
  const [searching, setSearching] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [preferences, setPreferences] = useState<{ sort: NoteSort; layout: NoteLayout }>({ sort: "updated", layout: "grid" });
  const [autoEmpty, setAutoEmpty] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Note[] | null>(null);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [viewingNote, setViewingNote] = useState<Note | null>(null);
  const [dismissedLinkedId, setDismissedLinkedId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const purgeChecked = useRef(false);
  const allNotes = useMemo(() => notes ?? [], [notes]);
  const titleOf = useNoteTitles(allNotes);
  const linkedNote = linkedNoteId && dismissedLinkedId !== linkedNoteId
    ? allNotes.find((note) => note.id === linkedNoteId && !isCollabNote(note)) ?? null
    : null;
  const activeViewNote = viewingNote ?? linkedNote;

  const clearLinkedNote = () => {
    if (!linkedNoteId) return;
    setDismissedLinkedId(linkedNoteId);
    router.replace("/notes", { scroll: false });
  };

  // Sort and layout are remembered per device.
  useEffect(() => {
    const timer = window.setTimeout(() => { setPreferences(readViewPreferences()); setAutoEmpty(autoEmptyTrashEnabled()); }, 0);
    return () => window.clearTimeout(timer);
  }, []);
  const updatePreferences = (changes: Partial<typeof preferences>) => {
    setPreferences((previous) => {
      const next = { ...previous, ...changes };
      saveViewPreferences(next);
      return next;
    });
  };

  // Subscribe to notes via service
  useEffect(() => {
    if (!user || !hasValidConfig) return;
    const unsub = subscribeToNotes(user.uid, (data) => setNotes(data), true);
    return () => unsub();
  }, [user]);

  // Subscribe to groups
  useEffect(() => {
    if (!user || !hasValidConfig) return;
    const q = query(collection(db, "groups"), where("authorId", "==", user.uid));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Group[];
      data.sort((a, b) => a.title.localeCompare(b.title));
      setGroups(data);
    });
    return () => unsub();
  }, [user]);

  // Opt-in: notes that have sat in trash past the retention period are removed once per visit.
  useEffect(() => {
    if (!user || notes === null || purgeChecked.current) return;
    purgeChecked.current = true;
    if (!autoEmptyTrashEnabled()) return;
    const expired = expiredTrash(notes, user.uid, Date.now());
    if (expired.length === 0) return;
    void deleteNotesForever(expired)
      .then((removed) => toast({ message: `Removed ${removed} ${removed === 1 ? "note" : "notes"} that were in trash for ${TRASH_RETENTION_DAYS} days` }))
      .catch(() => toast({ message: "Couldn't clear old notes from trash. They'll be retried next time.", tone: "error" }));
  }, [notes, user, toast]);

  // "/" jumps to search from anywhere on the page, unless the user is typing somewhere.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && selecting && !document.querySelector("[role=dialog], [role=menu]")) {
        setSelecting(false);
        setSelectedIds(new Set());
        return;
      }
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement;
      if (target.closest("input, textarea, select, [contenteditable=true], [role=dialog]")) return;
      event.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selecting]);

  const handleUpdateNote = async (id: string, title: string, content: string, richContent: string) => {
    if (!user || !hasValidConfig) return;
    await updateNormalNote(id, title, content, richContent);
  };

  const searchActive = searchTerm.trim().length > 0;
  useEffect(() => {
    if (!searchActive || !user) return;
    let active = true;
    const timer = window.setTimeout(() => {
      setSearching(true);
      buildSearchIndex(allNotes, user.uid, privateKey).then((index) => {
        if (active) setSearchIndex(index);
      }).finally(() => { if (active) setSearching(false); });
    }, 200);
    return () => { active = false; window.clearTimeout(timer); };
  }, [searchActive, allNotes, user, privateKey]);

  // Filter notes by view, date, group, type, tag and search
  const filteredNotes = useMemo(() => {
    const term = searchTerm.trim().toLocaleLowerCase();
    const matchingGroupIds = term ? new Set(groups.filter((group) => group.title.toLocaleLowerCase().includes(term)).map((group) => group.id)) : new Set<string>();
    const tagTerm = normalizeTag(term);
    return allNotes.filter((note) => {
      if (showTrash ? (!note.deletedAt || note.authorId !== user?.uid) : Boolean(note.deletedAt)) return false;
      const meta = metaByNote.get(note.id) ?? EMPTY_META;
      if (!showTrash) {
        if (view === "active" && meta.archived) return false;
        if (view === "archived" && !meta.archived) return false;
        if (view === "reminders" && meta.reminderAt === null) return false;
      }
      if (tagFilter && !meta.tags.includes(tagFilter)) return false;
      const matchesDate = !dateFilter
        ? true
        : localDateKey(note.createdAt) === dateFilter;
      const matchesGroup = !groupFilter
        ? true
        : note.groupIds?.includes(groupFilter);
      const matchesMode = !modeFilter
        ? true
        : (note.mode || "normal") === modeFilter;
      const matchesSearch = !term || searchIndex.get(note.id)?.includes(term) || note.groupIds?.some((id) => matchingGroupIds.has(id))
        || (tagTerm !== "" && meta.tags.some((tag) => tag.includes(tagTerm)));
      return matchesDate && matchesGroup && matchesMode && matchesSearch;
    });
  }, [allNotes, groups, dateFilter, groupFilter, modeFilter, searchTerm, searchIndex, showTrash, user?.uid, metaByNote, view, tagFilter]);

  // Trash is always newest-deleted first; other views follow the chosen sort.
  const sortedNotes = useMemo(
    () => showTrash
      ? [...filteredNotes].sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0))
      : sortNotes(filteredNotes, preferences.sort, titleOf),
    [filteredNotes, showTrash, preferences.sort, titleOf]
  );
  const pinnedVisible = useMemo(() => showTrash ? [] : sortedNotes.filter((note) => pinnedIds.has(note.id)), [sortedNotes, pinnedIds, showTrash]);
  const restNotes = useMemo(() => showTrash ? sortedNotes : sortedNotes.filter((note) => !pinnedIds.has(note.id)), [sortedNotes, pinnedIds, showTrash]);

  const resetKey = [view, showTrash, searchTerm, dateFilter, groupFilter, modeFilter, tagFilter, preferences.sort].join("|");
  const { visible, hasMore, showMore, sentinelRef } = useProgressiveCount(restNotes.length, PAGE_SIZE, resetKey);
  const sections = useMemo(
    () => sectionNotes(restNotes.slice(0, visible), showTrash ? "created" : preferences.sort, titleOf),
    [restNotes, visible, showTrash, preferences.sort, titleOf]
  );

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    metaByNote.forEach((meta) => meta.tags.forEach((tag) => tags.add(tag)));
    return [...tags].sort();
  }, [metaByNote]);

  const viewCounts = useMemo(() => {
    const live = allNotes.filter((note) => !note.deletedAt);
    return {
      archived: live.filter((note) => metaByNote.get(note.id)?.archived).length,
      reminders: live.filter((note) => metaByNote.get(note.id)?.reminderAt != null).length,
      trash: allNotes.filter((note) => note.deletedAt && note.authorId === user?.uid).length,
    };
  }, [allNotes, metaByNote, user?.uid]);

  const cardMeta = (noteId: string) => {
    const meta = metaByNote.get(noteId) ?? EMPTY_META;
    return { tags: meta.tags, reminderAt: meta.reminderAt };
  };

  if (loading) return <PageLoading label="Loading notes" />;
  if (!user) return <SignInRequired>Sign in to view your notes.</SignInRequired>;

  const activeFilters = [
    modeFilter && { key: "mode", label: NOTE_MODES.find((mode) => mode.value === modeFilter)?.label ?? modeFilter, clear: () => setModeFilter("") },
    dateFilter && { key: "date", label: new Date(`${dateFilter}T00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }), clear: () => setDateFilter("") },
    groupFilter && { key: "group", label: groups.find((group) => group.id === groupFilter)?.title ?? "Group", clear: () => setGroupFilter("") },
    tagFilter && { key: "tag", label: `#${tagFilter}`, clear: () => setTagFilter("") },
  ].filter(Boolean) as { key: string; label: string; clear: () => void }[];
  const clearAllFilters = () => { setModeFilter(""); setDateFilter(""); setGroupFilter(""); setTagFilter(""); };

  const tabs = [
    { key: "active", label: "Notes", icon: NotebookText, count: null },
    { key: "reminders", label: "Reminders", icon: Bell, count: viewCounts.reminders },
    { key: "archived", label: "Archived", icon: Archive, count: viewCounts.archived },
  ] as const;
  const currentTab = showTrash ? "trash" : view;
  const layout = showTrash ? "grid" : preferences.layout;

  // ── Selection ───────────────────────────────────────────────────────────────
  const exitSelection = () => { setSelecting(false); setSelectedIds(new Set()); };
  const switchView = (next: () => void) => { exitSelection(); next(); };
  const toggleSelected = (id: string) => setSelectedIds((previous) => {
    const next = new Set(previous);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const selectableNotes = sortedNotes;
  const allSelected = selectableNotes.length > 0 && selectableNotes.every((note) => selectedIds.has(note.id));
  const selectedNotes = selectableNotes.filter((note) => selectedIds.has(note.id));
  const ownedSelected = selectedNotes.filter((note) => note.authorId === user.uid);
  const plural = (count: number) => `${count} ${count === 1 ? "note" : "notes"}`;

  const runBulk = async (action: () => Promise<void>) => {
    setBulkBusy(true);
    try {
      await action();
      exitSelection();
    } catch (caught) {
      toast({ message: caught instanceof Error ? caught.message : "Some notes couldn't be updated. Please try again.", tone: "error" });
    } finally {
      setBulkBusy(false);
    }
  };

  const bulkArchive = (archived: boolean) => runBulk(async () => {
    const changed = selectedNotes.map((note) => ({ id: note.id, previous: (metaByNote.get(note.id) ?? EMPTY_META).archived }));
    for (const { id } of changed) await updateMeta(id, { archived });
    toast({
      message: `${archived ? "Archived" : "Moved back"} ${plural(changed.length)}`,
      actionLabel: "Undo",
      onAction: async () => { for (const { id, previous } of changed) await updateMeta(id, { archived: previous }); },
    });
  });

  const bulkTrash = () => runBulk(async () => {
    const ids = ownedSelected.map((note) => note.id);
    for (const id of ids) await moveNoteToTrash(id);
    const skipped = selectedNotes.length - ids.length;
    toast({
      message: `Moved ${plural(ids.length)} to trash${skipped ? `. ${skipped} shared with you ${skipped === 1 ? "was" : "were"} skipped` : ""}`,
      actionLabel: "Undo",
      onAction: async () => { for (const id of ids) await restoreNote(id); },
    });
  });

  const bulkAddToGroup = (group: Group) => runBulk(async () => {
    const ids = ownedSelected.map((note) => note.id);
    await addNotesToGroup(group.id, ids);
    const skipped = selectedNotes.length - ids.length;
    toast({ message: `Added ${plural(ids.length)} to ${group.title}${skipped ? `. ${skipped} shared with you ${skipped === 1 ? "was" : "were"} skipped` : ""}` });
  });

  const bulkRestore = () => runBulk(async () => {
    for (const note of selectedNotes) await restoreNote(note.id);
    toast({ message: `Restored ${plural(selectedNotes.length)}` });
  });

  const confirmPermanentDelete = async () => {
    if (!confirmDelete) return;
    const targets = confirmDelete.filter((note) => note.authorId === user.uid);
    const removed = await deleteNotesForever(targets);
    setConfirmDelete(null);
    exitSelection();
    toast({ message: `Deleted ${plural(removed)} forever` });
  };

  const trashNotes = allNotes.filter((note) => note.deletedAt && note.authorId === user.uid);

  const renderNote = (note: Note) => showTrash ? (
    <TrashCard
      key={note.id}
      note={note}
      autoEmpty={autoEmpty}
      selecting={selecting}
      selected={selectedIds.has(note.id)}
      onToggleSelect={() => toggleSelected(note.id)}
      onRestore={() => void restoreNote(note.id)
        .then(() => toast({ message: "Note restored" }))
        .catch((caught) => toast({ message: caught instanceof Error ? caught.message : "Could not restore note.", tone: "error" }))}
      onDeleteForever={() => setConfirmDelete([note])}
    />
  ) : (
    <NoteCard
      key={note.id}
      note={note}
      groups={groups}
      layout={layout}
      onDelete={(id) => void trashNote(id)}
      onEdit={setEditingNote}
      onView={setViewingNote}
      pinned={pinnedIds.has(note.id)}
      canDelete={note.authorId === user.uid}
      onTogglePin={(id) => void togglePin(id)}
      selecting={selecting}
      selected={selectedIds.has(note.id)}
      onToggleSelect={toggleSelected}
      {...cardMeta(note.id)}
    />
  );
  const listClass = layout === "list" ? "flex flex-col gap-2" : "grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

  return (
    <>
      <div className={`mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8 ${selecting ? "pb-28" : ""}`}>
        <PageHeader
          title="Notes"
          subtitle={notes === null ? "Loading…" : `${filteredNotes.length} ${filteredNotes.length === 1 ? "note" : "notes"}${showTrash ? " in trash" : ""}`}
          actions={<Link href="/write" className="btn-primary md:hidden"><Plus size={16} aria-hidden="true" /> New note</Link>}
        />

        <div className="relative mb-4">
          <label htmlFor="note-search" className="sr-only">Search notes</label>
          <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600" aria-hidden="true" />
          <input
            ref={searchRef}
            id="note-search"
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search titles, writing, groups or #tags…"
            autoComplete="off"
            aria-describedby={searchActive ? "search-status" : undefined}
            className="h-12 w-full rounded-xl border-2 border-slate-900 bg-white pl-11 pr-12 text-[15px] text-slate-900 shadow-[3px_3px_0_0_var(--color-slate-900)] placeholder:text-slate-500 focus:outline-none focus:ring-4 focus:ring-indigo-200"
          />
          <kbd className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 rounded-md border border-slate-300 px-1.5 text-xs font-semibold text-slate-600 sm:block" aria-hidden="true">/</kbd>
        </div>
        {searchActive && <p id="search-status" role="status" className="-mt-2 mb-4 text-xs font-medium text-slate-600">{searching ? "Searching notes on this device…" : privateKey ? "Private notes are searched only after local decryption." : "Unlock your vault to search encrypted note content."}</p>}

        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div role="group" aria-label="Show" className="scrollbar-hide -mx-4 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            {tabs.map(({ key, label, icon: Icon, count }) => {
              const selected = currentTab === key;
              return (
                <button key={key} type="button" aria-pressed={selected} onClick={() => switchView(() => { setShowTrash(false); setView(key); })}
                  className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-3.5 text-sm font-semibold transition-colors ${selected ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-200/70 hover:text-slate-900"}`}>
                  <Icon size={16} className="hidden sm:block" aria-hidden="true" /> {label}
                  {count !== null && count > 0 && <span className={`tabular-nums ${selected ? "text-slate-300" : "text-slate-500"}`}>{count}</span>}
                </button>
              );
            })}
            <span className="mx-1 my-2 w-px shrink-0 bg-slate-300" aria-hidden="true" />
            <button type="button" aria-pressed={showTrash} onClick={() => switchView(() => setShowTrash(true))}
              className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-3.5 text-sm font-semibold transition-colors ${showTrash ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-200/70 hover:text-slate-900"}`}>
              <Trash2 size={16} className="hidden sm:block" aria-hidden="true" /> Trash {viewCounts.trash > 0 && <span className={`tabular-nums ${showTrash ? "text-slate-300" : "text-slate-500"}`}>{viewCounts.trash}</span>}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!showTrash && (
              <>
                <label htmlFor="note-sort" className="sr-only">Sort notes</label>
                <select
                  id="note-sort"
                  value={preferences.sort}
                  onChange={(event) => updatePreferences({ sort: event.target.value as NoteSort })}
                  className="field w-auto cursor-pointer pr-8 font-semibold"
                >
                  {NOTE_SORTS.map((sort) => <option key={sort.value} value={sort.value}>{sort.label}</option>)}
                </select>
                <div role="radiogroup" aria-label="Layout" className="flex rounded-xl border border-slate-300 bg-white p-0.5">
                  {([["grid", LayoutGrid, "Grid"], ["list", List, "List"]] as const).map(([value, Icon, label]) => (
                    <button key={value} type="button" role="radio" aria-checked={preferences.layout === value} aria-label={`${label} layout`} title={label}
                      onClick={() => updatePreferences({ layout: value })}
                      className={`flex h-10 w-10 items-center justify-center rounded-[10px] transition-colors ${preferences.layout === value ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
                      <Icon size={17} aria-hidden="true" />
                    </button>
                  ))}
                </div>
              </>
            )}
            {sortedNotes.length > 0 && (
              <button type="button" aria-pressed={selecting} onClick={() => selecting ? exitSelection() : setSelecting(true)} className="btn-secondary">
                <CheckSquare size={16} aria-hidden="true" /> {selecting ? "Done" : "Select"}
              </button>
            )}
            {showTrash && trashNotes.length > 0 && !selecting && (
              <button type="button" onClick={() => setConfirmDelete(trashNotes)} className="btn-danger">
                <Trash2 size={16} aria-hidden="true" /> Empty trash
              </button>
            )}
            <button type="button" aria-expanded={filtersOpen} aria-controls="note-filters" onClick={() => setFiltersOpen((open) => !open)} className="btn-secondary">
              <SlidersHorizontal size={16} aria-hidden="true" /> Filters
              {activeFilters.length > 0 && <span className="rounded-full bg-indigo-700 px-1.5 text-xs font-bold text-white">{activeFilters.length}</span>}
              <ChevronDown size={16} className={`transition-transform ${filtersOpen ? "rotate-180" : ""}`} aria-hidden="true" />
            </button>
          </div>
        </div>

        {filtersOpen && (
          <div id="note-filters" className="panel mb-4 grid gap-5 p-4 sm:p-5 md:grid-cols-2">
            <fieldset>
              <legend className="label">Type</legend>
              <div className="flex flex-wrap gap-2">
                {MODE_FILTERS.map(({ value, label, icon: Icon }) => (
                  <button key={value || "all"} type="button" onClick={() => setModeFilter(value)} aria-pressed={modeFilter === value} className={chipClass(modeFilter === value)}>
                    <Icon size={13} aria-hidden="true" /> {label}
                  </button>
                ))}
              </div>
            </fieldset>
            <div>
              <label htmlFor="note-date" className="label">Created on</label>
              <div className="relative max-w-xs">
                <Calendar size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" aria-hidden="true" />
                <input
                  id="note-date"
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  onClick={(event) => {
                    try { event.currentTarget.showPicker?.(); } catch { /* Native date input remains usable. */ }
                  }}
                  className="field cursor-pointer pl-9"
                />
              </div>
            </div>
            {groups.length > 0 && (
              <fieldset>
                <legend className="label">Group</legend>
                <div className="flex flex-wrap gap-2">
                  {groups.map((g) => (
                    <button key={g.id} type="button" aria-pressed={groupFilter === g.id} onClick={() => setGroupFilter(groupFilter === g.id ? "" : g.id)} className={chipClass(groupFilter === g.id)}>
                      <span className="h-2 w-2 shrink-0 rounded-full ring-1 ring-white" style={{ backgroundColor: g.color }} aria-hidden="true" />
                      {g.title}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}
            {allTags.length > 0 && (
              <fieldset>
                <legend className="label">Tag</legend>
                <div className="flex flex-wrap gap-2">
                  {allTags.map((tag) => (
                    <button key={tag} type="button" aria-pressed={tagFilter === tag} onClick={() => setTagFilter(tagFilter === tag ? "" : tag)} className={chipClass(tagFilter === tag)}>
                      #{tag}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}
          </div>
        )}

        {activeFilters.length > 0 && (
          <div className="mb-5 flex flex-wrap items-center gap-2" aria-label="Active filters">
            {activeFilters.map((filter) => (
              <button key={filter.key} type="button" onClick={filter.clear} className="chip border-indigo-300 bg-indigo-50 text-indigo-900 hover:border-indigo-600" aria-label={`Remove filter ${filter.label}`}>
                {filter.label} <X size={13} aria-hidden="true" />
              </button>
            ))}
            <button type="button" onClick={clearAllFilters} className="min-h-9 rounded-lg px-2 text-xs font-semibold text-slate-700 underline-offset-2 hover:underline">Clear all</button>
          </div>
        )}

        {showTrash && (
          <p className="mb-5 text-sm text-slate-700">
            Notes in trash stay here until you restore them or delete them forever.
            {autoEmpty
              ? ` On this device, notes older than ${TRASH_RETENTION_DAYS} days are removed automatically.`
              : <> You can have old notes removed automatically in <Link href="/settings#settings-trash" className="font-semibold text-indigo-800 underline-offset-2 hover:underline">Settings</Link>.</>}
          </p>
        )}

        {notes === null ? (
          <CardSkeletons count={6} />
        ) : (
          <>
            {pinnedVisible.length > 0 && (
              <section className="mb-10" aria-labelledby="pinned-heading">
                <h2 id="pinned-heading" className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-900"><Pin size={16} aria-hidden="true" /> Pinned</h2>
                <div className={listClass}>
                  <AnimatePresence>
                    {pinnedVisible.map(renderNote)}
                  </AnimatePresence>
                </div>
              </section>
            )}

            {sections.length > 0 ? (
              <div className="space-y-10">
                {sections.map((section) => (
                  <section key={section.key} aria-label={section.label}>
                    <h3 className="mb-4 flex items-center gap-3 text-sm font-semibold text-slate-700">
                      <span>{section.label}</span>
                      <span className="h-px flex-1 bg-slate-200" aria-hidden="true" />
                      <span className="tabular-nums text-slate-500">{section.notes.length}</span>
                    </h3>
                    <div className={listClass}>
                      <AnimatePresence>
                        {section.notes.map(renderNote)}
                      </AnimatePresence>
                    </div>
                  </section>
                ))}
                {hasMore && (
                  <div ref={sentinelRef} className="flex justify-center">
                    <button type="button" onClick={showMore} className="btn-secondary">
                      Show more ({restNotes.length - visible} left)
                    </button>
                  </div>
                )}
              </div>
            ) : filteredNotes.length === 0 ? (
              showTrash ? (
                <EmptyState icon={<Trash2 size={22} />} title="Trash is empty" description="Notes you move to trash appear here." />
              ) : searchActive || activeFilters.length > 0 ? (
                <EmptyState icon={<Search size={22} />} title="No matching notes" description="Try a different search or remove a filter."
                  action={<button type="button" onClick={() => { setSearchTerm(""); clearAllFilters(); }} className="btn-secondary">Clear search and filters</button>} />
              ) : view === "archived" ? (
                <EmptyState icon={<Archive size={22} />} title="No archived notes" description="Archive a note from its menu to tuck it away without deleting it." />
              ) : view === "reminders" ? (
                <EmptyState icon={<Bell size={22} />} title="No reminders set" description="Open a note and choose Reminder to get notified." />
              ) : (
                <EmptyState icon={<NotebookText size={22} />} title="No notes yet" description="Your notes will appear here."
                  action={<Link href="/write" className="btn-primary"><Plus size={16} aria-hidden="true" /> New note</Link>} />
              )
            ) : null}
          </>
        )}
      </div>

      {/* Bulk action bar: sits above the mobile tab bar while selecting. */}
      {selecting && (
        <div className="fixed inset-x-0 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-[var(--z-header)] flex justify-center px-3 md:bottom-5" role="region" aria-label="Selected notes">
          <div className="flex w-full max-w-3xl items-center gap-1.5 rounded-card border-2 border-slate-900 bg-white p-2 shadow-[var(--neubrutalism-shadow)] sm:gap-2 sm:p-2.5">
            <span className="whitespace-nowrap px-1.5 text-sm font-semibold tabular-nums text-slate-900 sm:px-2" aria-live="polite">{selectedIds.size} selected</span>
            <button type="button" onClick={() => setSelectedIds(allSelected ? new Set() : new Set(selectableNotes.map((note) => note.id)))} className="btn-quiet min-h-10 px-2.5 sm:px-3" aria-label={allSelected ? "Select none" : "Select all"}>
              <CheckSquare size={16} className="sm:hidden" aria-hidden="true" />
              <span className="hidden sm:inline">{allSelected ? "Select none" : "Select all"}</span>
            </button>
            <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
              {showTrash ? (
                <>
                  <button type="button" disabled={bulkBusy || selectedNotes.length === 0} onClick={() => void bulkRestore()} className="btn-secondary min-h-10 px-3">
                    <RotateCcw size={15} aria-hidden="true" /> Restore
                  </button>
                  <button type="button" disabled={bulkBusy || selectedNotes.length === 0} onClick={() => setConfirmDelete(selectedNotes)} className="btn-danger min-h-10 px-3">
                    <Trash2 size={15} aria-hidden="true" /> Delete forever
                  </button>
                </>
              ) : (
                <>
                  <button type="button" disabled={bulkBusy || selectedNotes.length === 0} onClick={() => void bulkArchive(view !== "archived")} className="btn-secondary min-h-10 px-3">
                    {view === "archived" ? <ArchiveRestore size={15} aria-hidden="true" /> : <Archive size={15} aria-hidden="true" />}
                    <span className="hidden sm:inline">{view === "archived" ? "Unarchive" : "Archive"}</span>
                  </button>
                  {groups.length > 0 && (
                    <Menu
                      label="Add selected notes to a group"
                      align="end"
                      triggerClassName={`btn-secondary min-h-10 px-3 ${bulkBusy || ownedSelected.length === 0 ? "pointer-events-none opacity-45" : ""}`}
                      trigger={<><FolderPlus size={15} aria-hidden="true" /><span className="hidden sm:inline">Add to group</span></>}
                      items={groups.map((group) => ({ label: group.title, onSelect: () => void bulkAddToGroup(group) }))}
                    />
                  )}
                  <button type="button" disabled={bulkBusy || ownedSelected.length === 0} onClick={() => void bulkTrash()} className="btn-danger min-h-10 px-3" aria-label="Move selected notes to trash">
                    <Trash2 size={15} aria-hidden="true" /><span className="hidden sm:inline">Move to trash</span>
                  </button>
                </>
              )}
              <button type="button" onClick={exitSelection} className="icon-btn" aria-label="Stop selecting">
                <X size={18} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      <EditNoteModal
        note={editingNote}
        onClose={() => setEditingNote(null)}
        onSave={handleUpdateNote}
        groups={groups}
        userId={user?.uid}
        privateKey={privateKey}
      />

      <ViewNoteModal
        note={activeViewNote}
        groups={groups}
        onClose={() => { setViewingNote(null); clearLinkedNote(); }}
        onEdit={(note) => { setViewingNote(null); clearLinkedNote(); setEditingNote(note); }}
        userId={user?.uid}
        privateKey={privateKey}
        pinned={activeViewNote ? pinnedIds.has(activeViewNote.id) : false}
        onTogglePin={(id) => void togglePin(id)}
        onTrash={activeViewNote && activeViewNote.authorId === user.uid ? (note) => { setViewingNote(null); clearLinkedNote(); void trashNote(note.id); } : undefined}
      />

      <ConfirmDialog
        open={confirmDelete !== null}
        title={confirmDelete && confirmDelete.length > 1 ? `Delete ${confirmDelete.length} notes forever?` : "Delete this note forever?"}
        description={confirmDelete && confirmDelete.length > 1
          ? "These notes and their files will be permanently removed. This can't be undone."
          : "The note and its files will be permanently removed. This can't be undone."}
        confirmLabel="Delete forever"
        destructive
        onConfirm={confirmPermanentDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </>
  );
}
