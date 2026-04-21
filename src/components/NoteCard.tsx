"use client";

import { motion } from "framer-motion";
import { type Note } from "../lib/validations";
import { Trash2, Pencil } from "lucide-react";

interface NoteCardProps {
  note: Note;
  onDelete: (id: string) => void;
  onEdit?: (note: Note) => void;
}

export function NoteCard({ note, onDelete, onEdit }: NoteCardProps) {
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
        <h3 className="font-bold text-lg leading-tight truncate font-sans">
          {note.title}
        </h3>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onEdit && (
            <button
              onClick={() => onEdit(note)}
              className="text-foreground/40 hover:text-primary transition-colors p-1"
              aria-label="Edit note"
            >
              <Pencil size={16} />
            </button>
          )}
          <button
            onClick={() => onDelete(note.id)}
            className="text-foreground/40 hover:text-red-500 transition-colors p-1"
            aria-label="Delete note"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
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
