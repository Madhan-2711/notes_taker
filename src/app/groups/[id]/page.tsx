"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "../../../hooks/useAuth";
import { db, hasValidConfig } from "../../../lib/firebaseConfig";
import { collection, query, where, onSnapshot, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { type Note, type Group } from "../../../lib/validations";
import { NoteCard } from "../../../components/NoteCard";
import { EditNoteModal } from "../../../components/EditNoteModal";
import { ViewNoteModal } from "../../../components/ViewNoteModal";
import { ManageGroupModal } from "../../../components/ManageGroupModal";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Settings } from "lucide-react";
import Link from "next/link";

export default function GroupDetailPage() {
  const { id: groupId } = useParams<{ id: string }>();
  const { user, loading } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [viewingNote, setViewingNote] = useState<Note | null>(null);
  const [managingGroup, setManagingGroup] = useState<Group | null>(null);

  // Subscribe to notes
  useEffect(() => {
    if (!user || !hasValidConfig) { setNotes([]); return; }
    const q = query(collection(db, "notes"), where("authorId", "==", user.uid));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Note[];
      data.sort((a, b) => b.createdAt - a.createdAt);
      setNotes(data);
    });
    return () => unsub();
  }, [user]);

  // Subscribe to groups
  useEffect(() => {
    if (!user || !hasValidConfig) { setGroups([]); return; }
    const q = query(collection(db, "groups"), where("authorId", "==", user.uid));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Group[];
      setGroups(data);
    });
    return () => unsub();
  }, [user]);

  const currentGroup = groups.find((g) => g.id === groupId) ?? null;

  // Only notes belonging to this group
  const groupNotes = useMemo(
    () => notes.filter((n) => n.groupIds?.includes(groupId)),
    [notes, groupId]
  );

  // Group notes by date for display
  const groupedByDate = useMemo(() => {
    const grouped: Record<string, Note[]> = {};
    groupNotes.forEach((note) => {
      const key = new Date(note.createdAt).toLocaleDateString(undefined, {
        weekday: "long", year: "numeric", month: "long", day: "numeric",
      });
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(note);
    });
    return grouped;
  }, [groupNotes]);

  const handleDeleteNote = async (id: string) => {
    if (!user || !hasValidConfig) return;
    try { await deleteDoc(doc(db, "notes", id)); }
    catch (e) { console.error("Delete failed", e); }
  };

  const handleUpdateNote = async (id: string, title: string, content: string) => {
    if (!user || !hasValidConfig) return;
    await updateDoc(doc(db, "notes", id), { title, content, updatedAt: Date.now() });
  };

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
        <p className="text-foreground/60 text-lg">Please sign in to view this group.</p>
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
          className="flex items-center justify-between gap-4 mb-8"
        >
          <div className="flex items-center gap-4">
            <Link
              href="/groups"
              className="flex items-center gap-2 text-sm font-medium text-foreground/50 hover:text-foreground transition-colors"
            >
              <ArrowLeft size={16} /> Groups
            </Link>
            <div className="h-4 w-px bg-border"></div>

            {currentGroup && (
              <div
                className="w-3 h-3 rounded-full border-2 border-white shadow-sm"
                style={{ backgroundColor: currentGroup.color }}
              />
            )}

            <h1 className="text-2xl font-bold tracking-tight">
              {currentGroup?.title ?? "Group"}
            </h1>
            <span className="text-sm text-foreground/40 font-medium">
              {groupNotes.length} {groupNotes.length === 1 ? "note" : "notes"}
            </span>
          </div>

          {currentGroup && (
            <button
              onClick={() => setManagingGroup(currentGroup)}
              className="flex items-center gap-2 text-sm font-medium text-foreground/50 hover:text-primary glass neubrutal px-4 py-2 rounded-[var(--radius-xl)] transition-colors"
            >
              <Settings size={15} /> Manage
            </button>
          )}
        </motion.div>

        {/* Notes */}
        {Object.keys(groupedByDate).length > 0 ? (
          <div className="space-y-10">
            {Object.entries(groupedByDate).map(([dateLabel, dateNotes]) => (
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
            <p>No notes in this group yet.</p>
            {currentGroup && (
              <button
                onClick={() => setManagingGroup(currentGroup)}
                className="text-sm font-semibold text-primary hover:underline"
              >
                Add notes →
              </button>
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
      />

      {/* View Modal */}
      <ViewNoteModal
        note={viewingNote}
        groups={groups}
        onClose={() => setViewingNote(null)}
        onEdit={(note) => { setViewingNote(null); setEditingNote(note); }}
      />

      {/* Manage Group Modal */}
      {currentGroup && (
        <ManageGroupModal
          group={managingGroup}
          allNotes={notes}
          groupNoteIds={groupNotes.map((n) => n.id)}
          userId={user.uid}
          onClose={() => setManagingGroup(null)}
          onDeleted={() => setManagingGroup(null)}
        />
      )}
    </>
  );
}
