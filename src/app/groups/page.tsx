"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "../../hooks/useAuth";
import { db, hasValidConfig } from "../../lib/firebaseConfig";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { type Note, type Group } from "../../lib/validations";
import { GroupCard } from "../../components/GroupCard";
import { CreateGroupModal } from "../../components/CreateGroupModal";
import { ManageGroupModal } from "../../components/ManageGroupModal";
import { PageHeader } from "../../components/PageHeader";
import { EmptyState, PageLoading, SignInRequired } from "../../components/PageState";
import { AnimatePresence } from "framer-motion";
import { FolderPlus, Layers } from "lucide-react";

export default function GroupsPage() {
  const { user, loading } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [managingGroup, setManagingGroup] = useState<Group | null>(null);

  // Subscribe to notes
  useEffect(() => {
    if (!user || !hasValidConfig) return;
    const q = query(collection(db, "notes"), where("authorId", "==", user.uid));
    const unsub = onSnapshot(q, (snap) => {
      setNotes((snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Note[]).filter((note) => !note.deletedAt));
    });
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

  // Map groupId → notes belonging to it
  const notesByGroup = useMemo(() => {
    const map: Record<string, Note[]> = {};
    (groups ?? []).forEach((g) => {
      map[g.id] = notes.filter((n) => n.groupIds?.includes(g.id));
    });
    return map;
  }, [groups, notes]);

  // Stable between renders so the Manage dialog doesn't reset the user's unsaved edits.
  const managingNoteIds = useMemo(
    () => managingGroup ? (notesByGroup[managingGroup.id] ?? []).map((n) => n.id) : [],
    [managingGroup, notesByGroup]
  );

  if (loading) return <PageLoading cards={3} label="Loading groups" />;
  if (!user) return <SignInRequired>Sign in to manage groups.</SignInRequired>;

  const createButton = (
    <button type="button" onClick={() => setShowCreate(true)} className="btn-primary">
      <FolderPlus size={16} aria-hidden="true" /> Create group
    </button>
  );

  return (
    <>
      <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <PageHeader
          title="Groups"
          subtitle={groups === null ? "Loading…" : `${groups.length} ${groups.length === 1 ? "group" : "groups"}, ${notes.length} ${notes.length === 1 ? "note" : "notes"}`}
          actions={groups && groups.length > 0 ? createButton : undefined}
        />

        {groups === null ? (
          <div className="space-y-4" aria-busy="true" aria-label="Loading groups">
            {[0, 1, 2].map((index) => <div key={index} className="h-20 animate-pulse rounded-card border border-slate-200 bg-white" />)}
          </div>
        ) : groups.length > 0 ? (
          <div className="space-y-4">
            <AnimatePresence>
              {groups.map((group) => (
                <GroupCard
                  key={group.id}
                  group={group}
                  notes={notesByGroup[group.id] ?? []}
                  onManage={() => setManagingGroup(group)}
                />
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <EmptyState
            icon={<Layers size={22} />}
            title="No groups yet"
            description="Groups keep related notes together, like a project or a class."
            action={createButton}
          />
        )}
      </div>

      {/* Create Group Modal */}
      <CreateGroupModal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        notes={notes}
        userId={user.uid}
      />

      {/* Manage Group Modal */}
      <ManageGroupModal
        group={managingGroup}
        allNotes={notes}
        groupNoteIds={managingNoteIds}
        userId={user.uid}
        onClose={() => setManagingGroup(null)}
        onDeleted={() => setManagingGroup(null)}
      />
    </>
  );
}
