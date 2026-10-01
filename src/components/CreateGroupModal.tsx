"use client";

import { useState } from "react";
import { type Note, GROUP_COLORS, groupSchema } from "../lib/validations";
import { createGroup } from "../lib/groupsService";
import { GroupFields } from "./GroupFields";
import { Dialog, useDialogTitleId } from "./ui/Dialog";
import { Check, Loader2, X } from "lucide-react";

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  notes: Note[];
  userId: string;
}

export function CreateGroupModal({ isOpen, onClose, notes, userId }: CreateGroupModalProps) {
  const titleId = useDialogTitleId();
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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create group");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onClose={handleClose} labelledBy={titleId} size="md" sheetOnMobile>
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-3 sm:px-6">
          <h2 id={titleId} className="text-lg font-bold tracking-tight">Create group</h2>
          <button type="button" onClick={handleClose} className="icon-btn -mr-2" aria-label="Close">
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-6">
          <GroupFields
            idPrefix="create-group"
            title={title}
            onTitleChange={setTitle}
            color={color}
            onColorChange={setColor}
            notes={notes}
            selectedNoteIds={selectedNoteIds}
            onToggleNote={handleToggleNote}
            notesLabel="Add notes (optional)"
          />
        </div>

        <div className="flex shrink-0 flex-col gap-2 border-t border-slate-200 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="min-w-0 flex-1">
            {error && <span role="alert" className="text-sm font-medium text-red-700">{error}</span>}
          </div>
          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={handleClose} className="btn-quiet">Cancel</button>
            <button type="submit" disabled={!title.trim() || saving} className="btn-primary">
              {saving ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}
              {saving ? "Creating…" : "Create group"}
            </button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}
