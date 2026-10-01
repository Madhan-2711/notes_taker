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
import { Dialog, useDialogTitleId } from "./ui/Dialog";
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
  const titleId = useDialogTitleId();

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
    <Dialog open={Boolean(note)} onClose={onClose} labelledBy={titleId} size="xl" sheetOnMobile className="sm:h-[min(94dvh,960px)] sm:max-w-5xl">
      {note && (
        <form onSubmit={handleSave} className="flex min-h-0 flex-1 flex-col">
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-8">
              <div className="flex items-center gap-3">
                <h2 id={titleId} className="text-lg font-bold tracking-tight">Edit note</h2>
                <ModeBadge mode={note.mode || "normal"} hideNormal />
              </div>
              <div className="flex items-center gap-1">
                {isEditable && userId && (isNormalNote(note) || Boolean(privateKey)) && (
                  <button type="button" onClick={() => {
                    if (attachmentPickerRef.current && !attachmentPickerRef.current.disabled) attachmentPickerRef.current.click();
                    else attachmentsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                    className="btn-secondary min-h-10 px-3" aria-label="Add image or file">
                    <ImagePlus size={17} aria-hidden="true" /> <span className="hidden sm:inline">Add image or file</span>
                  </button>
                )}
                <button type="button" onClick={onClose} className="icon-btn" aria-label="Close editor">
                  <X size={20} aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-5 sm:px-8 sm:py-7">

            {/* Decrypting state */}
            {isSecureNote(note) && decrypting && (
              <div className="flex items-center gap-3 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
                <Loader2 size={18} className="animate-spin text-indigo-700" aria-hidden="true" />
                <p className="text-sm text-indigo-900">Decrypting note on this device…</p>
              </div>
            )}

            {/* Decrypt error */}
            {isSecureNote(note) && decryptError && (
              <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
                <Lock size={20} className="shrink-0 text-red-700" aria-hidden="true" />
                <p className="text-sm text-red-800">{decryptError}</p>
              </div>
            )}

            {/* Collab note message */}
            {isCollabNote(note) && (
              <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <Users size={20} className="shrink-0 text-emerald-700" aria-hidden="true" />
                <p className="text-sm text-emerald-900">
                  Shared notes are edited in the live editor.
                </p>
              </div>
            )}

            {/* Only show the form when editable */}
            {isEditable && !decrypting && (
              <>
                <div>
                  <label htmlFor="edit-note-title" className="label">Title</label>
                  <input
                    id="edit-note-title"
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full border-b border-slate-300 bg-transparent pb-3 text-xl font-bold transition-colors placeholder:text-slate-500 focus:border-primary-strong focus:outline-none"
                    maxLength={100}
                    data-autofocus
                  />
                </div>

                <div>
                  <p className="label">Content</p>
                  {delta && loadedFor === note.id && (
                    <RichNoteEditor
                      key={note.id}
                      initial={delta}
                      label="Note content"
                      placeholder="Start writing your thoughts…"
                      images={userId ? { noteId: note.id, userId, privateKey: privateKey ?? null } : null}
                      handleRef={editorRef}
                      onChange={(nextDelta, plain) => { setDelta(nextDelta); setContent(plain); }}
                    />
                  )}
                  <p className={`mt-1 text-right text-xs tabular-nums ${content.length > MAX_PLAIN_TEXT ? "font-semibold text-red-700" : "text-slate-600"}`}>{content.length.toLocaleString()} / {MAX_PLAIN_TEXT.toLocaleString()} characters</p>
                </div>

                {groups.length > 0 && (
                  <fieldset>
                    <legend className="label flex items-center gap-1.5"><FolderOpen size={14} aria-hidden="true" /> Groups</legend>
                    <div className="flex flex-wrap gap-2">
                      {groups.map((g) => {
                        const isSelected = selectedGroupIds.includes(g.id);
                        return (
                          <button
                            key={g.id}
                            type="button"
                            aria-pressed={isSelected}
                            onClick={() => handleToggleGroup(g.id)}
                            className={`chip ${isSelected ? "border-indigo-700 bg-indigo-50 text-indigo-900" : "border-slate-300 bg-white text-slate-800 hover:border-indigo-500"}`}
                          >
                            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: g.color }} aria-hidden="true" />
                            {g.title}
                            {isSelected && <Check size={13} aria-hidden="true" />}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                )}

                {userId && (isNormalNote(note) || (isSecureNote(note) && privateKey)) && (
                  <div ref={attachmentsRef} className="scroll-mt-4">
                    <NoteAttachments key={`${userId}:${note.id}`} noteId={note.id} userId={userId} privateKey={privateKey ?? null} pickerRef={attachmentPickerRef} knownNote={note} onInsertImage={insertImage} onInsertText={(text) => editorRef.current?.insertText(text)} />
                    <p className="text-xs leading-5 text-slate-600">Files upload immediately, even if you close this editor without saving text changes.</p>
                  </div>
                )}

              </>
            )}
            </div>

            {isEditable && !decrypting ? (
                <div className="flex shrink-0 flex-col gap-2 border-t border-slate-200 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-between sm:px-8">
                  <div className="min-w-0 flex-1">
                    {error && <span role="alert" className="text-sm font-medium text-red-700">{error}</span>}
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <button type="button" onClick={onClose} className="btn-quiet">
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!title.trim() || !content.trim() || saving}
                      className="btn-primary"
                    >
                      {saving ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}
                      {saving ? "Saving…" : "Save changes"}
                    </button>
                  </div>
                </div>
            ) : (
              <div className="flex shrink-0 justify-end border-t border-slate-200 px-4 py-3 sm:px-8">
                <button type="button" onClick={onClose} className="btn-quiet">
                  Close
                </button>
              </div>
            )}
        </form>
      )}
    </Dialog>
  );
}
