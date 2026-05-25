"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { type FriendRequest } from "../lib/validations";
import { Check, X, Clock } from "lucide-react";

interface FriendRequestCardProps {
  request: FriendRequest;
  /** "incoming" = show accept/reject, "outgoing" = show status */
  direction: "incoming" | "outgoing";
  onAccept?: (requestId: string) => Promise<void>;
  onReject?: (requestId: string) => Promise<void>;
}

export function FriendRequestCard({
  request,
  direction,
  onAccept,
  onReject,
}: FriendRequestCardProps) {
  const [loading, setLoading] = useState(false);

  const displayName = direction === "incoming" ? request.senderName : request.receiverName;
  const displayEmail = direction === "incoming" ? request.senderEmail : request.receiverEmail;
  const displayPhoto = direction === "incoming" ? request.senderPhoto : request.receiverPhoto;

  const handleAccept = async () => {
    if (!onAccept) return;
    setLoading(true);
    try {
      await onAccept(request.id);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    if (!onReject) return;
    setLoading(true);
    try {
      await onReject(request.id);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="glass neubrutal rounded-[var(--radius-xl)] p-5 flex items-center gap-4"
    >
      {/* Avatar */}
      <div className="w-11 h-11 rounded-full bg-primary/10 flex items-center justify-center text-lg font-bold text-primary shrink-0 overflow-hidden">
        {displayPhoto ? (
          <img src={displayPhoto} alt={displayName} className="w-full h-full object-cover rounded-full" />
        ) : (
          displayName?.charAt(0)?.toUpperCase() || "?"
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm truncate">{displayName}</p>
        <p className="text-xs text-foreground/45 truncate">{displayEmail}</p>
      </div>

      {/* Actions */}
      {direction === "incoming" ? (
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleAccept}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-accent hover:bg-accent/90 transition-colors disabled:opacity-50"
          >
            <Check size={14} />
            Accept
          </button>
          <button
            onClick={handleReject}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-foreground/60 bg-border/40 hover:bg-border/60 transition-colors disabled:opacity-50"
          >
            <X size={14} />
            Decline
          </button>
        </div>
      ) : (
        <div className="shrink-0">
          {request.status === "pending" && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-200">
              <Clock size={12} />
              Pending
            </span>
          )}
          {request.status === "accepted" && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200">
              <Check size={12} />
              Accepted
            </span>
          )}
          {request.status === "rejected" && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold text-red-500 bg-red-50 border border-red-200">
              <X size={12} />
              Declined
            </span>
          )}
        </div>
      )}
    </motion.div>
  );
}
