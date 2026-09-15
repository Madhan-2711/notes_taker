"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BookOpen,
  Check,
  Clock3,
  FolderOpen,
  FolderPlus,
  Lock,
  LockKeyhole,
  LoaderCircle,
  MessageSquareMore,
  PenLine,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { useUserKeys } from "../hooks/useUserKeys";
import { db, hasValidConfig } from "../lib/firebaseConfig";
import {
  getNoteContent,
  getNoteTitle,
  isCollabNote,
  noteSchema,
  type CollabInvite,
  type Group,
  type Note,
  type NoteMode,
} from "../lib/validations";
import { createNormalNote, subscribeToNotes } from "../lib/services/notes/normalNotesService";
import { createSecureNote } from "../lib/services/notes/secureNotesService";
import { createCollabNote } from "../lib/services/notes/collaborativeNotesService";
import { subscribeToInvites } from "../lib/services/social/collaborationService";

const NOTE_MODES: Array<{
  value: NoteMode;
  label: string;
  description: string;
  icon: typeof PenLine;
}> = [
  { value: "normal", label: "Note", description: "Quick and searchable", icon: PenLine },
  { value: "secure", label: "Private", description: "End-to-end encrypted", icon: Lock },
  { value: "collab", label: "Shared", description: "Edit together live", icon: Users },
];

function getFirstName(displayName: string | null): string {
  return displayName?.trim().split(/\s+/)[0] || "Writer";
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

function modeDetails(note: Note) {
  if (note.mode === "secure") {
    return { label: "Private", icon: Lock, tone: "text-amber-700 bg-amber-500/10" };
  }
  if (note.mode === "collab") {
    return { label: "Shared", icon: Users, tone: "text-rose-700 bg-rose-500/10" };
  }
  return { label: "Note", icon: PenLine, tone: "text-indigo-700 bg-indigo-500/10" };
}

export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const {
    publicKey,
    isReady: keysReady,
    hasKeys,
    needsVaultPassword,
    needsVaultSetup,
    openVaultSetup,
    error: vaultError,
  } = useUserKeys();

  const [notes, setNotes] = useState<Note[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [invites, setInvites] = useState<CollabInvite[]>([]);
  const [noteMode, setNoteMode] = useState<NoteMode>("normal");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
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

  useEffect(() => {
    if (!user || !hasValidConfig) return;
    return subscribeToInvites(user.uid, setInvites);
  }, [user]);

  const recentNotes = useMemo(
    () =>
      [...notes]
        .sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt))
        .slice(0, 4),
    [notes]
  );

  const groupCounts = useMemo(() => {
    const counts = new Map<string, number>();
    groups.forEach((group) => counts.set(group.id, 0));
    notes.forEach((note) => {
      note.groupIds?.forEach((groupId) => {
        if (counts.has(groupId)) counts.set(groupId, (counts.get(groupId) ?? 0) + 1);
      });
    });
    return counts;
  }, [groups, notes]);

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
        router.push(`/collab/${noteId}`);
        return;
      }

      setTitle("");
      setContent("");
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
      <div className="flex-1 flex items-center justify-center" aria-label="Loading dashboard">
        <LoaderCircle className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="relative flex-1 overflow-hidden px-6 py-20">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.14),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.12),transparent_34%)]" />
        <div className="relative mx-auto flex max-w-2xl flex-col items-center gap-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary shadow-sm">
            <Sparkles size={25} />
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            Thoughts, <span className="text-primary italic">elevated.</span>
          </h1>
          <p className="max-w-xl text-lg leading-relaxed text-foreground/60 sm:text-xl">
            A calm, secure workspace for personal notes and real-time collaboration.
          </p>
          <p className="rounded-full border border-border bg-white/70 px-5 py-2.5 text-sm font-semibold shadow-sm backdrop-blur">
            Sign in to open your workspace
          </p>
        </div>
      </div>
    );
  }

  const latestInvite = invites[0];
  const vaultState = vaultError
    ? {
        title: "Vault needs attention",
        description: vaultError,
        icon: ShieldAlert,
        tone: "border-rose-200 bg-rose-50 text-rose-700",
      }
    : !keysReady
      ? {
          title: "Checking your vault",
          description: "Confirming encryption is ready on this device.",
          icon: LoaderCircle,
          tone: "border-slate-200 bg-slate-50 text-slate-600",
        }
      : needsVaultPassword
        ? {
            title: "Vault is locked",
            description: "Enter your vault password to open private and shared notes.",
            icon: LockKeyhole,
            tone: "border-amber-200 bg-amber-50 text-amber-700",
          }
        : needsVaultSetup
          ? {
              title: "Finish vault setup",
              description: "Create a recovery password to protect your encryption key.",
              icon: ShieldAlert,
              tone: "border-amber-200 bg-amber-50 text-amber-700",
            }
          : {
              title: "Vault protected",
              description: "Private and shared notes are ready on this device.",
              icon: ShieldCheck,
              tone: "border-emerald-200 bg-emerald-50 text-emerald-700",
            };
  const VaultIcon = vaultState.icon;

  return (
    <div className="relative flex-1 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_8%_2%,rgba(99,102,241,0.12),transparent_26%),radial-gradient(circle_at_92%_18%,rgba(16,185,129,0.10),transparent_24%)]" />
      <div className="relative mx-auto w-full max-w-7xl px-4 py-7 sm:px-6 sm:py-10 lg:px-8">
        <motion.header
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"
        >
          <div>
            <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-primary">
              <Sparkles size={14} /> Your workspace
            </p>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              {getGreeting(currentTime)}, {getFirstName(user.displayName)}.
            </h1>
            <p className="mt-2 text-sm text-foreground/50 sm:text-base">
              {notes.length === 0
                ? "Your next idea starts here."
                : `${notes.length} ${notes.length === 1 ? "note" : "notes"} · ${groups.length} ${groups.length === 1 ? "group" : "groups"}${invites.length ? ` · ${invites.length} waiting` : ""}`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/notes"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-white/70 px-4 py-2.5 text-sm font-semibold shadow-sm backdrop-blur transition hover:border-primary/30 hover:text-primary"
            >
              <BookOpen size={16} /> My notes
            </Link>
            <Link
              href="/write"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground shadow-[3px_3px_0_0_#0f172a] transition hover:-translate-y-0.5 hover:shadow-[4px_4px_0_0_#0f172a]"
            >
              <Plus size={16} /> New note
            </Link>
          </div>
        </motion.header>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <motion.form
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.06 }}
            onSubmit={handleQuickCapture}
            className="glass rounded-[28px] border border-white/70 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] sm:p-7 lg:col-span-8"
          >
            <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-foreground/35">Quick capture</p>
                <h2 className="mt-1 text-xl font-bold tracking-tight">What’s on your mind?</h2>
              </div>
              <div className="grid grid-cols-3 rounded-2xl border border-border/70 bg-slate-50/80 p-1" aria-label="Note type">
                {NOTE_MODES.map(({ value, label, icon: Icon }) => {
                  const selected = noteMode === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        setNoteMode(value);
                        setSaveError(null);
                        setSaved(false);
                      }}
                      className={`flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition sm:px-4 ${
                        selected
                          ? "bg-white text-primary shadow-sm ring-1 ring-border/70"
                          : "text-foreground/45 hover:text-foreground"
                      }`}
                      aria-pressed={selected}
                    >
                      <Icon size={14} />
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <label className="sr-only" htmlFor="quick-note-title">Note title</label>
            <input
              id="quick-note-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Give this thought a title"
              maxLength={100}
              className="w-full border-b border-border/70 bg-transparent pb-3 text-lg font-bold outline-none placeholder:text-foreground/25 focus:border-primary"
            />
            <label className="sr-only" htmlFor="quick-note-content">Note content</label>
            <textarea
              id="quick-note-content"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="Start typing — keep it short or turn it into something bigger later..."
              maxLength={5000}
              className="mt-4 min-h-28 w-full resize-none bg-transparent text-sm leading-7 outline-none placeholder:text-foreground/25 sm:min-h-32"
            />

            {modeNeedsVault && !vaultAvailable && (
              <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-medium text-amber-700">
                <LockKeyhole size={15} className="mt-0.5 shrink-0" />
                Finish unlocking or setting up your vault before creating this note type.
              </div>
            )}

            <div className="flex flex-col gap-3 border-t border-border/50 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-h-5 text-xs font-medium" aria-live="polite">
                {saveError ? (
                  <span className="text-rose-600">{saveError}</span>
                ) : saved ? (
                  <span className="flex items-center gap-1.5 text-emerald-600"><Check size={14} /> Saved to your notes</span>
                ) : (
                  <span className="text-foreground/35">
                    {NOTE_MODES.find((mode) => mode.value === noteMode)?.description}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Link href="/write" className="text-xs font-semibold text-foreground/45 hover:text-primary">
                  More options
                </Link>
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-foreground px-5 py-2.5 text-sm font-bold text-white transition hover:bg-primary disabled:cursor-not-allowed disabled:opacity-35"
                >
                  {saving ? <LoaderCircle size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                  {saving ? "Saving" : noteMode === "collab" ? "Create room" : "Save note"}
                </button>
              </div>
            </div>
          </motion.form>

          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-[28px] border border-slate-900 bg-slate-950 p-5 text-white shadow-[5px_5px_0_0_rgba(99,102,241,0.45)] sm:p-6 lg:col-span-4"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-white/40">Collaboration</p>
                <h2 className="mt-1 text-xl font-bold">Your inbox</h2>
              </div>
              <div className="relative flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
                <MessageSquareMore size={20} />
                {invites.length > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-6 min-w-6 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[11px] font-black ring-2 ring-slate-950">
                    {invites.length > 9 ? "9+" : invites.length}
                  </span>
                )}
              </div>
            </div>

            <div className="my-7">
              {latestInvite ? (
                <div>
                  <p className="text-3xl font-bold tracking-tight">{invites.length}</p>
                  <p className="mt-1 text-sm text-white/55">
                    {invites.length === 1 ? "invitation is waiting" : "invitations are waiting"}
                  </p>
                  <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs font-semibold text-white/40">Latest invitation</p>
                    <p className="mt-1 truncate font-bold">{latestInvite.senderName || latestInvite.senderEmail}</p>
                    <p className="mt-1 text-xs text-white/45">{formatRelativeTime(latestInvite.createdAt, currentTime)}</p>
                  </div>
                </div>
              ) : (
                <div className="py-4">
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-400/10 text-emerald-300">
                    <Check size={22} />
                  </div>
                  <p className="font-bold">You’re all caught up</p>
                  <p className="mt-2 text-sm leading-6 text-white/45">New collaboration invitations will appear here.</p>
                </div>
              )}
            </div>

            <Link
              href="/friends"
              className="flex items-center justify-between rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-indigo-50"
            >
              Open collaboration centre <ArrowRight size={16} />
            </Link>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.14 }}
            className="glass rounded-[28px] border border-white/70 p-5 sm:p-6 lg:col-span-8"
          >
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-foreground/35">Recently updated</p>
                <h2 className="mt-1 text-xl font-bold tracking-tight">Continue writing</h2>
              </div>
              <Link href="/notes" className="flex items-center gap-1.5 text-xs font-bold text-primary hover:underline">
                View all <ArrowRight size={14} />
              </Link>
            </div>

            {recentNotes.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {recentNotes.map((note) => {
                  const details = modeDetails(note);
                  const ModeIcon = details.icon;
                  return (
                    <Link
                      key={note.id}
                      href={isCollabNote(note) ? `/collab/${note.id}` : "/notes"}
                      className="group rounded-2xl border border-border/70 bg-white/65 p-4 transition hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-lg hover:shadow-primary/5"
                    >
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${details.tone}`}>
                          <ModeIcon size={12} /> {details.label}
                        </span>
                        <span className="flex items-center gap-1 text-[11px] font-medium text-foreground/35">
                          <Clock3 size={11} /> {formatRelativeTime(note.updatedAt || note.createdAt, currentTime)}
                        </span>
                      </div>
                      <h3 className="truncate font-bold tracking-tight group-hover:text-primary">{getNoteTitle(note)}</h3>
                      <p className="mt-1 line-clamp-2 min-h-10 text-xs leading-5 text-foreground/45">{getNoteContent(note)}</p>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="flex min-h-44 flex-col items-center justify-center rounded-2xl border border-dashed border-border text-center">
                <PenLine size={23} className="mb-3 text-foreground/20" />
                <p className="text-sm font-bold text-foreground/60">No notes yet</p>
                <p className="mt-1 text-xs text-foreground/35">Use quick capture to save your first thought.</p>
              </div>
            )}
          </motion.section>

          <motion.aside
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 }}
            className="glass rounded-[28px] border border-white/70 p-5 sm:p-6 lg:col-span-4"
          >
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-foreground/35">Security</p>
            <h2 className="mt-1 text-xl font-bold tracking-tight">Vault status</h2>
            <div className={`mt-5 rounded-2xl border p-4 ${vaultState.tone}`}>
              <VaultIcon className={`h-7 w-7 ${!keysReady ? "animate-spin" : ""}`} />
              <h3 className="mt-4 font-bold">{vaultState.title}</h3>
              <p className="mt-1 text-xs leading-5 opacity-75">{vaultState.description}</p>
            </div>
            {needsVaultSetup ? (
              <button
                type="button"
                onClick={openVaultSetup}
                className="mt-4 flex w-full items-center justify-between rounded-xl border border-border px-4 py-3 text-sm font-bold transition hover:border-primary/30 hover:text-primary"
              >
                Set recovery password <ArrowRight size={15} />
              </button>
            ) : (
              <Link
                href="/friends"
                className="mt-4 flex items-center justify-between rounded-xl border border-border px-4 py-3 text-sm font-bold transition hover:border-primary/30 hover:text-primary"
              >
                Manage vault backup <ArrowRight size={15} />
              </Link>
            )}
          </motion.aside>

          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.22 }}
            className="glass rounded-[28px] border border-white/70 p-5 sm:p-6 lg:col-span-12"
          >
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-foreground/35">Organise</p>
                <h2 className="mt-1 text-xl font-bold tracking-tight">Your groups</h2>
              </div>
              <Link href="/groups" className="flex items-center gap-1.5 text-xs font-bold text-primary hover:underline">
                Manage groups <ArrowRight size={14} />
              </Link>
            </div>

            {groups.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {groups.slice(0, 4).map((group) => (
                  <Link
                    key={group.id}
                    href={`/groups/${group.id}`}
                    className="group relative overflow-hidden rounded-2xl border border-border/70 bg-white/65 p-4 transition hover:-translate-y-0.5 hover:shadow-lg"
                  >
                    <span className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: group.color }} />
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: `${group.color}18`, color: group.color }}>
                        <FolderOpen size={18} />
                      </div>
                      <ArrowRight size={15} className="text-foreground/20 transition group-hover:translate-x-1 group-hover:text-primary" />
                    </div>
                    <h3 className="mt-4 truncate font-bold">{group.title}</h3>
                    <p className="mt-1 text-xs font-medium text-foreground/40">
                      {groupCounts.get(group.id) ?? 0} {(groupCounts.get(group.id) ?? 0) === 1 ? "note" : "notes"}
                    </p>
                  </Link>
                ))}
              </div>
            ) : (
              <Link
                href="/groups"
                className="flex min-h-32 flex-col items-center justify-center rounded-2xl border border-dashed border-border text-center transition hover:border-primary/40 hover:bg-primary/[0.03]"
              >
                <FolderPlus size={22} className="mb-2 text-primary" />
                <p className="text-sm font-bold">Create your first group</p>
                <p className="mt-1 text-xs text-foreground/35">Keep related notes together.</p>
              </Link>
            )}
          </motion.section>
        </div>
      </div>
    </div>
  );
}
