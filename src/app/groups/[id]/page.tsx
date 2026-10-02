"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "../../../hooks/useAuth";
import { useUserKeys } from "../../../hooks/useUserKeys";
import { useNotePins } from "../../../hooks/useNotePins";
import { useTrashWithUndo } from "../../../hooks/useTrashWithUndo";
import { useNoteMeta } from "../../../contexts/NoteMetaContext";
import { db, hasValidConfig } from "../../../lib/firebaseConfig";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { type Note, type Group } from "../../../lib/validations";
import { EMPTY_META } from "../../../lib/noteMeta";
import { subscribeToNotes, updateNormalNote } from "../../../lib/services/notes/normalNotesService";
import { NoteCard } from "../../../components/NoteCard";
import dynamic from "next/dynamic";
import { ManageGroupModal } from "../../../components/ManageGroupModal";
import { PageHeader } from "../../../components/PageHeader";
import { CardSkeletons, EmptyState, PageLoading, SignInRequired } from "../../../components/PageState";
import { AnimatePresence } from "framer-motion";
import { FolderOpen, Settings } from "lucide-react";
import Link from "next/link";

const EditNoteModal = dynamic(() => import("../../../components/EditNoteModal").then((m) => m.EditNoteModal), { ssr: false });
const ViewNoteModal = dynamic(() => import("../../../components/ViewNoteModal").then((m) => m.ViewNoteModal), { ssr: false });

export default function GroupDetailPage() {
  const { id: groupId } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading } = useAuth();
  const { privateKey } = useUserKeys();
  const { pinnedIds, toggle: togglePin } = useNotePins(user?.uid);
  const { metaByNote } = useNoteMeta();
  const trashNote = useTrashWithUndo();
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [viewingNote, setViewingNote] = useState<Note | null>(null);
  const [managingGroup, setManagingGroup] = useState<Group | null>(null);

  // Subscribe to notes (both authored and collab)
  useEffect(() => {
    if (!user || !hasValidConfig) return;
    const unsub = subscribeToNotes(user.uid, (data) => setNotes(data));
    return () => unsub();
  }, [user]);

  // Subscribe to groups
  useEffect(() => {
    if (!user || !hasValidConfig) return;
    const q = query(collection(db, "groups"), where("authorId", "==", user.uid));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Group[];
      setGroups(data);
    });
    return () => unsub();
  }, [user]);

  const allNotes = useMemo(() => notes ?? [], [notes]);
  const currentGroup = groups?.find((g) => g.id === groupId) ?? null;

  // Only notes belonging to this group
  const groupNotes = useMemo(
    () => allNotes.filter((n) => n.groupIds?.includes(groupId)),
    [allNotes, groupId]
  );
  const groupNoteIds = useMemo(() => groupNotes.map((n) => n.id), [groupNotes]);

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

  const cardMeta = (noteId: string) => {
    const meta = metaByNote.get(noteId) ?? EMPTY_META;
    return { tags: meta.tags, reminderAt: meta.reminderAt };
  };

  const handleUpdateNote = async (id: string, title: string, content: string, richContent: string) => {
    if (!user || !hasValidConfig) return;
    await updateNormalNote(id, title, content, richContent);
  };

  if (loading) return <PageLoading label="Loading group" />;
  if (!user) return <SignInRequired>Sign in to view this group.</SignInRequired>;

  if (groups !== null && !currentGroup) {
    return (
      <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <PageHeader title="Group not found" back={{ href: "/groups", label: "Groups" }} />
        <EmptyState icon={<FolderOpen size={22} />} title="This group doesn't exist" description="It may have been deleted. Your notes are still in Notes."
          action={<Link href="/groups" className="btn-secondary">See all groups</Link>} />
      </div>
    );
  }

  return (
    <>
      <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <PageHeader
          back={{ href: "/groups", label: "Groups" }}
          title={
            <span className="flex items-center gap-3">
              {currentGroup && <span className="h-3.5 w-3.5 shrink-0 rounded-full" style={{ backgroundColor: currentGroup.color }} aria-hidden="true" />}
              <span className="truncate">{currentGroup?.title ?? "Group"}</span>
            </span>
          }
          subtitle={notes === null ? "Loading…" : `${groupNotes.length} ${groupNotes.length === 1 ? "note" : "notes"}`}
          actions={currentGroup && (
            <button type="button" onClick={() => setManagingGroup(currentGroup)} className="btn-secondary">
              <Settings size={16} aria-hidden="true" /> Manage
            </button>
          )}
        />

        {/* Notes */}
        {notes === null || groups === null ? (
          <CardSkeletons count={3} />
        ) : Object.keys(groupedByDate).length > 0 ? (
          <div className="space-y-10">
            {Object.entries(groupedByDate).map(([dateLabel, dateNotes]) => (
              <section key={dateLabel} aria-label={dateLabel}>
                <h3 className="mb-4 flex items-center gap-3 text-sm font-semibold text-slate-700">
                  <span>{dateLabel}</span>
                  <span className="h-px flex-1 bg-slate-200" aria-hidden="true" />
                  <span className="tabular-nums text-slate-500">{dateNotes.length}</span>
                </h3>
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  <AnimatePresence>
                    {dateNotes.map((note) => (
                      <NoteCard
                        key={note.id}
                        note={note}
                        groups={groups}
                        onDelete={(id) => void trashNote(id)}
                        onEdit={setEditingNote}
                        onView={setViewingNote}
                        canDelete={note.authorId === user.uid}
                        pinned={pinnedIds.has(note.id)}
                        onTogglePin={(id) => void togglePin(id)}
                        {...cardMeta(note.id)}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </section>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<FolderOpen size={22} />}
            title="No notes in this group yet"
            description="Add existing notes from Manage, or pick this group when you write a new note."
            action={currentGroup && (
              <button type="button" onClick={() => setManagingGroup(currentGroup)} className="btn-secondary">
                Add notes
              </button>
            )}
          />
        )}
      </div>

      {/* Edit Modal */}
      {editingNote && <EditNoteModal
        note={editingNote}
        onClose={() => setEditingNote(null)}
        onSave={handleUpdateNote}
        groups={groups ?? []}
        userId={user.uid}
        privateKey={privateKey}
      />}

      {/* View Modal */}
      {viewingNote && <ViewNoteModal
        note={viewingNote}
        groups={groups ?? []}
        onClose={() => setViewingNote(null)}
        onEdit={(note) => { setViewingNote(null); setEditingNote(note); }}
        userId={user.uid}
        privateKey={privateKey}
        pinned={viewingNote ? pinnedIds.has(viewingNote.id) : false}
        onTogglePin={(id) => void togglePin(id)}
        onTrash={viewingNote && viewingNote.authorId === user.uid ? (note) => { setViewingNote(null); void trashNote(note.id); } : undefined}
      />}

      {/* Manage Group Modal */}
      {currentGroup && (
        <ManageGroupModal
          group={managingGroup}
          allNotes={allNotes}
          groupNoteIds={groupNoteIds}
          userId={user.uid}
          onClose={() => setManagingGroup(null)}
          onDeleted={() => { setManagingGroup(null); router.push("/groups"); }}
        />
      )}
    </>
  );
}
