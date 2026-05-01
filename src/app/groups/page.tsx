"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "../../hooks/useAuth";
import { db, hasValidConfig } from "../../lib/firebaseConfig";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { type Note, type Group } from "../../lib/validations";
import { deleteGroup } from "../../lib/groupsService";
import { GroupCard } from "../../components/GroupCard";
import { CreateGroupModal } from "../../components/CreateGroupModal";
import { ManageGroupModal } from "../../components/ManageGroupModal";
import { AnimatePresence, motion } from "framer-motion";
import { FolderPlus, Layers } from "lucide-react";

export default function GroupsPage() {
  const { user, loading } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [managingGroup, setManagingGroup] = useState<Group | null>(null);

  // Subscribe to notes
  useEffect(() => {
    if (!user || !hasValidConfig) { setNotes([]); return; }
    const q = query(collection(db, "notes"), where("authorId", "==", user.uid));
    const unsub = onSnapshot(q, (snap) => {
      setNotes(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Note[]);
    });
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

  // Map groupId → notes belonging to it
  const notesByGroup = useMemo(() => {
    const map: Record<string, Note[]> = {};
    groups.forEach((g) => {
      map[g.id] = notes.filter((n) => n.groupIds?.includes(g.id));
    });
    return map;
  }, [groups, notes]);

  const handleDeleteGroup = async (group: Group) => {
    if (!user) return;
    await deleteGroup(group.id, user.uid);
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
        <p className="text-foreground/60 text-lg">Please sign in to manage groups.</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex-1 max-w-3xl mx-auto w-full p-6 mt-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between gap-4 mb-8"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Layers size={20} className="text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Groups</h1>
              <p className="text-sm text-foreground/40">
                {groups.length} {groups.length === 1 ? "group" : "groups"} · {notes.length} notes
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowCreate(true)}
            className="bg-primary text-primary-foreground neubrutal px-5 py-2.5 rounded-[var(--radius-xl)] font-bold text-sm flex items-center gap-2 hover:bg-primary/90 transition-colors"
          >
            <FolderPlus size={16} />
            Create Group
          </button>
        </motion.div>

        {/* Groups list */}
        {groups.length > 0 ? (
          <div className="space-y-4">
            <AnimatePresence>
              {groups.map((group) => (
                <GroupCard
                  key={group.id}
                  group={group}
                  notes={notesByGroup[group.id] ?? []}
                  onManage={() => setManagingGroup(group)}
                  onDelete={() => handleDeleteGroup(group)}
                />
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="py-24 text-center text-foreground/40 font-medium flex flex-col items-center gap-5"
          >
            <div className="w-20 h-20 border-2 border-dashed border-border rounded-full flex items-center justify-center">
              <Layers size={28} className="text-foreground/20" />
            </div>
            <div>
              <p className="text-base font-semibold text-foreground/50">No groups yet</p>
              <p className="text-sm mt-1">Create a group to organise your notes.</p>
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="bg-primary text-primary-foreground neubrutal px-6 py-2.5 rounded-[var(--radius-xl)] font-bold text-sm flex items-center gap-2 hover:bg-primary/90 transition-colors"
            >
              <FolderPlus size={16} />
              Create Your First Group
            </button>
          </motion.div>
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
        groupNoteIds={managingGroup ? (notesByGroup[managingGroup.id] ?? []).map((n) => n.id) : []}
        userId={user.uid}
        onClose={() => setManagingGroup(null)}
        onDeleted={() => setManagingGroup(null)}
      />
    </>
  );
}
