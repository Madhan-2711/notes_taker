"use client";

import { Suspense, useState, useEffect, useMemo } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useUserKeys } from "../../hooks/useUserKeys";
import { hasValidConfig } from "../../lib/firebaseConfig";
import { db } from "../../lib/firebaseConfig";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { type Note, type Group, type NoteMode, isCollabNote } from "../../lib/validations";
import {
  subscribeToNotes,
  updateNormalNote,
  deleteNote,
  moveNoteToTrash,
  restoreNote,
} from "../../lib/services/notes/normalNotesService";
import { deleteCollabNote } from "../../lib/services/notes/collaborativeNotesService";
import { NoteCard } from "../../components/NoteCard";
import { EditNoteModal } from "../../components/EditNoteModal";
import { ViewNoteModal } from "../../components/ViewNoteModal";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Calendar, X, FolderOpen, Lock, Unlock, Users, Layers, Search, SlidersHorizontal, RotateCcw, Trash2, Pin } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { buildSearchIndex } from "../../lib/noteSearch";
import { useNotePins } from "../../hooks/useNotePins";

function localDateKey(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

const MODE_FILTERS: { value: NoteMode | ""; label: string; icon: typeof Lock }[] = [
  { value: "", label: "All", icon: Layers },
  { value: "normal", label: "Normal", icon: Unlock },
  { value: "secure", label: "Encrypted", icon: Lock },
  { value: "collab", label: "Collab", icon: Users },
];

export default function NotesPage() {
  return (
    <Suspense fallback={<div className="flex-1 flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" /></div>}>
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
  const [notes, setNotes] = useState<Note[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [dateFilter, setDateFilter] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [modeFilter, setModeFilter] = useState<NoteMode | "">("");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchIndex, setSearchIndex] = useState<Map<string, string>>(new Map());
  const [searching, setSearching] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [viewingNote, setViewingNote] = useState<Note | null>(null);
  const [dismissedLinkedId, setDismissedLinkedId] = useState<string | null>(null);
  const linkedNote = linkedNoteId && dismissedLinkedId !== linkedNoteId
    ? notes.find((note) => note.id === linkedNoteId && !isCollabNote(note)) ?? null
    : null;
  const activeViewNote = viewingNote ?? linkedNote;

  const clearLinkedNote = () => {
    if (!linkedNoteId) return;
    setDismissedLinkedId(linkedNoteId);
    router.replace("/notes", { scroll: false });
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

  const handleDeleteNote = async (id: string) => {
    if (!user || !hasValidConfig) return;
    try { setDeleteError(""); await moveNoteToTrash(id); }
    catch (e) { setDeleteError(e instanceof Error ? e.message : "Could not move note to trash."); }
  };

  const handlePermanentDelete = async (note: Note) => {
    if (!user || note.authorId !== user.uid || !window.confirm("Permanently delete this note and its files? This cannot be undone.")) return;
    try {
      setDeleteError("");
      if (isCollabNote(note)) await deleteCollabNote(note.id);
      else await deleteNote(note.id);
    } catch (caught) { setDeleteError(caught instanceof Error ? caught.message : "Could not permanently delete note."); }
  };

  const handleUpdateNote = async (id: string, title: string, content: string) => {
    if (!user || !hasValidConfig) return;
    await updateNormalNote(id, title, content);
  };

  const searchActive = searchTerm.trim().length > 0;
  useEffect(() => {
    if (!searchActive || !user) return;
    let active = true;
    const timer = window.setTimeout(() => {
      setSearching(true);
      buildSearchIndex(notes, user.uid, privateKey).then((index) => {
        if (active) setSearchIndex(index);
      }).finally(() => { if (active) setSearching(false); });
    }, 200);
    return () => { active = false; window.clearTimeout(timer); };
  }, [searchActive, notes, user, privateKey]);

  // Filter notes by date, group, and mode
  const filteredNotes = useMemo(() => {
    const term = searchTerm.trim().toLocaleLowerCase();
    const matchingGroupIds = term ? new Set(groups.filter((group) => group.title.toLocaleLowerCase().includes(term)).map((group) => group.id)) : new Set<string>();
    return notes.filter((note) => {
      if (showTrash ? (!note.deletedAt || note.authorId !== user?.uid) : Boolean(note.deletedAt)) return false;
      const matchesDate = !dateFilter
        ? true
        : localDateKey(note.createdAt) === dateFilter;
      const matchesGroup = !groupFilter
        ? true
        : note.groupIds?.includes(groupFilter);
      const matchesMode = !modeFilter
        ? true
        : (note.mode || "normal") === modeFilter;
      const matchesSearch = !term || searchIndex.get(note.id)?.includes(term) || note.groupIds?.some((id) => matchingGroupIds.has(id));
      return matchesDate && matchesGroup && matchesMode && matchesSearch;
    });
  }, [notes, groups, dateFilter, groupFilter, modeFilter, searchTerm, searchIndex, showTrash, user?.uid]);

  // Group filtered notes by date for display
  const groupedNotes = useMemo(() => {
    const grouped: Record<string, Note[]> = {};
    filteredNotes.filter((note) => !pinnedIds.has(note.id) || showTrash).forEach((note) => {
      const key = new Date(note.createdAt).toLocaleDateString(undefined, {
        weekday: "long", year: "numeric", month: "long", day: "numeric",
      });
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(note);
    });
    return grouped;
  }, [filteredNotes, pinnedIds, showTrash]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-lg mx-auto gap-4">
        <p className="text-foreground/60 text-lg">Please sign in to view your notes.</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 sm:mt-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6"
        >
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2 text-sm font-medium text-foreground/50 hover:text-foreground transition-colors">
              <ArrowLeft size={16} /> Home
            </Link>
            <div className="h-4 w-px bg-border"></div>
            <h1 className="text-2xl font-bold tracking-tight">My Notes</h1>
            <span className="text-sm text-foreground/40 font-medium">
              {filteredNotes.length} {filteredNotes.length === 1 ? "note" : "notes"}
            </span>
          </div>

          {/* Date Filter */}
          <div className="flex w-full items-center gap-2 sm:w-auto">
            <div className="relative min-w-0 flex-1 sm:w-56">
            <Calendar size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" aria-hidden="true" />
            <input
              type="date"
              aria-label="Filter notes by date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              onClick={(event) => {
                try { event.currentTarget.showPicker?.(); } catch { /* Native date input remains usable. */ }
              }}
              className="h-12 w-full cursor-pointer rounded-xl border border-slate-300 bg-white pl-10 pr-3 text-sm font-semibold text-slate-900 shadow-sm transition-colors hover:border-indigo-400 focus-visible:outline-2 focus-visible:outline-indigo-600"
            />
            </div>
            {dateFilter && (
              <button
                type="button"
                onClick={() => setDateFilter("")}
                className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:border-indigo-400 focus-visible:outline-2 focus-visible:outline-indigo-600"
              >
                <X size={12} /> Clear
              </button>
            )}
          </div>
        </motion.div>

        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium text-slate-700">{showTrash ? "Deleted notes stay here until you permanently remove them." : "Your writing, organised in one place."}</p>
          <button type="button" onClick={() => setShowTrash((value) => !value)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-800 hover:border-indigo-400 focus-visible:outline-2 focus-visible:outline-indigo-600">
            {showTrash ? <RotateCcw size={17} /> : <Trash2 size={17} />}{showTrash ? "Back to notes" : `Trash (${notes.filter((note) => note.deletedAt && note.authorId === user.uid).length})`}
          </button>
        </div>
        {deleteError && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">{deleteError}</p>}

        <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <label htmlFor="note-search" className="mb-2 block text-sm font-bold text-slate-800">Search your notes</label>
          <div className="relative">
            <Search size={19} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" aria-hidden="true" />
            <input id="note-search" type="search" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Search titles, writing, or groups"
              className="h-12 w-full rounded-xl border border-slate-300 bg-slate-50 pl-11 pr-4 text-sm text-slate-900 outline-none placeholder:text-slate-600 focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-200" />
          </div>
          {searchActive && <p role="status" className="mt-2 text-xs font-medium text-slate-600">{searching ? "Searching notes on this device…" : privateKey ? "Private notes are searched only after local decryption." : "Unlock your vault to search encrypted note content."}</p>}
        </div>

        <details className="mb-6 rounded-2xl border border-slate-200 bg-white/85 px-4 py-3">
          <summary className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-bold text-slate-800 focus-visible:outline-2 focus-visible:outline-indigo-600"><SlidersHorizontal size={17} /> Filters {(modeFilter || groupFilter) && <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs text-indigo-800">Active</span>}</summary>
          <div className="pt-3">
        {/* Mode Filter Chips */}
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.03 }}
          className="flex items-center gap-2 flex-wrap mb-4"
        >
          <div className="flex items-center gap-1.5 text-xs font-medium text-foreground/40 mr-1">
            <Layers size={13} />
            <span>Type:</span>
          </div>
          {MODE_FILTERS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setModeFilter(value)}
              aria-pressed={modeFilter === value}
              className={`flex min-h-10 items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 ${
                modeFilter === value
                  ? "border-indigo-600 bg-indigo-600 text-white shadow-sm"
                  : "border-slate-200 bg-white text-slate-600 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"
              }`}
            >
              <Icon size={12} />
              {label}
            </button>
          ))}
        </motion.div>

        {/* Group Filter Chips */}
        {groups.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="flex items-center gap-2 flex-wrap mb-8"
          >
            <div className="flex items-center gap-1.5 text-xs font-medium text-foreground/40 mr-1">
              <FolderOpen size={13} />
              <span>Groups:</span>
            </div>

            <button
              onClick={() => setGroupFilter("")}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200 ${
                !groupFilter
                  ? "bg-foreground text-background border-foreground"
                  : "bg-transparent text-foreground/50 border-border/60 hover:border-foreground/40 hover:text-foreground"
              }`}
            >
              All
            </button>

            {groups.map((g) => (
              <button
                key={g.id}
                onClick={() => setGroupFilter(groupFilter === g.id ? "" : g.id)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold border-2 transition-all duration-200 ${
                  groupFilter === g.id ? "text-white border-transparent" : "bg-transparent border-border/50 text-foreground/60 hover:text-foreground"
                }`}
                style={groupFilter === g.id ? { backgroundColor: g.color, borderColor: g.color } : {}}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: groupFilter === g.id ? "white" : g.color }} />
                {g.title}
              </button>
            ))}
          </motion.div>
        )}
          </div>
        </details>

        {!showTrash && filteredNotes.some((note) => pinnedIds.has(note.id)) && <section className="mb-8" aria-label="Pinned notes">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-800"><Pin size={16} /> Pinned</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredNotes.filter((note) => pinnedIds.has(note.id)).map((note) => <NoteCard key={note.id} note={note} groups={groups} onDelete={handleDeleteNote} onEdit={setEditingNote} onView={setViewingNote} pinned canDelete={note.authorId === user.uid} onTogglePin={(id) => void togglePin(id)} />)}
          </div>
        </section>}

        {/* Notes grouped by date */}
        {Object.keys(groupedNotes).length > 0 ? (
          <div className="space-y-10">
            {Object.entries(groupedNotes).map(([dateLabel, dateNotes]) => (
              <motion.section key={dateLabel} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <h3 className="text-xs font-medium tracking-widest uppercase text-foreground/35 mb-5 flex items-center gap-3">
                  <span>{dateLabel}</span>
                  <span className="flex-1 h-px bg-border/50"></span>
                  <span className="text-foreground/25">{dateNotes.length}</span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                  <AnimatePresence>
                    {dateNotes.map((note) => showTrash ? (
                      <div key={note.id} className="rounded-2xl border border-slate-300 bg-white p-5 shadow-sm">
                        <h4 className="truncate text-base font-bold text-slate-900">{note.mode === "secure" ? "Encrypted note" : note.title}</h4>
                        <p className="mt-2 text-sm text-slate-600">Deleted {new Date(note.deletedAt!).toLocaleDateString()}</p>
                        <div className="mt-5 flex flex-wrap gap-2">
                          <button type="button" onClick={() => void restoreNote(note.id).catch((caught) => setDeleteError(caught instanceof Error ? caught.message : "Could not restore note."))} className="min-h-11 rounded-xl border border-emerald-300 bg-emerald-50 px-3 text-sm font-bold text-emerald-800 focus-visible:outline-2 focus-visible:outline-indigo-600">Restore</button>
                          <button type="button" onClick={() => void handlePermanentDelete(note)} className="min-h-11 rounded-xl border border-red-300 bg-red-50 px-3 text-sm font-bold text-red-800 focus-visible:outline-2 focus-visible:outline-indigo-600">Delete forever</button>
                        </div>
                      </div>
                    ) : (
                      <NoteCard key={note.id} note={note} groups={groups} onDelete={handleDeleteNote} onEdit={setEditingNote} onView={setViewingNote} pinned={pinnedIds.has(note.id)} canDelete={note.authorId === user.uid} onTogglePin={(id) => void togglePin(id)} />
                    ))}
                  </AnimatePresence>
                </div>
              </motion.section>
            ))}
          </div>
        ) : filteredNotes.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="py-24 text-center text-foreground/40 font-medium flex flex-col items-center gap-4"
          >
            <div className="w-16 h-16 border-2 border-dashed border-border rounded-full flex items-center justify-center">🍃</div>
            {showTrash ? <p>Trash is empty.</p> : dateFilter || groupFilter || modeFilter || searchTerm ? (
              <p>No notes found for the selected filters.</p>
            ) : (
              <p>Your space is empty. Start writing to see your notes here.</p>
            )}
          </motion.div>
        ) : null}
      </div>

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
      />
    </>
  );
}
