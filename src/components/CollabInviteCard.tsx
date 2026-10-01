"use client";

import { motion, useReducedMotion } from "framer-motion";
import { type CollabInvite } from "../lib/validations";
import { Check, X, Users, Loader2 } from "lucide-react";
import { useState } from "react";

interface CollabInviteCardProps {
  invite: CollabInvite;
  onAccept: (inviteId: string) => Promise<void>;
  onReject: (inviteId: string) => Promise<void>;
  /** False while the vault is locked; accepting needs the private key. */
  canAccept?: boolean;
}

export function CollabInviteCard({ invite, onAccept, onReject, canAccept = true }: CollabInviteCardProps) {
  const reduceMotion = useReducedMotion();
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);
  const [error, setError] = useState("");

  const run = async (kind: "accept" | "decline", action: (id: string) => Promise<void>) => {
    setBusy(kind);
    setError("");
    try { await action(invite.id); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "That didn't work. Please try again."); }
    finally { setBusy(null); }
  };

  return (
    <motion.li
      layout={!reduceMotion}
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="py-4 first:pt-0 last:pb-0"
    >
      <div className="flex flex-wrap items-center gap-3 sm:flex-nowrap">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700" aria-hidden="true">
          <Users size={19} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-900">{invite.senderName || invite.senderEmail} shared a note</p>
          <p className="text-sm text-slate-600">Encrypted, {invite.permission === "viewer" ? "you can view" : "you can edit"}</p>
        </div>
        <div className="flex w-full shrink-0 gap-2 sm:w-auto">
          <button type="button" onClick={() => void run("accept", onAccept)} disabled={busy !== null || !canAccept} className="btn-primary flex-1 sm:flex-none">
            {busy === "accept" ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Check size={15} aria-hidden="true" />} Accept
          </button>
          <button type="button" onClick={() => void run("decline", onReject)} disabled={busy !== null} className="btn-secondary flex-1 sm:flex-none">
            {busy === "decline" ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <X size={15} aria-hidden="true" />} Decline
          </button>
        </div>
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    </motion.li>
  );
}
