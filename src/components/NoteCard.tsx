"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  type Note,
  type Group,
  isSecureNote,
  isCollabNote,
  getNoteTitle,
  getNoteContent,
} from "../lib/validations";
import { ModeBadge } from "./ModeBadge";
import { Trash2, Pencil, Eye, Users } from "lucide-react";
import { useRouter } from "next/navigation";

interface NoteCardProps {
  note: Note;
  groups?: Group[];
  onDelete: (id: string) => void;
  onEdit?: (note: Note) => void;
  onView?: (note: Note) => void;
}

export function NoteCard({ note, groups = [], onDelete, onEdit, onView }: NoteCardProps) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);

  // Derive groups this note belongs to
  const noteGroups = groups.filter((g) => note.groupIds?.includes(g.id));

  const handleDelete = () => {
    if (confirmDelete) {
      onDelete(note.id);
      setConfirmDelete(false);
    } else {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
    }
  };

  // Display title — encrypted notes show a placeholder
  const displayTitle = getNoteTitle(note);

  // Display content — encrypted notes show a placeholder, collab notes show collaborator info
  const displayContent = isSecureNote(note)
    ? "This note is end-to-end encrypted. Open to decrypt and view."
    : isCollabNote(note)
    ? getNoteContent(note)
    : getNoteContent(note);

  // Disable edit for collab notes (those use the Yjs editor)
  const canEdit = !isCollabNote(note);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -5 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="glass neubrutal rounded-[var(--radius-xl)] p-6 relative group flex flex-col gap-3 min-h-[160px] cursor-pointer"
      onClick={() => {
        if (isCollabNote(note)) {
          router.push(`/collab/${note.id}`);
        } else {
          onView?.(note);
        }
      }}
    >
      <div className="flex justify-between items-start gap-4">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <h3 className="font-bold text-lg leading-tight truncate font-sans flex-1">
            {displayTitle}
          </h3>
          <ModeBadge mode={note.mode || "normal"} compact />
        </div>
        {/* Always visible on mobile, hover-reveal on desktop */}
        <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
          {onView && (
            <button
              onClick={(e) => { e.stopPropagation(); onView(note); }}
              className="text-foreground/50 hover:text-accent transition-colors p-2 rounded-lg hover:bg-accent/10"
              aria-label="View note"
            >
              <Eye size={16} />
            </button>
          )}
          {onEdit && canEdit && (
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(note); }}
              className="text-foreground/50 hover:text-primary transition-colors p-2 rounded-lg hover:bg-primary/10"
              aria-label="Edit note"
            >
              <Pencil size={16} />
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); handleDelete(); }}
            className={`transition-colors p-2 rounded-lg ${
              confirmDelete
                ? "text-white bg-red-500 hover:bg-red-600"
                : "text-foreground/50 hover:text-red-500 hover:bg-red-50"
            }`}
            aria-label={confirmDelete ? "Confirm delete" : "Delete note"}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {confirmDelete && (
        <div className="text-xs text-red-500 font-medium animate-pulse">
          Tap again to delete
        </div>
      )}

      <p className="text-foreground/70 text-sm flex-1 whitespace-pre-wrap break-words line-clamp-6">
        {displayContent}
      </p>

      {/* Collab collaborator count */}
      {isCollabNote(note) && note.collaboratorIds?.length > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-semibold">
          <Users size={12} />
          {note.collaboratorIds.length} collaborator{note.collaboratorIds.length !== 1 ? "s" : ""}
        </div>
      )}

      {/* Footer: date + group badges */}
      <div className="flex items-center justify-between gap-2 mt-2 flex-wrap">
        <div className="text-xs text-foreground/40 font-mono shrink-0">
          {new Date(note.createdAt).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
        {noteGroups.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {noteGroups.slice(0, 2).map((g) => (
              <span
                key={g.id}
                className="text-xs font-semibold px-2 py-0.5 rounded-full border"
                style={{
                  backgroundColor: g.color + "18",
                  borderColor: g.color + "40",
                  color: g.color,
                }}
              >
                {g.title}
              </span>
            ))}
            {noteGroups.length > 2 && (
              <span className="text-xs font-semibold text-foreground/40">
                +{noteGroups.length - 2}
              </span>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
