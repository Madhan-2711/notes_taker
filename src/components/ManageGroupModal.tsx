"use client";

import { useState, useEffect } from "react";
import { type Group, type Note, GROUP_COLORS, groupSchema } from "../lib/validations";
import { updateGroup, syncGroupNotes, deleteGroup } from "../lib/groupsService";
import { GroupFields } from "./GroupFields";
import { Dialog, useDialogTitleId } from "./ui/Dialog";
import { ConfirmDialog } from "./ui/ConfirmDialog";
import { Check, Loader2, Trash2, X } from "lucide-react";

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
  const titleId = useDialogTitleId();
  const [title, setTitle] = useState("");
  const [color, setColor] = useState<string>(GROUP_COLORS[0].value);
  const [selectedNoteIds, setSelectedNoteIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill when group changes
  useEffect(() => {
    if (group) {
      // This modal intentionally resets its draft when a different group opens.
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!group) return;
    await deleteGroup(group.id, userId);
    setConfirmDelete(false);
    onDeleted();
    onClose();
  };

  return (
    <>
      <Dialog open={Boolean(group)} onClose={onClose} labelledBy={titleId} size="md" sheetOnMobile>
        <form onSubmit={handleSave} className="flex min-h-0 flex-1 flex-col">
          <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-3 sm:px-6">
            <h2 id={titleId} className="text-lg font-bold tracking-tight">Manage group</h2>
            <button type="button" onClick={onClose} className="icon-btn -mr-2" aria-label="Close">
              <X size={20} aria-hidden="true" />
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-6">
            <GroupFields
              idPrefix="manage-group"
              title={title}
              onTitleChange={setTitle}
              color={color}
              onColorChange={setColor}
              notes={allNotes}
              selectedNoteIds={selectedNoteIds}
              onToggleNote={handleToggleNote}
              notesLabel="Notes in this group"
            />

            {/* Kept apart from the save actions so it can't be hit by accident. */}
            <section aria-labelledby="delete-group-heading" className="rounded-xl border border-red-200 p-4">
              <h3 id="delete-group-heading" className="text-sm font-bold text-slate-900">Delete group</h3>
              <p className="mt-1 text-sm text-slate-700">Removes the group only. Your notes stay in Notes.</p>
              <button type="button" onClick={() => setConfirmDelete(true)} className="btn-danger mt-3">
                <Trash2 size={15} aria-hidden="true" /> Delete group
              </button>
            </section>
          </div>

          <div className="flex shrink-0 flex-col gap-2 border-t border-slate-200 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="min-w-0 flex-1">
              {error && <span role="alert" className="text-sm font-medium text-red-700">{error}</span>}
            </div>
            <div className="flex items-center justify-end gap-2">
              <button type="button" onClick={onClose} className="btn-quiet">Cancel</button>
              <button type="submit" disabled={!title.trim() || saving} className="btn-primary">
                {saving ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        title={`Delete "${group?.title ?? "this group"}"?`}
        description="The group is removed, but every note in it stays in your notes."
        confirmLabel="Delete group"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}
