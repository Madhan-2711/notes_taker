"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useUserKeys } from "../../hooks/useUserKeys";
import { hasValidConfig } from "../../lib/firebaseConfig";
import { db } from "../../lib/firebaseConfig";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { type Note, type Group, type NoteMode } from "../../lib/validations";
import {
  subscribeToNotes,
  updateNormalNote,
  deleteNote,
} from "../../lib/services/notes/normalNotesService";
import { NoteCard } from "../../components/NoteCard";
import { EditNoteModal } from "../../components/EditNoteModal";
import { ViewNoteModal } from "../../components/ViewNoteModal";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Calendar, X, FolderOpen, Lock, Unlock, Users, Layers } from "lucide-react";
import Link from "next/link";

const MODE_FILTERS: { value: NoteMode | ""; label: string; icon: typeof Lock }[] = [
  { value: "", label: "All", icon: Layers },
  { value: "normal", label: "Normal", icon: Unlock },
  { value: "secure", label: "Encrypted", icon: Lock },
  { value: "collab", label: "Collab", icon: Users },
];

export default function NotesPage() {
  const { user, loading } = useAuth();
  const { privateKey } = useUserKeys();
  const [notes, setNotes] = useState<Note[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [dateFilter, setDateFilter] = useState("");
  const [groupFilter, setGroupFilter] = useState("");
  const [modeFilter, setModeFilter] = useState<NoteMode | "">("");
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [viewingNote, setViewingNote] = useState<Note | null>(null);

  // Subscribe to notes via service
  useEffect(() => {
    if (!user || !hasValidConfig) { setNotes([]); return; }
    const unsub = subscribeToNotes(user.uid, (data) => setNotes(data));
    return () => unsub();
  }, [user]);

  // Subscribe to groups
  useEffect(() => {
    if (!user || !hasValidConfig) { setGroups([]); return; }
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
    try { await deleteNote(id); }
    catch (e) { console.error("Delete failed", e); }
  };

  const handleUpdateNote = async (id: string, title: string, content: string) => {
    if (!user || !hasValidConfig) return;
    await updateNormalNote(id, title, content);
  };

  // Filter notes by date, group, and mode
  const filteredNotes = useMemo(() => {
    return notes.filter((note) => {
      const matchesDate = !dateFilter
        ? true
        : new Date(note.createdAt).toISOString().split("T")[0] === dateFilter;
      const matchesGroup = !groupFilter
        ? true
        : note.groupIds?.includes(groupFilter);
      const matchesMode = !modeFilter
        ? true
        : (note.mode || "normal") === modeFilter;
      return matchesDate && matchesGroup && matchesMode;
    });
  }, [notes, dateFilter, groupFilter, modeFilter]);

  // Group filtered notes by date for display
  const groupedNotes = useMemo(() => {
    const grouped: Record<string, Note[]> = {};
    filteredNotes.forEach((note) => {
      const key = new Date(note.createdAt).toLocaleDateString(undefined, {
        weekday: "long", year: "numeric", month: "long", day: "numeric",
      });
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(note);
    });
    return grouped;
  }, [filteredNotes]);

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
      <div className="flex-1 max-w-5xl mx-auto w-full p-6 mt-4">
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
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-foreground/40" />
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="bg-transparent border border-border/60 rounded-[var(--radius-xl)] px-4 py-2 text-sm font-medium focus:outline-none focus:border-primary transition-colors cursor-pointer"
            />
            {dateFilter && (
              <button
                onClick={() => setDateFilter("")}
                className="flex items-center gap-1 text-xs font-medium text-foreground/50 hover:text-foreground bg-border/40 hover:bg-border/60 px-3 py-2 rounded-full transition-colors"
              >
                <X size={12} /> Clear
              </button>
            )}
          </div>
        </motion.div>

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
              onClick={() => setModeFilter(modeFilter === value ? "" : value)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all duration-200 ${
                modeFilter === value
                  ? "bg-foreground text-background border-foreground"
                  : "bg-transparent text-foreground/50 border-border/60 hover:border-foreground/40 hover:text-foreground"
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  <AnimatePresence>
                    {dateNotes.map((note) => (
                      <NoteCard
                        key={note.id}
                        note={note}
                        groups={groups}
                        onDelete={handleDeleteNote}
                        onEdit={setEditingNote}
                        onView={setViewingNote}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </motion.section>
            ))}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="py-24 text-center text-foreground/40 font-medium flex flex-col items-center gap-4"
          >
            <div className="w-16 h-16 border-2 border-dashed border-border rounded-full flex items-center justify-center">🍃</div>
            {dateFilter || groupFilter || modeFilter ? (
              <p>No notes found for the selected filters.</p>
            ) : (
              <p>Your space is empty. Start writing to see your notes here.</p>
            )}
          </motion.div>
        )}
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
        note={viewingNote}
        groups={groups}
        onClose={() => setViewingNote(null)}
        onEdit={(note) => { setViewingNote(null); setEditingNote(note); }}
        userId={user?.uid}
        privateKey={privateKey}
      />
    </>
  );
}
