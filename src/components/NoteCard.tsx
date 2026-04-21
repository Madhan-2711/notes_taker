"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { type Note } from "../lib/validations";
import { Trash2, Pencil } from "lucide-react";

interface NoteCardProps {
  note: Note;
  onDelete: (id: string) => void;
  onEdit?: (note: Note) => void;
}

export function NoteCard({ note, onDelete, onEdit }: NoteCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDelete = () => {
    if (confirmDelete) {
      onDelete(note.id);
      setConfirmDelete(false);
    } else {
      setConfirmDelete(true);
      // Auto-cancel after 3 seconds
      setTimeout(() => setConfirmDelete(false), 3000);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -5 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="glass neubrutal rounded-[var(--radius-xl)] p-6 relative group flex flex-col gap-3 min-h-[160px]"
    >
      <div className="flex justify-between items-start gap-4">
        <h3 className="font-bold text-lg leading-tight truncate font-sans flex-1">
          {note.title}
        </h3>
        {/* Always visible on mobile, hover-reveal on desktop */}
        <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
          {onEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit(note);
              }}
              className="text-foreground/50 hover:text-primary transition-colors p-2 rounded-lg hover:bg-primary/10"
              aria-label="Edit note"
            >
              <Pencil size={16} />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDelete();
            }}
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

      {/* Confirm delete message */}
      {confirmDelete && (
        <div className="text-xs text-red-500 font-medium animate-pulse">
          Tap again to delete
        </div>
      )}

      <p className="text-foreground/70 text-sm flex-1 whitespace-pre-wrap break-words line-clamp-6">
        {note.content}
      </p>
      <div className="text-xs text-foreground/40 mt-2 font-mono">
        {new Date(note.createdAt).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </div>
    </motion.div>
  );
}
