"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { type Note, GROUP_COLORS, groupSchema } from "../lib/validations";
import { createGroup } from "../lib/groupsService";
import { NotePickerGrid } from "./NotePickerGrid";
import { X, Check, FolderPlus } from "lucide-react";

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  notes: Note[];
  userId: string;
}

export function CreateGroupModal({ isOpen, onClose, notes, userId }: CreateGroupModalProps) {
  const [title, setTitle] = useState("");
  const [color, setColor] = useState<string>(GROUP_COLORS[0].value);
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggleNote = (id: string) => {
    setSelectedNoteIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleClose = () => {
    setTitle("");
    setColor(GROUP_COLORS[0].value);
    setSelectedNoteIds([]);
    setError(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      groupSchema.parse({ title, color });
      await createGroup(userId, title.trim(), color, selectedNoteIds);
      handleClose();
    } catch (err: any) {
      setError(err.errors?.[0]?.message || err.message || "Failed to create group");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={handleClose}
        >
          <div className="absolute inset-0 bg-black/35 backdrop-blur-sm" />

          <motion.form
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSubmit}
            className="relative bg-white neubrutal rounded-[var(--radius-xl)] p-7 w-full max-w-lg flex flex-col gap-5 shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <FolderPlus size={20} className="text-primary" />
                <h2 className="text-lg font-bold tracking-tight">Create Group</h2>
              </div>
              <button type="button" onClick={handleClose} className="text-foreground/40 hover:text-foreground p-1 transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Group title */}
            <div>
              <label className="text-xs font-medium tracking-widest uppercase text-foreground/40 mb-2 block">
                Group Name
              </label>
              <input
                type="text"
                placeholder="e.g. Work, Personal, Research..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={50}
                autoFocus
                className="w-full bg-transparent text-lg font-bold placeholder:text-foreground/25 focus:outline-none border-b border-border/50 pb-3 focus:border-primary transition-colors"
              />
            </div>

            {/* Color picker */}
            <div>
              <label className="text-xs font-medium tracking-widest uppercase text-foreground/40 mb-3 block">
                Color
              </label>
              <div className="flex items-center gap-2.5">
                {GROUP_COLORS.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    title={label}
                    onClick={() => setColor(value)}
                    className={`w-7 h-7 rounded-full border-2 transition-all duration-150 ${
                      color === value
                        ? "border-foreground scale-125 shadow-md"
                        : "border-transparent hover:scale-110"
                    }`}
                    style={{ backgroundColor: value }}
                  />
                ))}
              </div>
            </div>

            {/* Note picker */}
            <div>
              <label className="text-xs font-medium tracking-widest uppercase text-foreground/40 mb-3 block">
                Add Notes <span className="normal-case text-foreground/25">(optional)</span>
              </label>
              <NotePickerGrid
                notes={notes}
                selectedIds={selectedNoteIds}
                onToggle={handleToggleNote}
              />
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-2 border-t border-border/30">
              <div className="flex-1">
                {error && <span className="text-sm text-red-500 font-medium">{error}</span>}
              </div>
              <div className="flex items-center gap-3">
                <button type="button" onClick={handleClose} className="px-5 py-2 text-sm font-medium text-foreground/60 hover:text-foreground transition-colors">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!title.trim() || saving}
                  className="bg-primary text-primary-foreground neubrutal px-6 py-2 rounded-[var(--radius-xl)] font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors flex items-center gap-2"
                >
                  <Check size={16} />
                  {saving ? "Creating..." : "Create Group"}
                </button>
              </div>
            </div>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
