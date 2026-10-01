"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Check,
  CheckCheck,
  Clock3,
  FolderOpen,
  FolderPlus,
  Inbox,
  LoaderCircle,
  Lock,
  LockKeyhole,
  PenLine,
  Pin,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useUserKeys } from "../hooks/useUserKeys";
import { useVaultStatus } from "../hooks/useVaultStatus";
import { useNoteTitle } from "../hooks/useNoteTitle";
import { useNoteDraft } from "../contexts/NoteDraftContext";
import { useInbox } from "../contexts/InboxContext";
import { useNotePins } from "../hooks/useNotePins";
import { NoteModePicker } from "../components/NoteModePicker";
import { ModeBadge } from "../components/ModeBadge";
import { db, hasValidConfig } from "../lib/firebaseConfig";
import {
  getNoteContent,
  noteSchema,
  isSecureNote,
  type CollabInvite,
  type Group,
  type Note,
  type NoteMode,
} from "../lib/validations";
import { createNormalNote, subscribeToNotes } from "../lib/services/notes/normalNotesService";
import { createSecureNote } from "../lib/services/notes/secureNotesService";
import { createCollabNote } from "../lib/services/notes/collaborativeNotesService";
import { acceptInvite, rejectInvite } from "../lib/services/social/collaborationService";
import { recentNoteHref } from "../lib/noteNavigation";
import { previewText } from "../lib/inlineImages";

function getFirstName(displayName: string | null): string | null {
  return displayName?.trim().split(/\s+/)[0] || null;
}

function getGreeting(currentTime: number | null): string {
  if (currentTime === null) return "Welcome back";
  const hour = new Date(currentTime).getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function formatRelativeTime(timestamp: number, currentTime: number | null): string {
  if (currentTime === null) return "Recently";
  const difference = currentTime - timestamp;
  const minutes = Math.max(0, Math.floor(difference / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function RecentNoteCard({ note, currentTime }: { note: Note; currentTime: number | null }) {
  const title = useNoteTitle(note);
  const preview = isSecureNote(note) ? "End-to-end encrypted. Open to read." : previewText(getNoteContent(note));
  return (
    <Link
      href={recentNoteHref(note)}
      className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-4 transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-slate-900 hover:shadow-[3px_3px_0_0_#0f172a]"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <ModeBadge mode={note.mode || "normal"} />
        <span className="flex items-center gap-1 text-xs font-medium tabular-nums text-slate-600">
          <Clock3 size={12} aria-hidden="true" /> {formatRelativeTime(note.updatedAt || note.createdAt, currentTime)}
        </span>
      </div>
      <h3 className="truncate font-bold tracking-tight group-hover:text-indigo-800">{title}</h3>
      <p className="mt-1 line-clamp-2 min-h-10 text-sm leading-5 text-slate-600">{preview}</p>
    </Link>
  );
}

function PinnedChip({ note }: { note: Note }) {
  const title = useNoteTitle(note);
  return (
    <Link href={recentNoteHref(note)} className="inline-flex min-h-10 max-w-full items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-3 text-sm font-semibold text-indigo-900 hover:border-indigo-500">
      <Pin size={14} aria-hidden="true" /><span className="truncate">{title}</span>
    </Link>
  );
}

function InviteRow({ invite, currentTime, canAccept, onAccept, onDecline }: {
  invite: CollabInvite;
  currentTime: number | null;
  canAccept: boolean;
  onAccept: () => Promise<void>;
  onDecline: () => Promise<void>;
}) {
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);
  const [error, setError] = useState("");
  const run = async (kind: "accept" | "decline", action: () => Promise<void>) => {
    setBusy(kind);
    setError("");
    try { await action(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "That didn't work. Please try again."); }
    finally { setBusy(null); }
  };
  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <p className="text-sm text-slate-800">
        <span className="font-bold">{invite.senderName || invite.senderEmail}</span> invited you to a shared note
      </p>
      <p className="mt-0.5 text-xs text-slate-600">{formatRelativeTime(invite.createdAt, currentTime)}, {invite.permission === "viewer" ? "can view" : "can edit"}</p>
      <div className="mt-2 flex gap-2">
        <button type="button" disabled={!canAccept || busy !== null} onClick={() => void run("accept", onAccept)} className="btn-secondary min-h-10 px-3">
          {busy === "accept" ? <LoaderCircle size={15} className="animate-spin" aria-hidden="true" /> : <Check size={15} aria-hidden="true" />} Accept
        </button>
        <button type="button" disabled={busy !== null} onClick={() => void run("decline", onDecline)} className="btn-quiet min-h-10 px-3">
          {busy === "decline" ? <LoaderCircle size={15} className="animate-spin" aria-hidden="true" /> : <X size={15} aria-hidden="true" />} Decline
        </button>
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    </li>
  );
}

export default function Home() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const { user, loading } = useAuth();
  const { publicKey, privateKey, isReady: keysReady, hasKeys, needsVaultSetup, openVaultSetup } = useUserKeys();
  const vault = useVaultStatus();
  const { invites, friendRequests, loaded: inboxLoaded } = useInbox();

  const [notes, setNotes] = useState<Note[] | null>(null);
  const { pinnedIds } = useNotePins(user?.uid);
  const [groups, setGroups] = useState<Group[]>([]);
  const { draft, update: updateDraft, clear: clearDraft } = useNoteDraft(user?.uid);
  const { mode: noteMode, title, content } = draft;
  const setNoteMode = (mode: NoteMode) => updateDraft({ mode });
  const setTitle = (value: string) => updateDraft({ title: value });
  const setContent = (value: string) => updateDraft({ content: value });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [currentTime, setCurrentTime] = useState<number | null>(null);

  useEffect(() => {
    const updateClock = () => setCurrentTime(Date.now());
    const initialTimer = window.setTimeout(updateClock, 0);
    const clockInterval = window.setInterval(updateClock, 60_000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(clockInterval);
    };
  }, []);

  useEffect(() => {
    if (!user || !hasValidConfig) return;
    return subscribeToNotes(user.uid, setNotes);
  }, [user]);

  useEffect(() => {
    if (!user || !hasValidConfig) return;
    const groupsQuery = query(
      collection(db, "groups"),
      where("authorId", "==", user.uid)
    );
    return onSnapshot(
      groupsQuery,
      (snapshot) => {
        const nextGroups = snapshot.docs.map((groupDocument) => ({
          id: groupDocument.id,
          ...groupDocument.data(),
        })) as Group[];
        nextGroups.sort((a, b) => a.title.localeCompare(b.title));
        setGroups(nextGroups);
      },
      (error) => console.error("Home groups subscription error:", error)
    );
  }, [user]);

  const allNotes = useMemo(() => notes ?? [], [notes]);
  const recentNotes = useMemo(
    () =>
      [...allNotes]
        .sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt))
        .slice(0, 4),
    [allNotes]
  );
  const pinnedNotes = useMemo(() => allNotes.filter((note) => pinnedIds.has(note.id)).slice(0, 3), [allNotes, pinnedIds]);

  const groupCounts = useMemo(() => {
    const counts = new Map<string, number>();
    groups.forEach((group) => counts.set(group.id, 0));
    allNotes.forEach((note) => {
      note.groupIds?.forEach((groupId) => {
        if (counts.has(groupId)) counts.set(groupId, (counts.get(groupId) ?? 0) + 1);
      });
    });
    return counts;
  }, [groups, allNotes]);

  const modeNeedsVault = noteMode !== "normal";
  const vaultAvailable = keysReady && hasKeys && Boolean(publicKey);
  const canSubmit =
    title.trim().length > 0 &&
    content.trim().length > 0 &&
    !saving &&
    (!modeNeedsVault || vaultAvailable);

  async function handleQuickCapture(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || !hasValidConfig || !canSubmit) return;

    setSaving(true);
    setSaved(false);
    setSaveError(null);

    try {
      const validNote = noteSchema.parse({ title, content });
      if (noteMode === "normal") {
        await createNormalNote(user.uid, validNote.title, validNote.content);
      } else if (noteMode === "secure") {
        if (!publicKey) throw new Error("Your vault is not ready yet.");
        await createSecureNote(user.uid, validNote.title, validNote.content, [], publicKey);
      } else {
        if (!publicKey) throw new Error("Your vault is not ready yet.");
        const noteId = await createCollabNote(
          user.uid,
          validNote.title,
          validNote.content,
          [],
          publicKey
        );
        clearDraft();
        router.push(`/collab/${noteId}`);
        return;
      }

      clearDraft();
      setSaved(true);
      window.setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Could not save your note.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center" aria-label="Loading Notes Taker">
        <h1 className="text-3xl font-bold tracking-tight">Notes Taker</h1>
        <p className="max-w-xl text-sm leading-6 text-slate-700">Capture and organize personal notes, protect private writing with encryption, and collaborate on shared notes in real time.</p>
        <LoaderCircle className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
        <p className="text-sm text-slate-600">Opening your workspace…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="relative flex-1 overflow-hidden px-4 py-16 sm:px-6 sm:py-24">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.12),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.10),transparent_34%)]" aria-hidden="true" />
        <div className="relative mx-auto flex max-w-3xl flex-col gap-6">
          <h1 className="max-w-2xl text-4xl font-bold tracking-tight sm:text-6xl">
            Notes Taker for <span className="italic text-primary-strong">every idea.</span>
          </h1>
          <p className="max-w-xl text-lg leading-relaxed text-slate-700">
            Capture ideas, organize your notes, protect private writing, and work together in real time.
          </p>
          <p className="text-sm font-semibold text-slate-700">Sign in at the top of the page to open your workspace.</p>
          <ul className="mt-6 grid w-full gap-x-8 gap-y-6 border-t border-slate-200 pt-8 sm:grid-cols-3">
            <li><PenLine size={20} className="text-indigo-700" aria-hidden="true" /><h2 className="mt-3 text-sm font-bold">Write and organize</h2><p className="mt-1 text-sm leading-6 text-slate-700">Keep your thoughts in notes and groups, with search when you need them.</p></li>
            <li><Lock size={20} className="text-indigo-700" aria-hidden="true" /><h2 className="mt-3 text-sm font-bold">Private notes</h2><p className="mt-1 text-sm leading-6 text-slate-700">Choose encrypted notes for writing you want to keep private.</p></li>
            <li><Users size={20} className="text-indigo-700" aria-hidden="true" /><h2 className="mt-3 text-sm font-bold">Create together</h2><p className="mt-1 text-sm leading-6 text-slate-700">Invite friends to collaborate on shared notes as you type.</p></li>
          </ul>
        </div>
      </div>
    );
  }

  const firstName = getFirstName(user.displayName);
  const vaultNeedsAction = vault.kind === "locked" || vault.kind === "setup" || vault.kind === "error";
  const VaultIcon = vault.icon;
  const enter = (delay: number) => reduceMotion
    ? {}
    : { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { delay, duration: 0.3 } };

  return (
    <div className="relative flex-1">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <motion.header {...enter(0)} className="mb-6">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {getGreeting(currentTime)}{firstName ? `, ${firstName}` : ""}.
          </h1>
          <p className="mt-1.5 text-sm text-slate-600 sm:text-base">
            {notes === null
              ? "Loading your notes…"
              : notes.length === 0
                ? "Your next idea starts here."
                : `${notes.length} ${notes.length === 1 ? "note" : "notes"}, ${groups.length} ${groups.length === 1 ? "group" : "groups"}`}
          </p>
        </motion.header>

        {vaultNeedsAction && (
          <motion.div {...enter(0.03)} role="status" className={`mb-5 flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between ${vault.tone}`}>
            <div className="flex items-start gap-3">
              <VaultIcon size={20} className="mt-0.5 shrink-0" aria-hidden="true" />
              <div>
                <p className="font-bold">{vault.title}</p>
                <p className="text-sm">{vault.description}</p>
              </div>
            </div>
            {needsVaultSetup
              ? <button type="button" onClick={openVaultSetup} className="btn-secondary shrink-0">Set recovery password</button>
              : <Link href="/settings" className="btn-secondary shrink-0">Open vault settings</Link>}
          </motion.div>
        )}

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <div className="flex flex-col gap-5 lg:col-span-8">
            <motion.form {...enter(0.06)} onSubmit={handleQuickCapture} className="card p-5 sm:p-6" aria-labelledby="quick-capture-title">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <h2 id="quick-capture-title" className="text-lg font-bold tracking-tight">Quick capture</h2>
                <NoteModePicker
                  value={noteMode}
                  onChange={(mode) => { setNoteMode(mode); setSaveError(null); setSaved(false); }}
                  showDescription={false}
                />
              </div>

              <label className="sr-only" htmlFor="quick-note-title">Note title</label>
              <input
                id="quick-note-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Title"
                autoComplete="off"
                maxLength={100}
                className="w-full border-b border-slate-200 bg-transparent pb-3 text-lg font-bold placeholder:text-slate-500 focus:border-primary-strong focus:outline-none"
              />
              <label className="sr-only" htmlFor="quick-note-content">Note content</label>
              <textarea
                id="quick-note-content"
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder="What's on your mind? Keep it short, or expand it into a full note later."
                maxLength={5000}
                className="mt-3 min-h-28 w-full resize-none bg-transparent text-[15px] leading-7 placeholder:text-slate-500 focus:outline-none sm:min-h-32"
              />

              {modeNeedsVault && !vaultAvailable && (
                <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-sm font-medium text-amber-900">
                  <LockKeyhole size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                  Unlock or set up your vault before creating this note type.
                </div>
              )}

              <div className="flex flex-col gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-h-5 text-sm font-medium" aria-live="polite">
                  {saveError ? (
                    <span className="text-red-700">{saveError}</span>
                  ) : saved ? (
                    <span className="flex items-center gap-1.5 text-emerald-800"><Check size={15} aria-hidden="true" /> Saved to your notes</span>
                  ) : (
                    <Link href="/write" className="inline-flex min-h-11 items-center text-sm font-semibold text-indigo-800 hover:underline">
                      Add images, groups or collaborators
                    </Link>
                  )}
                </div>
                <button type="submit" disabled={!canSubmit} className="btn-primary">
                  {saving ? <LoaderCircle size={16} className="animate-spin" aria-hidden="true" /> : <ArrowRight size={16} aria-hidden="true" />}
                  {saving ? "Saving" : noteMode === "collab" ? "Create shared note" : "Save note"}
                </button>
              </div>
            </motion.form>

            <motion.section {...enter(0.1)} aria-labelledby="recent-title">
              <div className="mb-3 flex items-center justify-between">
                <h2 id="recent-title" className="text-lg font-bold tracking-tight">Continue writing</h2>
                <Link href="/notes" className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-indigo-800 hover:bg-indigo-50">
                  All notes <ArrowRight size={15} aria-hidden="true" />
                </Link>
              </div>

              {pinnedNotes.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2" aria-label="Pinned notes">
                  {pinnedNotes.map((note) => <PinnedChip key={note.id} note={note} />)}
                </div>
              )}
              {notes === null ? (
                <div className="grid gap-3 sm:grid-cols-2" aria-busy="true" aria-label="Loading recent notes">
                  {[0, 1].map((index) => <div key={index} className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-white" />)}
                </div>
              ) : recentNotes.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {recentNotes.map((note) => <RecentNoteCard key={note.id} note={note} currentTime={currentTime} />)}
                </div>
              ) : (
                <div className="flex min-h-36 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 px-6 text-center">
                  <PenLine size={22} className="mb-2 text-indigo-700" aria-hidden="true" />
                  <p className="text-sm font-bold text-slate-900">No notes yet</p>
                  <p className="mt-1 text-sm text-slate-600">Use quick capture above to save your first thought.</p>
                </div>
              )}
            </motion.section>
          </div>

          {/* On phones, waiting invitations jump above quick capture so they aren't missed. */}
          <div className={`flex flex-col gap-5 lg:order-none lg:col-span-4 ${invites.length + friendRequests.length > 0 ? "order-first" : ""}`}>
            <motion.section {...enter(0.08)} aria-labelledby="inbox-title" className="panel p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 id="inbox-title" className="flex items-center gap-2 text-lg font-bold tracking-tight">
                  <Inbox size={18} aria-hidden="true" /> Inbox
                </h2>
                {invites.length + friendRequests.length > 0 && (
                  <span className="rounded-full bg-rose-600 px-2 py-0.5 text-xs font-bold text-white">{invites.length + friendRequests.length}</span>
                )}
              </div>
              {!inboxLoaded ? (
                <div className="mt-4 h-16 animate-pulse rounded-xl bg-slate-100" aria-label="Loading inbox" />
              ) : invites.length === 0 && friendRequests.length === 0 ? (
                <p className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                  <CheckCheck size={16} className="text-emerald-700" aria-hidden="true" /> All caught up
                </p>
              ) : (
                <div className="mt-4">
                  {invites.length > 0 && (
                    <>
                      {!privateKey && <p className="mb-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">Unlock your vault to accept shared notes.</p>}
                      <ul className="divide-y divide-slate-200">
                        {invites.slice(0, 3).map((invite) => (
                          <InviteRow
                            key={invite.id}
                            invite={invite}
                            currentTime={currentTime}
                            canAccept={Boolean(privateKey)}
                            onAccept={async () => {
                              if (!privateKey) throw new Error("Unlock your vault to accept this invitation.");
                              await acceptInvite(invite.id, user.uid, privateKey);
                              router.push(`/collab/${invite.noteId}`);
                            }}
                            onDecline={() => rejectInvite(invite.id)}
                          />
                        ))}
                      </ul>
                    </>
                  )}
                  {friendRequests.length > 0 && (
                    <Link href="/friends" className={`flex min-h-11 items-center gap-2 rounded-xl text-sm font-semibold text-indigo-800 hover:underline ${invites.length > 0 ? "mt-3 border-t border-slate-200 pt-3" : ""}`}>
                      <UserPlus size={16} aria-hidden="true" />
                      {friendRequests.length} friend {friendRequests.length === 1 ? "request" : "requests"} waiting
                    </Link>
                  )}
                  {invites.length > 3 && (
                    <Link href="/friends" className="mt-2 inline-flex min-h-10 items-center text-sm font-semibold text-indigo-800 hover:underline">
                      See all {invites.length} invitations
                    </Link>
                  )}
                </div>
              )}
            </motion.section>

            <motion.section {...enter(0.12)} aria-labelledby="groups-title" className="panel p-5">
              <div className="mb-3 flex items-center justify-between">
                <h2 id="groups-title" className="text-lg font-bold tracking-tight">Groups</h2>
                <Link href="/groups" className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-indigo-800 hover:bg-indigo-50">
                  Manage <ArrowRight size={15} aria-hidden="true" />
                </Link>
              </div>
              {groups.length > 0 ? (
                <ul className="-mx-2">
                  {groups.slice(0, 5).map((group) => (
                    <li key={group.id}>
                      <Link href={`/groups/${group.id}`} className="flex min-h-11 items-center gap-3 rounded-xl px-2 hover:bg-slate-100">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${group.color}1f`, color: group.color }}>
                          <FolderOpen size={16} aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">{group.title}</span>
                        <span className="text-xs tabular-nums text-slate-600">{groupCounts.get(group.id) ?? 0}</span>
                      </Link>
                    </li>
                  ))}
                  {groups.length > 5 && (
                    <li><Link href="/groups" className="flex min-h-10 items-center px-2 text-sm font-semibold text-indigo-800 hover:underline">{groups.length - 5} more</Link></li>
                  )}
                </ul>
              ) : (
                <Link href="/groups" className="flex min-h-24 flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 text-center hover:border-indigo-400 hover:bg-indigo-50/50">
                  <FolderPlus size={20} className="mb-1.5 text-indigo-700" aria-hidden="true" />
                  <span className="text-sm font-bold text-slate-900">Create your first group</span>
                  <span className="text-xs text-slate-600">Keep related notes together.</span>
                </Link>
              )}
            </motion.section>
          </div>
        </div>
      </div>
    </div>
  );
}
