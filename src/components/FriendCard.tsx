"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { type UserProfile } from "../lib/validations";
import { UserMinus } from "lucide-react";
import { Avatar } from "./Avatar";
import { Menu } from "./ui/Menu";
import { ConfirmDialog } from "./ui/ConfirmDialog";

interface FriendCardProps {
  friend: UserProfile & { friendDocId: string };
  onRemove: (friendDocId: string) => Promise<void>;
}

export function FriendCard({ friend, onRemove }: FriendCardProps) {
  const reduceMotion = useReducedMotion();
  const [confirming, setConfirming] = useState(false);
  const name = friend.displayName || "Friend";

  return (
    <motion.li
      layout={!reduceMotion}
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 pl-4"
    >
      <Avatar name={name} photoURL={friend.photoURL} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold text-slate-900">{name}</p>
        {friend.email && <p className="truncate text-sm text-slate-600">{friend.email}</p>}
      </div>
      <Menu
        label={`More actions for ${name}`}
        items={[{ label: "Remove friend", icon: UserMinus, destructive: true, onSelect: () => setConfirming(true) }]}
      />
      <ConfirmDialog
        open={confirming}
        title={`Remove ${name}?`}
        description="You'll stop seeing each other in your friends lists. Shared notes stay shared until you change who has access."
        confirmLabel="Remove friend"
        destructive
        onConfirm={async () => { await onRemove(friend.friendDocId); setConfirming(false); }}
        onCancel={() => setConfirming(false)}
      />
    </motion.li>
  );
}
