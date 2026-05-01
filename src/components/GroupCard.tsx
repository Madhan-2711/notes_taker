"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { type Group, type Note } from "../lib/validations";
import { Settings, Trash2, ArrowRight } from "lucide-react";
import Link from "next/link";

interface GroupCardProps {
  group: Group;
  notes: Note[];
  onManage: () => void;
  onDelete: () => void;
}

export function GroupCard({ group, notes, onManage, onDelete }: GroupCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirmDelete) {
      onDelete();
    } else {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 300, damping: 22 }}
      className="glass neubrutal rounded-[var(--radius-xl)] overflow-hidden"
    >
      {/* Main clickable area → navigates to group detail page */}
      <Link href={`/groups/${group.id}`} className="block group">
        <div className="flex items-center gap-4 p-6 transition-colors hover:bg-primary/4">
          {/* Color swatch */}
          <div
            className="w-12 h-12 rounded-2xl shrink-0 flex items-center justify-center shadow-sm"
            style={{ backgroundColor: group.color + "22", border: `2px solid ${group.color}40` }}
          >
            <div className="w-4 h-4 rounded-full" style={{ backgroundColor: group.color }} />
          </div>

          {/* Title & count */}
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-lg truncate">{group.title}</h3>
            <p className="text-sm text-foreground/40 mt-0.5">
              {notes.length} {notes.length === 1 ? "note" : "notes"}
            </p>
          </div>

          {/* Action buttons — stop propagation so they don't navigate */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); onManage(); }}
              className="p-2 rounded-xl text-foreground/40 hover:text-primary hover:bg-primary/10 transition-colors"
              aria-label="Manage group"
            >
              <Settings size={16} />
            </button>
            <button
              onClick={handleDelete}
              className={`p-2 rounded-xl transition-colors ${
                confirmDelete
                  ? "text-white bg-red-500 hover:bg-red-600"
                  : "text-foreground/40 hover:text-red-500 hover:bg-red-50"
              }`}
              aria-label={confirmDelete ? "Confirm delete group" : "Delete group"}
            >
              <Trash2 size={16} />
            </button>
          </div>

          {/* Arrow hint */}
          <ArrowRight
            size={18}
            className="text-foreground/20 group-hover:text-primary group-hover:translate-x-1 transition-all duration-200 shrink-0"
          />
        </div>
      </Link>

      {/* Confirm delete message */}
      {confirmDelete && (
        <div className="px-6 pb-3 text-xs text-red-500 font-medium animate-pulse">
          Click delete again to confirm — notes will NOT be deleted
        </div>
      )}

      {/* Note previews strip */}
      {notes.length > 0 && (
        <div className="border-t border-border/30 px-6 py-3 flex items-center gap-2 flex-wrap">
          {notes.slice(0, 4).map((note) => (
            <span
              key={note.id}
              className="text-xs font-medium text-foreground/50 bg-border/30 px-2.5 py-1 rounded-full truncate max-w-[140px]"
            >
              {note.title}
            </span>
          ))}
          {notes.length > 4 && (
            <span className="text-xs text-foreground/30 font-medium">+{notes.length - 4} more</span>
          )}
        </div>
      )}
    </motion.div>
  );
}
