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
import { motion } from "framer-motion";
import { ArrowLeft, Check, FolderOpen, ImagePlus, Paperclip, Trash2, Users } from "lucide-react";
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

  const applyTemplate = (template: NoteTemplate) => {
    if (content.trim() && !window.confirm(`Replace what you've written with the "${template.label}" template?`)) return;
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

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-lg mx-auto gap-4">
        <p className="text-foreground/60 text-lg">Please sign in to write notes.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 sm:mt-4">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-4 mb-8"
      >
        <Link
          href="/"
          className="flex items-center gap-2 text-sm font-medium text-foreground/50 hover:text-foreground transition-colors"
        >
          <ArrowLeft size={16} />
          Home
        </Link>
        <div className="h-4 w-px bg-border"></div>
        <h1 className="text-2xl font-bold tracking-tight">Write a Note</h1>
      </motion.div>

      {/* Write Form */}
      <motion.form
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        onSubmit={handleCreateNote}
        className="glass neubrutal rounded-card p-4 sm:p-8 flex flex-col gap-5"
      >
        {/* Mode Picker */}
        <div className={saving || savedNoteId ? "pointer-events-none opacity-60" : ""}>
          <NoteModePicker value={noteMode} onChange={setNoteMode} />
        </div>

        {/* Key status warning for secure mode */}
        {noteMode === "secure" && !hasKeys && keysReady && (
          <div className="text-sm text-amber-600 bg-amber-50 border border-amber-200 p-3 rounded-xl">
            ⚠️ Encryption keys are being set up. Please wait a moment...
          </div>
        )}

        {/* Divider between mode picker and form */}
        <div className="h-px bg-border/40" />

        <div>
          <label className="text-xs font-medium tracking-widest uppercase text-foreground/40 mb-2 block">
            Title
          </label>
          <input
            type="text"
            placeholder="Give your note a title..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={Boolean(savedNoteId)}
            className="w-full bg-transparent text-xl font-bold placeholder:text-foreground/25 focus:outline-none border-b border-border/50 pb-3 focus:border-primary transition-colors"
            maxLength={100}
          />
        </div>

        <section aria-label="Templates" className={saving || savedNoteId ? "pointer-events-none opacity-60" : ""}>
          <h2 className="text-xs font-medium tracking-widest uppercase text-foreground/40 mb-2">Start from a template</h2>
          <div className="flex flex-wrap gap-2">
            {NOTE_TEMPLATES.map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => applyTemplate(template)}
                title={template.description}
                className="min-h-11 rounded-xl border border-border/70 bg-white px-3 text-sm font-semibold text-slate-700 transition-colors hover:border-indigo-300 hover:bg-indigo-50 focus-visible:outline-2 focus-visible:outline-indigo-600"
              >
                {template.label}
              </button>
            ))}
          </div>
        </section>

        <div className="[--rich-toolbar-top:4rem] sm:[--rich-toolbar-top:5rem]">
          <label className="text-xs font-medium tracking-widest uppercase text-foreground/40 mb-2 block">
            Content
          </label>
          <RichNoteEditor
            key={`${user.uid}:${editorVersion}`}
            initial={draftDelta}
            readOnly={Boolean(savedNoteId)}
            label="Note content"
            placeholder="Start writing your thoughts..."
            onChange={(delta, plain) => updateDraft({ rich: serializeDelta(delta), content: plain })}
          />
          <p className={`mt-1 text-right text-xs ${content.length > MAX_PLAIN_TEXT ? "font-semibold text-red-600" : "text-foreground/40"}`}>{content.length.toLocaleString()} / {MAX_PLAIN_TEXT.toLocaleString()} characters</p>
        </div>

        <section className="rounded-2xl border border-border/70 bg-white/70 p-4 sm:p-5" aria-label="Files and images">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-bold"><Paperclip size={17} /> Files & images <span className="font-normal text-foreground/45">(optional)</span></h2>
              <p className="mt-1 text-xs leading-5 text-foreground/55">{noteMode === "normal" ? "Normal-note files are not encrypted." : "Files are encrypted before saving."} Images are optimized; other files must be under ~650 KB.</p>
            </div>
          </div>
          <input ref={pickerRef} type="file" accept={ATTACHMENT_ACCEPT} multiple className="sr-only" aria-label="Choose images or files" onChange={(event) => addFiles(event.target.files)} />
          <button type="button" disabled={saving || Boolean(savedNoteId)} onClick={() => pickerRef.current?.click()}
            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 text-sm font-semibold text-indigo-700 transition-colors hover:bg-indigo-100 disabled:opacity-50">
            <ImagePlus size={17} /> Add image or file
          </button>
          {files.length > 0 && <ul className="mt-3 space-y-2" aria-label="Files to attach">{files.map((file, index) => <li key={`${file.name}-${index}`} className="flex items-center gap-2 rounded-xl border border-border/60 px-3 py-2 text-sm">
            <Paperclip size={15} className="shrink-0 text-foreground/50" /><span className="min-w-0 flex-1 truncate">{file.name}</span><span className="shrink-0 text-xs text-foreground/45">{Math.ceil(file.size / 1024)} KB</span>
            <button type="button" disabled={saving || Boolean(savedNoteId)} onClick={() => setFiles((previous) => previous.filter((_, position) => position !== index))} className="rounded-lg p-2 text-foreground/55 hover:bg-red-50 hover:text-red-600 disabled:opacity-40" aria-label={`Remove ${file.name}`}><Trash2 size={15} /></button>
          </li>)}</ul>}
          <p className="mt-2 text-xs text-foreground/45">Files are added when you save the note. Up to 8 while creating; add more in the note editor.</p>
        </section>

        {noteMode === "collab" && <section className="rounded-2xl border border-border/70 bg-white/70 p-4 sm:p-5" aria-label="Invite collaborators">
          <h2 className="flex items-center gap-2 text-sm font-bold"><Users size={17} /> Invite collaborators <span className="font-normal text-foreground/45">(optional)</span></h2>
          <p className="mt-1 text-xs leading-5 text-foreground/55">Choose friends to invite when this note is saved. They can join after accepting.</p>
          {friendsError && <p role="alert" className="mt-3 text-sm text-red-600">{friendsError}</p>}
          {friendsLoading && <p className="mt-3 text-sm text-foreground/60">Loading friends…</p>}
          {!friendsLoading && !friendsError && friends.length === 0 && <p className="mt-3 text-sm text-foreground/60">No friends to invite yet. <Link href="/friends" className="font-semibold text-primary underline">Find friends</Link>, or invite them later from the note.</p>}
          {friends.length > 0 && <>
            <div className="mt-3 flex flex-wrap gap-2">{friends.map((friend) => {
              const selected = selectedFriends.includes(friend.uid);
              return <button key={friend.uid} type="button" aria-pressed={selected} disabled={saving || Boolean(savedNoteId)} onClick={() => setSelectedFriends((previous) => selected ? previous.filter((id) => id !== friend.uid) : [...previous, friend.uid])}
                className={`min-h-11 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-50 ${selected ? "border-emerald-500 bg-emerald-50 text-emerald-800" : "border-border/70 bg-white hover:border-emerald-300"}`}>
                {selected ? "✓ " : "+ "}{friend.displayName || "Friend"}
              </button>;
            })}</div>
            {selectedFriends.length > 0 && <label className="mt-4 flex items-center gap-2 text-sm font-medium">Access
              <select value={permission} disabled={saving || Boolean(savedNoteId)} onChange={(event) => setPermission(event.target.value as "editor" | "viewer")} className="min-h-11 rounded-xl border border-border/70 bg-white px-3">
                <option value="editor">Can edit</option><option value="viewer">Can view</option>
              </select>
            </label>}
          </>}
        </section>}

        {/* Group assignment */}
        {groups.length > 0 && (
          <div>
            <label className="text-xs font-medium tracking-widest uppercase text-foreground/40 mb-3 flex items-center gap-1.5">
              <FolderOpen size={11} />
              Add to Groups <span className="normal-case text-foreground/25">(optional)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {groups.map((g) => {
                const isSelected = selectedGroupIds.includes(g.id);
                return (
                  <button
                    key={g.id}
                    type="button"
                    disabled={saving || Boolean(savedNoteId)}
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

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mt-2 pt-4 border-t border-border/30">
          <div className="flex-1">
            {(error || keyError) && (
              <span className="text-sm text-red-500 font-medium">{error || keyError}</span>
            )}
            {success && (
              <motion.span
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-sm text-accent font-medium flex items-center gap-2"
              >
                <Check size={16} /> Note saved successfully!
              </motion.span>
            )}
            {saving && <span role="status" className="text-sm font-medium text-primary">{saveStage || "Saving…"}</span>}
            {savedNoteId && error && <Link href={noteMode === "collab" ? `/collab/${savedNoteId}` : `/notes?open=${savedNoteId}`} className="mt-1 block text-xs font-semibold text-primary underline">Open saved note</Link>}
          </div>
          <button
            type="submit"
            disabled={!title.trim() || !content.trim() || saving}
            className="bg-primary text-primary-foreground neubrutal min-h-11 w-full sm:w-auto px-8 py-2.5 rounded-card font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
          >
            {saving ? "Saving…" : savedNoteId ? "Retry remaining items" : "Post Note"}
          </button>
        </div>
      </motion.form>

    </div>
  );
}
