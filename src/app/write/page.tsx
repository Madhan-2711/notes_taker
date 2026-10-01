"use client";

import { useState, useEffect, useRef } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useUserKeys } from "../../hooks/useUserKeys";
import { useNoteDraft } from "../../contexts/NoteDraftContext";
import { db, hasValidConfig } from "../../lib/firebaseConfig";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { noteSchema, type Group, type NoteMode } from "../../lib/validations";
import { createNormalNote, updateNormalNote } from "../../lib/services/notes/normalNotesService";
import { createSecureNote, updateSecureNote } from "../../lib/services/notes/secureNotesService";
import { appendImagesToCollabNote, createCollabNote } from "../../lib/services/notes/collaborativeNotesService";
import { attachmentAccess, uploadAttachment } from "../../lib/services/attachments";
import { imageToken } from "../../lib/inlineImages";
import { MAX_PLAIN_TEXT, MAX_RICH_JSON, deltaFromPlain, parseRichContent, plainFromDelta, serializeDelta, type RichOp } from "../../lib/richText";
import { NOTE_TEMPLATES, type NoteTemplate } from "../../lib/noteTemplates";
import { RichNoteEditor } from "../../components/RichNoteEditor";
import { ATTACHMENT_ACCEPT, IMAGE_EXT, MAX_INLINE_PLAINTEXT, validateAttachment } from "../../lib/attachmentCrypto";
import { getFriends } from "../../lib/services/social/friendsService";
import { sendCollabInvite } from "../../lib/services/social/collaborationService";
import type { UserProfile } from "../../lib/validations";
import { NoteModePicker } from "../../components/NoteModePicker";
import { noteModeInfo } from "../../lib/noteModes";
import { Check, FileText, FolderOpen, ImagePlus, LoaderCircle, Paperclip, Trash2, Users, LockKeyhole } from "lucide-react";
import { PageHeader } from "../../components/PageHeader";
import { PageLoading, SignInRequired } from "../../components/PageState";
import { Menu } from "../../components/ui/Menu";
import { ConfirmDialog } from "../../components/ui/ConfirmDialog";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function WritePage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const {
    publicKey,
    privateKey,
    isReady: keysReady,
    hasKeys,
    error: keyError,
  } = useUserKeys();

  const { draft, update: updateDraft, clear: clearDraft } = useNoteDraft(user?.uid);
  const { mode: noteMode, title, content, rich } = draft;
  const setNoteMode = (mode: NoteMode) => updateDraft({ mode });
  const setTitle = (value: string) => updateDraft({ title: value });
  const [editorVersion, setEditorVersion] = useState(0);
  const draftDelta = parseRichContent(rich) ?? deltaFromPlain(content);

  const [pendingTemplate, setPendingTemplate] = useState<NoteTemplate | null>(null);
  const chooseTemplate = (template: NoteTemplate) => {
    if (content.trim()) setPendingTemplate(template);
    else applyTemplate(template);
  };
  const applyTemplate = (template: NoteTemplate) => {
    setPendingTemplate(null);
    updateDraft({
      title: title.trim() ? title : template.title,
      content: plainFromDelta(template.delta),
      rich: serializeDelta(template.delta),
    });
    setEditorVersion((version) => version + 1);
  };
  const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [friends, setFriends] = useState<UserProfile[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(true);
  const [selectedFriends, setSelectedFriends] = useState<string[]>([]);
  const [permission, setPermission] = useState<"editor" | "viewer">("editor");
  const [friendsError, setFriendsError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveStage, setSaveStage] = useState("");
  const [savedNoteId, setSavedNoteId] = useState<string | null>(null);
  const createdNoteId = useRef<string | null>(null);
  const completedFiles = useRef(new Set<number>());
  const completedInvites = useRef(new Set<string>());
  const uploadedImageTokens = useRef<string[]>([]);
  const uploadedImages = useRef<RichOp[]>([]);
  const imageTokensApplied = useRef(false);
  const pickerRef = useRef<HTMLInputElement>(null);

  // Live-subscribe to user's groups for the multi-select
  useEffect(() => {
    if (!user || !hasValidConfig) return;
    const q = query(
      collection(db, "groups"),
      where("authorId", "==", user.uid)
    );
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Group[];
      data.sort((a, b) => a.title.localeCompare(b.title));
      setGroups(data);
    });
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!user || noteMode !== "collab") return;
    let active = true;
    getFriends(user.uid).then((list) => {
      if (active) { setFriends(list); setFriendsError(""); setFriendsLoading(false); }
    }).catch(() => { if (active) { setFriendsError("Could not load friends. Please try refreshing this page."); setFriendsLoading(false); } });
    return () => { active = false; };
  }, [user, noteMode]);

  const addFiles = (selection: FileList | null) => {
    if (!selection || createdNoteId.current) return;
    try {
      const incoming = Array.from(selection);
      if (files.length + incoming.length > 8) throw new Error("Add up to 8 files when creating a note. You can add more afterward.");
      incoming.forEach((file) => {
        validateAttachment(file.name, file.size);
        if (!IMAGE_EXT.test(file.name) && file.size > MAX_INLINE_PLAINTEXT) {
          throw new Error("Non-image files must be under ~650 KB. Choose a smaller file.");
        }
      });
      setFiles((previous) => [...previous, ...incoming]);
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not add those files.");
    }
    if (pickerRef.current) pickerRef.current.value = "";
  };

  const handleToggleGroup = (groupId: string) => {
    setSelectedGroupIds((prev) =>
      prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]
    );
  };

  const handleCreateNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setError(null);
    setSuccess(false);
    if (!user || !hasValidConfig) return;

    setSaving(true);
    try {
      const validData = noteSchema.parse({ title, content });
      const richJson = serializeDelta(draftDelta);
      if (richJson.length > MAX_RICH_JSON) throw new Error("This note has too much formatting to save. Remove some formatting or split the note.");
      if (noteMode !== "normal" && (!hasKeys || !publicKey)) throw new Error("Encryption keys are not ready yet. Set up or unlock your vault.");
      if (noteMode !== "normal" && (files.length || (noteMode === "collab" && selectedFriends.length)) && !privateKey) {
        throw new Error("Unlock your vault before adding files or collaborators to an encrypted note.");
      }

      let newNoteId = createdNoteId.current;
      if (!newNoteId) {
        setSaveStage("Creating note…");

        if (noteMode === "normal") {
          newNoteId = await createNormalNote(user.uid, validData.title, validData.content, selectedGroupIds, richJson);
        } else if (noteMode === "secure") {
          if (!publicKey) throw new Error("Encryption keys are not ready yet.");
          newNoteId = await createSecureNote(user.uid, validData.title, validData.content, selectedGroupIds, publicKey, richJson);
        } else if (noteMode === "collab") {
          if (!publicKey) throw new Error("Encryption keys are not ready yet.");
          newNoteId = await createCollabNote(user.uid, validData.title, validData.content, selectedGroupIds, publicKey, draftDelta);
        }
        createdNoteId.current = newNoteId;
        setSavedNoteId(newNoteId);
      }

      if (!newNoteId) throw new Error("Could not create the note.");
      if (files.length || (noteMode === "collab" && selectedFriends.length)) {
        if (noteMode !== "normal" && !privateKey) throw new Error("Unlock your vault to finish adding files and collaborators.");
        const { key } = await attachmentAccess(newNoteId, user.uid, privateKey);
        for (const [index, file] of files.entries()) {
          if (completedFiles.current.has(index)) continue;
          setSaveStage(`Adding file ${index + 1} of ${files.length}…`);
          const uploaded = await uploadAttachment(newNoteId, user.uid, key, file, () => {}, new AbortController().signal);
          if (IMAGE_EXT.test(uploaded.name)) {
            uploadedImageTokens.current.push(imageToken(uploaded));
            const id = uploaded.path.split("/").pop();
            if (id) uploadedImages.current.push({ insert: { noteImage: { id, alt: uploaded.name } } });
          }
          completedFiles.current.add(index);
        }
        if (uploadedImageTokens.current.length && !imageTokensApplied.current) {
          setSaveStage("Placing images in note…");
          if (noteMode === "collab" && privateKey) await appendImagesToCollabNote(newNoteId, user.uid, privateKey, uploadedImageTokens.current);
          else {
            const withImages = serializeDelta({ ops: [...draftDelta.ops, ...uploadedImages.current] });
            if (withImages.length > MAX_RICH_JSON) throw new Error("The note is too long to place its images. Shorten the text and retry; your uploaded files are safe.");
            if (noteMode === "normal") await updateNormalNote(newNoteId, validData.title, validData.content, withImages);
            else if (privateKey) await updateSecureNote(newNoteId, user.uid, validData.title, validData.content, privateKey, withImages);
          }
          imageTokensApplied.current = true;
        }
        if (noteMode === "collab" && key) {
          for (const friendId of selectedFriends) {
            if (completedInvites.current.has(friendId)) continue;
            const friend = friends.find((entry) => entry.uid === friendId);
            if (!friend) throw new Error("A selected friend is no longer available. Open the saved note to invite them later.");
            setSaveStage(`Inviting ${friend.displayName || "friend"}…`);
            await sendCollabInvite(newNoteId, user.uid, user.displayName || "Anonymous", user.email || "", friendId, friend.displayName || "Friend", permission, key);
            completedInvites.current.add(friendId);
          }
        }
      }

      if (noteMode === "collab") { clearDraft(); router.push(`/collab/${newNoteId}`); return; }
      router.push(`/notes?open=${encodeURIComponent(newNoteId)}`);

      clearDraft();
      setSelectedGroupIds([]);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create note";
      setError(createdNoteId.current ? `Note saved, but setup is incomplete: ${message} Retry to finish the remaining items.` : message);
    } finally {
      setSaving(false);
      setSaveStage("");
    }
  };

  if (loading) return <PageLoading cards={1} label="Loading editor" />;
  if (!user) return <SignInRequired>Sign in to write notes.</SignInRequired>;

  const locked = saving || Boolean(savedNoteId);
  const groupChip = (selected: boolean) =>
    `chip ${selected ? "border-indigo-700 bg-indigo-50 text-indigo-900" : "border-slate-300 bg-white text-slate-800 hover:border-indigo-500"}`;

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <PageHeader title="New note" />

      <form onSubmit={handleCreateNote} className="flex flex-col gap-5">
        <div className="card p-4 sm:p-7">
          <label htmlFor="write-title" className="sr-only">Title</label>
          <input
            id="write-title"
            type="text"
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={Boolean(savedNoteId)}
            autoFocus={!title}
            className="w-full border-b border-slate-200 bg-transparent pb-3 text-2xl font-bold transition-colors placeholder:text-slate-500 focus:border-primary-strong focus:outline-none"
            maxLength={100}
          />

          <div className="mt-5 [--rich-toolbar-top:4rem]">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-800" id="write-content-label">Content</p>
              <Menu
                label="Use a template"
                align="end"
                triggerClassName={`btn-quiet min-h-10 px-3 ${locked ? "pointer-events-none opacity-50" : ""}`}
                trigger={<><FileText size={16} aria-hidden="true" /> Use template</>}
                items={NOTE_TEMPLATES.map((template) => ({ label: template.label, onSelect: () => chooseTemplate(template) }))}
              />
            </div>
            <RichNoteEditor
              key={`${user.uid}:${editorVersion}`}
              initial={draftDelta}
              readOnly={Boolean(savedNoteId)}
              label="Note content"
              placeholder="Start writing your thoughts…"
              onChange={(delta, plain) => updateDraft({ rich: serializeDelta(delta), content: plain })}
            />
            <p className={`mt-1 text-right text-xs tabular-nums ${content.length > MAX_PLAIN_TEXT ? "font-semibold text-red-700" : "text-slate-600"}`}>{content.length.toLocaleString()} / {MAX_PLAIN_TEXT.toLocaleString()} characters</p>
          </div>
        </div>

        <section className="panel flex flex-col gap-6 p-4 sm:p-6" aria-labelledby="write-options">
          <h2 id="write-options" className="text-base font-bold tracking-tight">Options</h2>

          <div>
            <p className="label" id="write-type-label">Type</p>
            <NoteModePicker value={noteMode} onChange={setNoteMode} disabled={locked} />
            {noteMode !== "normal" && !hasKeys && keysReady && (
              <p className="mt-3 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
                <LockKeyhole size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                Your encryption keys are still being set up. Please wait a moment.
              </p>
            )}
          </div>

          {groups.length > 0 && (
            <fieldset disabled={locked}>
              <legend className="label flex items-center gap-1.5"><FolderOpen size={14} aria-hidden="true" /> Groups <span className="font-normal text-slate-600">(optional)</span></legend>
              <div className="flex flex-wrap gap-2">
                {groups.map((g) => {
                  const isSelected = selectedGroupIds.includes(g.id);
                  return (
                    <button key={g.id} type="button" aria-pressed={isSelected} onClick={() => handleToggleGroup(g.id)} className={`${groupChip(isSelected)} disabled:opacity-50`}>
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: g.color }} aria-hidden="true" />
                      {g.title}
                      {isSelected && <Check size={13} aria-hidden="true" />}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          )}

          <div aria-labelledby="write-files">
            <h3 id="write-files" className="label flex items-center gap-1.5"><Paperclip size={14} aria-hidden="true" /> Files and images <span className="font-normal text-slate-600">(optional)</span></h3>
            <p className="text-sm text-slate-600">{noteMode === "normal" ? "Files on regular notes are not encrypted." : "Files are encrypted before saving."} Images are optimized; other files must be under about 650 KB. Up to 8 files now, more later from the note.</p>
            <input ref={pickerRef} type="file" accept={ATTACHMENT_ACCEPT} multiple className="sr-only" tabIndex={-1} aria-label="Choose images or files" onChange={(event) => addFiles(event.target.files)} />
            <button type="button" disabled={locked} onClick={() => pickerRef.current?.click()} className="btn-secondary mt-3">
              <ImagePlus size={17} aria-hidden="true" /> Add image or file
            </button>
            {files.length > 0 && <ul className="mt-3 space-y-2" aria-label="Files to attach">{files.map((file, index) => <li key={`${file.name}-${index}`} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white py-1 pl-3 pr-1 text-sm">
              <Paperclip size={15} className="shrink-0 text-slate-500" aria-hidden="true" /><span className="min-w-0 flex-1 truncate">{file.name}</span><span className="shrink-0 text-xs tabular-nums text-slate-600">{Math.ceil(file.size / 1024)} KB</span>
              <button type="button" disabled={locked} onClick={() => setFiles((previous) => previous.filter((_, position) => position !== index))} className="icon-btn hover:bg-red-50 hover:text-red-700 disabled:opacity-40" aria-label={`Remove ${file.name}`}><Trash2 size={15} aria-hidden="true" /></button>
            </li>)}</ul>}
          </div>

          {noteMode === "collab" && <div aria-labelledby="write-collaborators">
            <h3 id="write-collaborators" className="label flex items-center gap-1.5"><Users size={14} aria-hidden="true" /> Invite collaborators <span className="font-normal text-slate-600">(optional)</span></h3>
            <p className="text-sm text-slate-600">Friends you pick get an invitation when you save. They can join after accepting.</p>
            {friendsError && <p role="alert" className="mt-3 text-sm text-red-700">{friendsError}</p>}
            {friendsLoading && <div className="mt-3 h-10 w-64 animate-pulse rounded-xl bg-slate-100" aria-label="Loading friends" />}
            {!friendsLoading && !friendsError && friends.length === 0 && <p className="mt-3 text-sm text-slate-700">No friends to invite yet. <Link href="/friends" className="font-semibold text-indigo-800 underline">Add friends</Link>, or invite them later from the note.</p>}
            {friends.length > 0 && <>
              <div className="mt-3 flex flex-wrap gap-2">{friends.map((friend) => {
                const selected = selectedFriends.includes(friend.uid);
                return <button key={friend.uid} type="button" aria-pressed={selected} disabled={locked} onClick={() => setSelectedFriends((previous) => selected ? previous.filter((id) => id !== friend.uid) : [...previous, friend.uid])}
                  className={`${groupChip(selected)} disabled:opacity-50`}>
                  {selected && <Check size={13} aria-hidden="true" />}{friend.displayName || "Friend"}
                </button>;
              })}</div>
              {selectedFriends.length > 0 && <div className="mt-4">
                <label htmlFor="write-permission" className="label">Access</label>
                <select id="write-permission" value={permission} disabled={locked} onChange={(event) => setPermission(event.target.value as "editor" | "viewer")} className="field w-auto pr-8">
                  <option value="editor">Can edit</option><option value="viewer">Can view</option>
                </select>
              </div>}
            </>}
          </div>}
        </section>

        {/* Save bar: stays in reach above the mobile tab bar while writing long notes. */}
        <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 flex items-center justify-between gap-3 rounded-card border-2 border-slate-900 bg-white p-2.5 pl-3 shadow-[var(--neubrutalism-shadow)] md:bottom-4">
          <div className="min-w-0 flex-1 px-1 text-sm" aria-live="polite">
            {(error || keyError) && <span role="alert" className="font-medium text-red-700">{error || keyError}</span>}
            {success && <span className="flex items-center gap-2 font-medium text-emerald-800"><Check size={16} aria-hidden="true" /> Note saved</span>}
            {saving && <span role="status" className="font-medium text-indigo-800">{saveStage || "Saving…"}</span>}
            {!error && !keyError && !success && !saving && <span className="text-slate-600">{title.trim() && content.trim() ? <>Ready to save as <strong className="font-semibold text-slate-900">{noteModeInfo(noteMode).label}</strong></> : "Add a title and some content"}</span>}
            {savedNoteId && error && <Link href={noteMode === "collab" ? `/collab/${savedNoteId}` : `/notes?open=${savedNoteId}`} className="mt-1 block text-xs font-semibold text-indigo-800 underline">Open saved note</Link>}
          </div>
          <button
            type="submit"
            disabled={!title.trim() || !content.trim() || saving}
            className="btn-primary shrink-0"
          >
            {saving ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}
            {saving ? "Saving…" : savedNoteId ? "Retry remaining items" : noteMode === "collab" ? "Create shared note" : "Save note"}
          </button>
        </div>
      </form>

      <ConfirmDialog
        open={pendingTemplate !== null}
        title="Replace your writing?"
        description={pendingTemplate ? `The "${pendingTemplate.label}" template will replace what you've written so far.` : undefined}
        confirmLabel="Use template"
        onConfirm={() => { if (pendingTemplate) applyTemplate(pendingTemplate); }}
        onCancel={() => setPendingTemplate(null)}
      />
    </div>
  );
}
