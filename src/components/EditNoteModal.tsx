"use client";

import { useState, useEffect } from "react";
import { type Note, type Group, noteSchema } from "../lib/validations";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, FolderOpen } from "lucide-react";
import { setNoteGroupIds } from "../lib/groupsService";

interface EditNoteModalProps {
  note: Note | null;
  onClose: () => void;
  onSave: (id: string, title: string, content: string) => Promise<void>;
  groups?: Group[];
}

export function EditNoteModal({ note, onClose, onSave, groups = [] }: EditNoteModalProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (note) {
      setTitle(note.title);
      setContent(note.content);
      setSelectedGroupIds(note.groupIds ?? []);
      setError(null);
    }
  }, [note]);

  const handleToggleGroup = (groupId: string) => {
    setSelectedGroupIds((prev) =>
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!note) return;
    setError(null);
    setSaving(true);

    try {
      noteSchema.parse({ title, content });
      await onSave(note.id, title, content);
      // Update group membership separately
      await setNoteGroupIds(note.id, selectedGroupIds);
      onClose();
    } catch (err: any) {
      setError(err.errors?.[0]?.message || err.message || "Failed to update note");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {note && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />

          {/* Modal */}
          <motion.form
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSave}
            className="relative bg-white neubrutal rounded-[var(--radius-xl)] p-8 w-full max-w-lg flex flex-col gap-5 shadow-xl max-h-[90vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold tracking-tight">Edit Note</h2>
              <button type="button" onClick={onClose} className="text-foreground/40 hover:text-foreground transition-colors p-1">
                <X size={20} />
              </button>
            </div>

            {/* Title */}
            <div>
              <label className="text-xs font-medium tracking-widest uppercase text-foreground/40 mb-2 block">
                Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-transparent text-lg font-bold placeholder:text-foreground/25 focus:outline-none border-b border-border/50 pb-3 focus:border-primary transition-colors"
                maxLength={100}
              />
            </div>

            {/* Content */}
            <div>
              <label className="text-xs font-medium tracking-widest uppercase text-foreground/40 mb-2 block">
                Content
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full bg-transparent min-h-[140px] resize-none focus:outline-none placeholder:text-foreground/25 leading-relaxed"
              />
            </div>

            {/* Group membership */}
            {groups.length > 0 && (
              <div>
                <label className="text-xs font-medium tracking-widest uppercase text-foreground/40 mb-3 flex items-center gap-1.5">
                  <FolderOpen size={11} />
                  Groups
                </label>
                <div className="flex flex-wrap gap-2">
                  {groups.map((g) => {
                    const isSelected = selectedGroupIds.includes(g.id);
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => handleToggleGroup(g.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all duration-150 ${
                          isSelected
                            ? "text-white border-transparent shadow-sm"
                            : "bg-transparent border-border/50 text-foreground/50 hover:border-primary/40"
                        }`}
                        style={isSelected ? { backgroundColor: g.color, borderColor: g.color } : {}}
                      >
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: isSelected ? "white" : g.color }}
                        />
                        {g.title}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between pt-4 border-t border-border/30">
              <div className="flex-1">
                {error && <span className="text-sm text-red-500 font-medium">{error}</span>}
              </div>
              <div className="flex items-center gap-3">
                <button type="button" onClick={onClose} className="px-5 py-2 text-sm font-medium text-foreground/60 hover:text-foreground transition-colors">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!title.trim() || !content.trim() || saving}
                  className="bg-primary text-primary-foreground neubrutal px-6 py-2 rounded-[var(--radius-xl)] font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors flex items-center gap-2"
                >
                  <Check size={16} />
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
