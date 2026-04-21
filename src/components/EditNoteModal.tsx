"use client";

import { useState, useEffect } from "react";
import { type Note, noteSchema } from "../lib/validations";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check } from "lucide-react";

interface EditNoteModalProps {
  note: Note | null;
  onClose: () => void;
  onSave: (id: string, title: string, content: string) => Promise<void>;
}

export function EditNoteModal({ note, onClose, onSave }: EditNoteModalProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (note) {
      setTitle(note.title);
      setContent(note.content);
      setError(null);
    }
  }, [note]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!note) return;
    setError(null);
    setSaving(true);

    try {
      noteSchema.parse({ title, content });
      await onSave(note.id, title, content);
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
            className="relative bg-white neubrutal rounded-[var(--radius-xl)] p-8 w-full max-w-lg flex flex-col gap-5 shadow-xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold tracking-tight">Edit Note</h2>
              <button
                type="button"
                onClick={onClose}
                className="text-foreground/40 hover:text-foreground transition-colors p-1"
              >
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
                className="w-full bg-transparent min-h-[160px] resize-none focus:outline-none placeholder:text-foreground/25 leading-relaxed"
              />
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-4 border-t border-border/30">
              <div className="flex-1">
                {error && (
                  <span className="text-sm text-red-500 font-medium">{error}</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2 text-sm font-medium text-foreground/60 hover:text-foreground transition-colors"
                >
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
