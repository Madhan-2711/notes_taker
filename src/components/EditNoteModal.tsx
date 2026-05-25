"use client";

import { useState, useEffect } from "react";
import {
  type Note,
  type Group,
  noteSchema,
  isNormalNote,
  isSecureNote,
  isCollabNote,
} from "../lib/validations";
import { ModeBadge } from "./ModeBadge";
import { readSecureNote, updateSecureNote } from "../lib/services/notes/secureNotesService";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, FolderOpen, Lock, Users, Loader2 } from "lucide-react";
import { setNoteGroupIds } from "../lib/groupsService";

interface EditNoteModalProps {
  note: Note | null;
  onClose: () => void;
  onSave: (id: string, title: string, content: string) => Promise<void>;
  groups?: Group[];
  /** Current user's ID for decryption */
  userId?: string;
  /** User's private key for decrypting/encrypting secure notes */
  privateKey?: CryptoKey | null;
}

export function EditNoteModal({
  note,
  onClose,
  onSave,
  groups = [],
  userId,
  privateKey,
}: EditNoteModalProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [decrypting, setDecrypting] = useState(false);
  const [decryptError, setDecryptError] = useState<string | null>(null);

  useEffect(() => {
    if (!note) return;

    setSelectedGroupIds(note.groupIds ?? []);
    setError(null);
    setDecryptError(null);

    if (isNormalNote(note)) {
      setTitle(note.title);
      setContent(note.content);
    } else if (isSecureNote(note) && userId && privateKey) {
      // Decrypt the note for editing
      setDecrypting(true);
      readSecureNote(note.id, userId, privateKey)
        .then(({ title: t, content: c }) => {
          setTitle(t);
          setContent(c);
        })
        .catch((err) => {
          setDecryptError(err instanceof Error ? err.message : "Failed to decrypt note");
        })
        .finally(() => setDecrypting(false));
    } else {
      setTitle("");
      setContent("");
    }
  }, [note, userId, privateKey]);

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

      if (isSecureNote(note) && userId && privateKey) {
        // Re-encrypt and save
        await updateSecureNote(note.id, userId, title, content, privateKey);
      } else {
        // Normal save
        await onSave(note.id, title, content);
      }

      // Update group membership separately
      await setNoteGroupIds(note.id, selectedGroupIds);
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update note";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const isEditable = note
    ? isNormalNote(note) || (isSecureNote(note) && !decrypting && !decryptError)
    : false;

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
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />

          <motion.form
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring" as const, stiffness: 300, damping: 25 }}
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleSave}
            className="relative bg-white neubrutal rounded-[var(--radius-xl)] p-8 w-full max-w-lg flex flex-col gap-5 shadow-xl max-h-[90vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold tracking-tight">Edit Note</h2>
                <ModeBadge mode={note.mode || "normal"} />
              </div>
              <button type="button" onClick={onClose} className="text-foreground/40 hover:text-foreground transition-colors p-1">
                <X size={20} />
              </button>
            </div>

            {/* Decrypting state */}
            {isSecureNote(note) && decrypting && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-indigo-50 border border-indigo-100">
                <Loader2 size={18} className="text-indigo-500 animate-spin" />
                <p className="text-sm text-indigo-700">Decrypting note...</p>
              </div>
            )}

            {/* Decrypt error */}
            {isSecureNote(note) && decryptError && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-100">
                <Lock size={20} className="text-red-500 shrink-0" />
                <p className="text-sm text-red-700">{decryptError}</p>
              </div>
            )}

            {/* Collab note message */}
            {isCollabNote(note) && (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-100">
                <Users size={20} className="text-emerald-500 shrink-0" />
                <p className="text-sm text-emerald-700">
                  Collaborative notes are edited in the real-time collaborative editor.
                </p>
              </div>
            )}

            {/* Only show the form when editable */}
            {isEditable && !decrypting && (
              <>
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
              </>
            )}

            {/* Close button for non-editable modes */}
            {(!isEditable || decrypting) && !isEditable && (
              <div className="flex justify-end pt-4 border-t border-border/30">
                <button type="button" onClick={onClose} className="px-5 py-2 text-sm font-medium text-foreground/60 hover:text-foreground transition-colors">
                  Close
                </button>
              </div>
            )}
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
