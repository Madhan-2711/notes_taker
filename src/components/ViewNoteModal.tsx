"use client";

import { type Note, type Group } from "../lib/validations";
import { motion, AnimatePresence } from "framer-motion";
import { X, Pencil, Clock, CalendarDays } from "lucide-react";

interface ViewNoteModalProps {
  note: Note | null;
  groups?: Group[];
  onClose: () => void;
  onEdit?: (note: Note) => void;
}

export function ViewNoteModal({ note, groups = [], onClose, onEdit }: ViewNoteModalProps) {
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

          {/* Modal Panel — wider + taller */}
          <motion.div
            key="view-modal-panel"
            initial={{ opacity: 0, scale: 0.97, y: 28 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 28 }}
            transition={{ type: "spring", stiffness: 300, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
            className="relative bg-white neubrutal rounded-[var(--radius-xl)] w-full max-w-3xl h-[90vh] flex flex-col shadow-2xl overflow-hidden"
          >
            {/* Top bar — compact action row */}
            <div className="flex items-center justify-between gap-3 px-8 pt-6 pb-4 border-b border-border/30 shrink-0">
              {/* Group badges */}
              <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
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
                {noteGroups.length === 0 && (
                  <span className="text-xs text-foreground/30 font-medium">No group</span>
                )}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {onEdit && (
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
                {note.title}
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

              {/* Divider */}
              <div className="h-px bg-border/40 mb-8" />

              {/* Content — larger, more readable */}
              <p className="text-foreground/85 leading-[1.85] whitespace-pre-wrap break-words text-lg">
                {note.content}
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
