"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { type Group, type Note, GROUP_COLORS, groupSchema } from "../lib/validations";
import { updateGroup, syncGroupNotes, deleteGroup } from "../lib/groupsService";
import { NotePickerGrid } from "./NotePickerGrid";
import { X, Check, Settings, Trash2, AlertTriangle } from "lucide-react";

interface ManageGroupModalProps {
  group: Group | null;
  allNotes: Note[];
  groupNoteIds: string[];
  userId: string;
  onClose: () => void;
  onDeleted: () => void;
}

export function ManageGroupModal({
  group,
  allNotes,
  groupNoteIds,
  userId,
  onClose,
  onDeleted,
}: ManageGroupModalProps) {
  const [title, setTitle] = useState("");
  const [color, setColor] = useState<string>(GROUP_COLORS[0].value);
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill when group changes
  useEffect(() => {
    if (group) {
      setTitle(group.title);
      setColor(group.color ?? GROUP_COLORS[0].value);
      setSelectedNoteIds(groupNoteIds);
      setError(null);
      setConfirmDelete(false);
    }
  }, [group, groupNoteIds]);

  const handleToggleNote = (id: string) => {
    setSelectedNoteIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!group) return;
    setError(null);
    setSaving(true);
    try {
      groupSchema.parse({ title, color });

      const addIds = selectedNoteIds.filter((id) => !groupNoteIds.includes(id));
      const removeIds = groupNoteIds.filter((id) => !selectedNoteIds.includes(id));

      await Promise.all([
        updateGroup(group.id, { title: title.trim(), color }),
        syncGroupNotes(group.id, addIds, removeIds),
      ]);
      onClose();
    } catch (err: any) {
      setError(err.errors?.[0]?.message || err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!group) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setDeleting(true);
    try {
      await deleteGroup(group.id, userId);
      onDeleted();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to delete group");
      setDeleting(false);
    }
  };

  return (
    <AnimatePresence>
      {group && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-black/35 backdrop-blur-sm" />

          <motion.form
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", stiffness: 300, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSave}
            className="relative bg-white neubrutal rounded-[var(--radius-xl)] p-7 w-full max-w-lg flex flex-col gap-5 shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Settings size={20} className="text-primary" />
                <h2 className="text-lg font-bold tracking-tight">Manage Group</h2>
              </div>
              <button type="button" onClick={onClose} className="text-foreground/40 hover:text-foreground p-1 transition-colors">
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
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={50}
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
                Notes in Group
              </label>
              <NotePickerGrid
                notes={allNotes}
                selectedIds={selectedNoteIds}
                onToggle={handleToggleNote}
              />
            </div>

            {/* Delete section */}
            <div className={`rounded-xl border-2 p-4 transition-colors ${confirmDelete ? "border-red-300 bg-red-50" : "border-border/40"}`}>
              <div className="flex items-start gap-3">
                <AlertTriangle size={16} className={`mt-0.5 shrink-0 ${confirmDelete ? "text-red-500" : "text-foreground/30"}`} />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground/70">Delete Group</p>
                  <p className="text-xs text-foreground/40 mt-0.5">
                    {confirmDelete
                      ? "Are you sure? This only removes the group — your notes will be kept."
                      : "Deletes this group. Your notes will not be deleted."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 ${
                    confirmDelete
                      ? "bg-red-500 text-white hover:bg-red-600"
                      : "bg-red-50 text-red-500 hover:bg-red-100 border border-red-200"
                  }`}
                >
                  <Trash2 size={12} />
                  {deleting ? "Deleting..." : confirmDelete ? "Confirm" : "Delete"}
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-2 border-t border-border/30">
              <div className="flex-1">
                {error && <span className="text-sm text-red-500 font-medium">{error}</span>}
              </div>
              <div className="flex items-center gap-3">
                <button type="button" onClick={onClose} className="px-5 py-2 text-sm font-medium text-foreground/60 hover:text-foreground transition-colors">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!title.trim() || saving}
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
