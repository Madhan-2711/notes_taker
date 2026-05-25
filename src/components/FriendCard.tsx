"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { type UserProfile } from "../lib/validations";
import { Trash2 } from "lucide-react";

interface FriendCardProps {
  friend: UserProfile & { friendDocId: string };
  onRemove: (friendDocId: string) => Promise<void>;
}

export function FriendCard({ friend, onRemove }: FriendCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [removing, setRemoving] = useState(false);

  const handleRemove = async () => {
    if (confirmDelete) {
      setRemoving(true);
      try {
        await onRemove(friend.friendDocId);
      } finally {
        setRemoving(false);
        setConfirmDelete(false);
      }
    } else {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="glass neubrutal rounded-[var(--radius-xl)] p-5 flex items-center gap-4 group"
    >
      {/* Avatar */}
      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-lg font-bold text-primary shrink-0 overflow-hidden">
        {friend.photoURL ? (
          <img src={friend.photoURL} alt={friend.displayName} className="w-full h-full object-cover rounded-full" />
        ) : (
          friend.displayName?.charAt(0)?.toUpperCase() || "?"
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm truncate">{friend.displayName}</p>
        <p className="text-xs text-foreground/45 truncate">{friend.email}</p>
      </div>

      {/* Remove */}
      <button
        onClick={handleRemove}
        disabled={removing}
        className={`shrink-0 p-2 rounded-xl transition-all sm:opacity-0 sm:group-hover:opacity-100 ${
          confirmDelete
            ? "text-white bg-red-500 hover:bg-red-600"
            : "text-foreground/40 hover:text-red-500 hover:bg-red-50"
        }`}
        aria-label={confirmDelete ? "Confirm remove" : "Remove friend"}
      >
        <Trash2 size={16} />
      </button>

      {confirmDelete && (
        <span className="absolute -bottom-6 left-0 text-xs text-red-500 font-medium animate-pulse">
          Tap again to remove
        </span>
      )}
    </motion.div>
  );
}
