"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { type FriendRequest } from "../lib/validations";
import { Check, X, Clock, Loader2 } from "lucide-react";
import { Avatar } from "./Avatar";

interface FriendRequestCardProps {
  request: FriendRequest;
  /** "incoming" = show accept/reject, "outgoing" = show status */
  direction: "incoming" | "outgoing";
  onAccept?: (requestId: string) => Promise<void>;
  onReject?: (requestId: string) => Promise<void>;
}

const STATUS = {
  pending: { label: "Pending", icon: Clock, tone: "border-amber-300 bg-amber-50 text-amber-900" },
  accepted: { label: "Accepted", icon: Check, tone: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  rejected: { label: "Declined", icon: X, tone: "border-red-200 bg-red-50 text-red-800" },
} as const;

export function FriendRequestCard({
  request,
  direction,
  onAccept,
  onReject,
}: FriendRequestCardProps) {
  const reduceMotion = useReducedMotion();
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);
  const [error, setError] = useState("");

  const displayName = direction === "incoming" ? request.senderName : request.receiverName;
  const displayEmail = direction === "incoming" ? request.senderEmail : request.receiverEmail;
  const displayPhoto = direction === "incoming" ? request.senderPhoto : request.receiverPhoto;

  const run = async (kind: "accept" | "decline", action?: (id: string) => Promise<void>) => {
    if (!action) return;
    setBusy(kind);
    setError("");
    try {
      await action(request.id);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That didn't work. Please try again.");
    } finally {
      setBusy(null);
    }
  };

  const status = STATUS[request.status as keyof typeof STATUS];

  return (
    <motion.li
      layout={!reduceMotion}
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="py-4 first:pt-0 last:pb-0"
    >
      <div className="flex flex-wrap items-center gap-3 sm:flex-nowrap">
        <Avatar name={displayName} photoURL={displayPhoto} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-slate-900">{displayName}</p>
          <p className="truncate text-sm text-slate-600">{displayEmail}</p>
        </div>

        {direction === "incoming" ? (
          <div className="flex w-full shrink-0 gap-2 sm:w-auto">
            <button type="button" onClick={() => void run("accept", onAccept)} disabled={busy !== null} className="btn-primary flex-1 sm:flex-none">
              {busy === "accept" ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Check size={15} aria-hidden="true" />} Accept
            </button>
            <button type="button" onClick={() => void run("decline", onReject)} disabled={busy !== null} className="btn-secondary flex-1 sm:flex-none">
              {busy === "decline" ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <X size={15} aria-hidden="true" />} Decline
            </button>
          </div>
        ) : status && (
          <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${status.tone}`}>
            <status.icon size={12} aria-hidden="true" /> {status.label}
          </span>
        )}
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    </motion.li>
  );
}
