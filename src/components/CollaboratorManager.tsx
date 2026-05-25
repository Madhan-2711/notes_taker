"use client";

import { useState, useEffect } from "react";
import { type UserProfile } from "../lib/validations";
import { getCollaborators, revokeAccess } from "../lib/services/social/collaborationService";
import { getFriends } from "../lib/services/social/friendsService";
import { motion, AnimatePresence } from "framer-motion";
import { X, UserPlus, Trash2, Shield } from "lucide-react";

interface CollaboratorManagerProps {
  noteId: string;
  userId: string;
  isOpen: boolean;
  onClose: () => void;
  /** Called when user selects a friend to invite */
  onInvite: (friendUid: string, friendName: string, permission: "viewer" | "editor") => Promise<void>;
}

export function CollaboratorManager({
  noteId,
  userId,
  isOpen,
  onClose,
  onInvite,
}: CollaboratorManagerProps) {
  const [collaborators, setCollaborators] = useState<UserProfile[]>([]);
  const [friends, setFriends] = useState<(UserProfile & { friendDocId: string })[]>([]);
  const [inviting, setInviting] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<string | null>(null);
  const [permission, setPermission] = useState<"viewer" | "editor">("editor");
  const [showInviteForm, setShowInviteForm] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    loadData();
  }, [isOpen, noteId, userId]);

  const loadData = async () => {
    const [collabs, friendsList] = await Promise.all([
      getCollaborators(noteId),
      getFriends(userId),
    ]);
    setCollaborators(collabs);
    setFriends(friendsList);
  };

  const handleInvite = async () => {
    if (!selectedFriend) return;
    const friend = friends.find((f) => f.uid === selectedFriend);
    if (!friend) return;

    setInviting(true);
    try {
      await onInvite(friend.uid, friend.displayName, permission);
      setSelectedFriend(null);
      setShowInviteForm(false);
      await loadData();
    } finally {
      setInviting(false);
    }
  };

  const handleRevoke = async (collaboratorId: string) => {
    await revokeAccess(noteId, collaboratorId);
    await loadData();
  };

  // Friends who aren't already collaborators
  const availableFriends = friends.filter(
    (f) => !collaborators.some((c) => c.uid === f.uid) && f.uid !== userId
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring" as const, stiffness: 300, damping: 25 }}
            onClick={(e) => e.stopPropagation()}
            className="relative bg-white neubrutal rounded-[var(--radius-xl)] p-8 w-full max-w-lg flex flex-col gap-5 shadow-xl max-h-[80vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Shield size={18} className="text-emerald-500" />
                <h2 className="text-lg font-bold tracking-tight">Collaborators</h2>
              </div>
              <button onClick={onClose} className="text-foreground/40 hover:text-foreground p-1">
                <X size={20} />
              </button>
            </div>

            {/* Current collaborators */}
            {collaborators.length > 0 ? (
              <div className="space-y-2">
                {collaborators.map((collab) => (
                  <div key={collab.uid} className="flex items-center gap-3 p-3 rounded-xl bg-border/20">
                    <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center text-xs font-bold text-emerald-700 shrink-0">
                      {collab.displayName?.charAt(0)?.toUpperCase() || "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{collab.displayName}</p>
                      <p className="text-xs text-foreground/40 truncate">{collab.email}</p>
                    </div>
                    <button
                      onClick={() => handleRevoke(collab.uid)}
                      className="text-foreground/40 hover:text-red-500 p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-foreground/40 text-center py-4">
                No collaborators yet. Invite a friend to get started.
              </p>
            )}

            {/* Invite form */}
            {showInviteForm ? (
              <div className="border-t border-border/30 pt-4 space-y-3">
                <p className="text-xs font-medium tracking-widest uppercase text-foreground/40">
                  Invite a Friend
                </p>

                {availableFriends.length > 0 ? (
                  <>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {availableFriends.map((friend) => (
                        <button
                          key={friend.uid}
                          type="button"
                          onClick={() => setSelectedFriend(friend.uid)}
                          className={`w-full flex items-center gap-3 p-3 rounded-xl text-left transition-all ${
                            selectedFriend === friend.uid
                              ? "bg-emerald-50 border-2 border-emerald-300"
                              : "bg-border/20 border-2 border-transparent hover:border-border/60"
                          }`}
                        >
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                            {friend.displayName?.charAt(0)?.toUpperCase() || "?"}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold truncate">{friend.displayName}</p>
                            <p className="text-xs text-foreground/40 truncate">{friend.email}</p>
                          </div>
                        </button>
                      ))}
                    </div>

                    {/* Permission selector */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-foreground/40">Permission:</span>
                      {(["editor", "viewer"] as const).map((p) => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setPermission(p)}
                          className={`px-3 py-1 rounded-full text-xs font-semibold border transition-all ${
                            permission === p
                              ? "bg-emerald-500 text-white border-emerald-500"
                              : "bg-transparent text-foreground/50 border-border/60 hover:border-emerald-300"
                          }`}
                        >
                          {p.charAt(0).toUpperCase() + p.slice(1)}
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={handleInvite}
                      disabled={!selectedFriend || inviting}
                      className="w-full bg-emerald-500 text-white font-bold text-sm py-2.5 rounded-xl hover:bg-emerald-600 transition-colors disabled:opacity-40"
                    >
                      {inviting ? "Sending invite..." : "Send Invite"}
                    </button>
                  </>
                ) : (
                  <p className="text-sm text-foreground/40 text-center py-4">
                    All your friends are already collaborators.
                  </p>
                )}
              </div>
            ) : (
              <button
                onClick={() => setShowInviteForm(true)}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl border-2 border-dashed border-border/50 text-sm font-semibold text-foreground/50 hover:text-emerald-500 hover:border-emerald-300 transition-colors"
              >
                <UserPlus size={16} />
                Invite a Friend
              </button>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
