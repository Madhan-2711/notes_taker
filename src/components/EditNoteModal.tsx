"use client";

import { useState, useEffect, useRef } from "react";
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
import { X, Check, FolderOpen, ImagePlus, Lock, Users, Loader2 } from "lucide-react";
import { setNoteGroupIds } from "../lib/groupsService";
import { NoteAttachments } from "./NoteAttachments";
import type { Attachment } from "../lib/services/attachments";
import { RichNoteEditor, type RichNoteEditorHandle } from "./RichNoteEditor";
import { MAX_PLAIN_TEXT, MAX_RICH_JSON, deltaFromPlain, parseRichContent, serializeDelta, type RichDelta } from "../lib/richText";

interface EditNoteModalProps {
  note: Note | null;
  onClose: () => void;
  onSave: (id: string, title: string, content: string, richContent: string) => Promise<void>;
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
  const [delta, setDelta] = useState<RichDelta | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [decrypting, setDecrypting] = useState(false);
  const [decryptError, setDecryptError] = useState<string | null>(null);
  const [decryptedForNote, setDecryptedForNote] = useState<string | null>(null);
  const attachmentsRef = useRef<HTMLDivElement>(null);
  const attachmentPickerRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<RichNoteEditorHandle>(null);

  const load = (noteId: string, nextTitle: string, plain: string, rich: string | null | undefined) => {
    setTitle(nextTitle);
    setContent(plain);
    setDelta(parseRichContent(rich) ?? deltaFromPlain(plain));
    setLoadedFor(noteId);
  };

  const insertImage = (file: Attachment) => {
    const id = file.path.split("/").pop();
    if (id) editorRef.current?.insertImage({ id, alt: file.name });
  };

  useEffect(() => {
    if (!note) return;
    let cancelled = false;

    // Opening a different note intentionally replaces the modal's draft state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedGroupIds(note.groupIds ?? []);
    setError(null);
    setDecryptError(null);
    setDecryptedForNote(null);
    setTitle("");
    setContent("");
    setDelta(null);
    setLoadedFor(null);
    setDecrypting(false);

    if (isNormalNote(note)) {
      load(note.id, note.title, note.content, note.richContent);
    } else if (isSecureNote(note) && userId && privateKey) {
      // Decrypt the note for editing
      setDecrypting(true);
      readSecureNote(note.id, userId, privateKey)
        .then(({ title: t, content: c, richContent }) => {
          if (!cancelled) {
            load(note.id, t, c, richContent);
            setDecryptedForNote(note.id);
          }
        })
        .catch((err) => {
          if (!cancelled) setDecryptError(err instanceof Error ? err.message : "Failed to decrypt note");
        })
        .finally(() => { if (!cancelled) setDecrypting(false); });
    } else if (isSecureNote(note)) {
      setDecryptError("Unlock your vault to edit this secure note.");
    } else {
      setTitle("");
      setContent("");
    }
    return () => { cancelled = true; };
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
      const richContent = serializeDelta(delta ?? deltaFromPlain(content));
      if (richContent.length > MAX_RICH_JSON) throw new Error("This note has too much formatting to save. Remove some formatting or split the note.");

      if (isSecureNote(note) && userId && privateKey) {
        await updateSecureNote(note.id, userId, title, content, privateKey, richContent);
      } else {
        await onSave(note.id, title, content, richContent);
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
    ? isNormalNote(note) || (isSecureNote(note) && decryptedForNote === note.id && !decrypting && !decryptError)
    : false;

  return (
    <AnimatePresence>
      {note && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-5"
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
            className="relative flex h-[min(94dvh,960px)] w-full max-w-5xl flex-col overflow-hidden rounded-card border-2 border-slate-900 bg-white shadow-2xl"
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/50 px-4 py-4 sm:px-8">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold tracking-tight">Edit Note</h2>
                <ModeBadge mode={note.mode || "normal"} hideNormal />
              </div>
              <div className="flex items-center gap-2">
                {isEditable && userId && (isNormalNote(note) || Boolean(privateKey)) && (
                  <button type="button" onClick={() => {
                    if (attachmentPickerRef.current && !attachmentPickerRef.current.disabled) attachmentPickerRef.current.click();
                    else attachmentsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-indigo-200 px-3 text-sm font-semibold text-indigo-700 hover:bg-indigo-50 focus-visible:outline-2 focus-visible:outline-indigo-500">
                    <ImagePlus size={17} /> <span className="hidden sm:inline">Add image or file</span>
                    <span className="sr-only sm:hidden">Add image or file</span>
                  </button>
                )}
                <button type="button" onClick={onClose} className="rounded-xl p-2 text-foreground/40 transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-indigo-500" aria-label="Close editor">
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-8 sm:py-7">

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
                  {delta && loadedFor === note.id && (
                    <RichNoteEditor
                      key={note.id}
                      initial={delta}
                      label="Note content"
                      placeholder="Start writing your thoughts..."
                      images={userId ? { noteId: note.id, userId, privateKey: privateKey ?? null } : null}
                      handleRef={editorRef}
                      onChange={(nextDelta, plain) => { setDelta(nextDelta); setContent(plain); }}
                    />
                  )}
                  <p className={`mt-1 text-right text-xs ${content.length > MAX_PLAIN_TEXT ? "font-semibold text-red-600" : "text-foreground/40"}`}>{content.length.toLocaleString()} / {MAX_PLAIN_TEXT.toLocaleString()} characters</p>
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

                {userId && (isNormalNote(note) || (isSecureNote(note) && privateKey)) && (
                  <div ref={attachmentsRef} className="scroll-mt-4">
                    <NoteAttachments key={`${userId}:${note.id}`} noteId={note.id} userId={userId} privateKey={privateKey ?? null} pickerRef={attachmentPickerRef} knownNote={note} onInsertImage={insertImage} onInsertText={(text) => editorRef.current?.insertText(text)} />
                    <p className="text-xs leading-5 text-foreground/50">Files upload immediately, even if you close this editor without saving text changes.</p>
                  </div>
                )}

              </>
            )}
            </div>

            {isEditable && !decrypting && (
                <div className="flex shrink-0 flex-col gap-2 border-t border-border/50 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-8">
                  <div className="min-w-0 flex-1">
                    {error && <span role="alert" className="text-sm text-red-500 font-medium">{error}</span>}
                  </div>
                  <div className="flex items-center justify-end gap-3">
                    <button type="button" onClick={onClose} className="px-5 py-2 text-sm font-medium text-foreground/60 hover:text-foreground transition-colors">
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!title.trim() || !content.trim() || saving}
                      className="bg-primary text-primary-foreground neubrutal px-6 py-2 rounded-card font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors flex items-center gap-2"
                    >
                      <Check size={16} />
                      {saving ? "Saving..." : "Save Changes"}
                    </button>
                  </div>
                </div>
            )}

            {/* Close button for non-editable modes */}
            {(!isEditable || decrypting) && !isEditable && (
              <div className="flex shrink-0 justify-end border-t border-border/50 px-4 py-3 sm:px-8">
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
