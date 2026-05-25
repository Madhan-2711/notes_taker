"use client";

import { useState, useEffect } from "react";
import {
  type Note,
  type Group,
  isNormalNote,
  isSecureNote,
  isCollabNote,
  getNoteTitle,
  getNoteContent,
} from "../lib/validations";
import { ModeBadge } from "./ModeBadge";
import { readSecureNote } from "../lib/services/notes/secureNotesService";
import { motion, AnimatePresence } from "framer-motion";
import { X, Pencil, Clock, CalendarDays, Lock, Users, Loader2 } from "lucide-react";

interface ViewNoteModalProps {
  note: Note | null;
  groups?: Group[];
  onClose: () => void;
  onEdit?: (note: Note) => void;
  /** Current user's ID for decryption */
  userId?: string;
  /** User's private key for decrypting secure notes */
  privateKey?: CryptoKey | null;
}

export function ViewNoteModal({
  note,
  groups = [],
  onClose,
  onEdit,
  userId,
  privateKey,
}: ViewNoteModalProps) {
  const [decryptedTitle, setDecryptedTitle] = useState<string | null>(null);
  const [decryptedContent, setDecryptedContent] = useState<string | null>(null);
  const [decrypting, setDecrypting] = useState(false);
  const [decryptError, setDecryptError] = useState<string | null>(null);

  // Decrypt secure notes on open
  useEffect(() => {
    if (!note || !isSecureNote(note)) {
      setDecryptedTitle(null);
      setDecryptedContent(null);
      setDecryptError(null);
      return;
    }

    if (!userId || !privateKey) {
      setDecryptError("Encryption keys not available. Please set up your vault password.");
      return;
    }

    let cancelled = false;
    setDecrypting(true);
    setDecryptError(null);

    readSecureNote(note.id, userId, privateKey)
      .then(({ title, content }) => {
        if (!cancelled) {
          setDecryptedTitle(title);
          setDecryptedContent(content);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setDecryptError(err instanceof Error ? err.message : "Failed to decrypt note");
        }
      })
      .finally(() => {
        if (!cancelled) setDecrypting(false);
      });

    return () => { cancelled = true; };
  }, [note, userId, privateKey]);

  if (!note) return null;

  const createdDate = new Date(note.createdAt).toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const createdTime = new Date(note.createdAt).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });

  const updatedDate =
    note.updatedAt !== note.createdAt
      ? new Date(note.updatedAt).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : null;

  const noteGroups = groups.filter((g) => note.groupIds?.includes(g.id));

  const displayTitle = isSecureNote(note)
    ? (decryptedTitle || getNoteTitle(note))
    : getNoteTitle(note);

  // Allow editing for normal notes AND decrypted secure notes
  const canEdit = isNormalNote(note) || (isSecureNote(note) && !!decryptedTitle);

  return (
    <AnimatePresence>
      {note && (
        <motion.div
          key="view-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
          onClick={onClose}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

          {/* Modal Panel */}
          <motion.div
            key="view-modal-panel"
            initial={{ opacity: 0, scale: 0.97, y: 28 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 28 }}
            transition={{ type: "spring" as const, stiffness: 300, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
            className="relative bg-white neubrutal rounded-[var(--radius-xl)] w-full max-w-3xl h-[90vh] flex flex-col shadow-2xl overflow-hidden"
          >
            {/* Top bar */}
            <div className="flex items-center justify-between gap-3 px-8 pt-6 pb-4 border-b border-border/30 shrink-0">
              <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                <ModeBadge mode={note.mode || "normal"} />
                {noteGroups.map((g) => (
                  <span
                    key={g.id}
                    className="text-xs font-semibold tracking-wide px-3 py-1 rounded-full border"
                    style={{
                      backgroundColor: g.color + "18",
                      borderColor: g.color + "40",
                      color: g.color,
                    }}
                  >
                    {g.title}
                  </span>
                ))}
                {noteGroups.length === 0 && isNormalNote(note) && (
                  <span className="text-xs text-foreground/30 font-medium">No group</span>
                )}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {onEdit && canEdit && (
                  <button
                    onClick={() => { onEdit(note); onClose(); }}
                    className="flex items-center gap-2 text-sm font-semibold text-foreground/60 hover:text-primary bg-transparent hover:bg-primary/8 px-4 py-2 rounded-xl transition-colors"
                    aria-label="Edit note"
                  >
                    <Pencil size={15} />
                    Edit
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="text-foreground/40 hover:text-foreground bg-transparent hover:bg-border/50 p-2 rounded-xl transition-colors"
                  aria-label="Close"
                >
                  <X size={22} />
                </button>
              </div>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto px-8 py-7">
              {/* Title */}
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight break-words mb-4">
                {displayTitle}
              </h2>

              {/* Metadata */}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mb-8 text-sm text-foreground/40 font-medium">
                <span className="flex items-center gap-1.5">
                  <CalendarDays size={14} />
                  {createdDate} &middot; {createdTime}
                </span>
                {updatedDate && (
                  <span className="flex items-center gap-1.5">
                    <Clock size={14} />
                    Edited {updatedDate}
                  </span>
                )}
              </div>

              <div className="h-px bg-border/40 mb-8" />

              {/* Content — mode-aware rendering */}
              {isSecureNote(note) ? (
                decrypting ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <Loader2 size={28} className="text-indigo-500 animate-spin" />
                    <p className="text-sm text-foreground/50 font-medium">Decrypting...</p>
                  </div>
                ) : decryptError ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center">
                      <Lock size={28} className="text-red-500" />
                    </div>
                    <div>
                      <p className="text-lg font-semibold text-foreground/80">Decryption Failed</p>
                      <p className="text-sm text-foreground/45 mt-1 max-w-sm">{decryptError}</p>
                    </div>
                  </div>
                ) : decryptedContent ? (
                  <p className="text-foreground/85 leading-[1.85] whitespace-pre-wrap break-words text-lg">
                    {decryptedContent}
                  </p>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center">
                      <Lock size={28} className="text-indigo-500" />
                    </div>
                    <p className="text-sm text-foreground/45">Encrypted content</p>
                  </div>
                )
              ) : isCollabNote(note) ? (
                <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center">
                    <Users size={28} className="text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-foreground/80">Collaborative Note</p>
                    <p className="text-sm text-foreground/45 mt-1 max-w-sm">
                      Open the collaborative editor to view and edit this note in real-time.
                    </p>
                  </div>
                  <button
                    className="mt-2 bg-emerald-500 text-white font-bold text-sm px-6 py-2.5 rounded-xl hover:bg-emerald-600 transition-colors"
                    disabled
                  >
                    Open Editor (Coming Soon)
                  </button>
                </div>
              ) : (
                <p className="text-foreground/85 leading-[1.85] whitespace-pre-wrap break-words text-lg">
                  {getNoteContent(note)}
                </p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
