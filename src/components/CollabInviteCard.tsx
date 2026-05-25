"use client";

import { motion } from "framer-motion";
import { type CollabInvite } from "../lib/validations";
import { Check, X, Lock } from "lucide-react";
import { useState } from "react";

interface CollabInviteCardProps {
  invite: CollabInvite;
  onAccept: (inviteId: string) => Promise<void>;
  onReject: (inviteId: string) => Promise<void>;
}

export function CollabInviteCard({ invite, onAccept, onReject }: CollabInviteCardProps) {
  const [loading, setLoading] = useState(false);

  const handleAccept = async () => {
    setLoading(true);
    try { await onAccept(invite.id); } finally { setLoading(false); }
  };

  const handleReject = async () => {
    setLoading(true);
    try { await onReject(invite.id); } finally { setLoading(false); }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="glass neubrutal rounded-[var(--radius-xl)] p-5 flex items-center gap-4"
    >
      <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center shrink-0">
        <Lock size={18} className="text-emerald-600" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm">Encrypted note from {invite.senderName}</p>
        <p className="text-xs text-foreground/45 mt-0.5">
          Permission: <span className="font-semibold capitalize">{invite.permission}</span>
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={handleAccept}
          disabled={loading}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-emerald-500 hover:bg-emerald-600 transition-colors disabled:opacity-50"
        >
          <Check size={14} /> Accept
        </button>
        <button
          onClick={handleReject}
          disabled={loading}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-foreground/60 bg-border/40 hover:bg-border/60 transition-colors disabled:opacity-50"
        >
          <X size={14} /> Decline
        </button>
      </div>
    </motion.div>
  );
}
