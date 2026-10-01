"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { NoteExport } from "./NoteExport";
import { NoteAttachments } from "./NoteAttachments";
import { RichNoteEditor } from "./RichNoteEditor";
import { deltaFromPlain, parseRichContent } from "../lib/richText";
import { NoteHistory } from "./NoteHistory";
import { NoteReminderControl, NoteTagEditor, useNoteArchive } from "./NoteOrganizer";
import { Dialog, useDialogTitleId } from "./ui/Dialog";
import { Menu, type MenuItem } from "./ui/Menu";
import { useNoteMeta } from "../contexts/NoteMetaContext";
import { useToast } from "../contexts/ToastContext";
import {
  type Note,
  type Group,
  isNormalNote,
  isSecureNote,
  isCollabNote,
  getNoteTitle,
  getNoteContent,
} from "../lib/validations";
import { ModeBadge } from "./ModeBadge";
import { readSecureNote } from "../lib/services/notes/secureNotesService";
import { X, Pencil, Clock, CalendarDays, Lock, Users, Loader2, Pin, Bell, Archive, ArchiveRestore, Download, History, Trash2 } from "lucide-react";

interface ViewNoteModalProps {
  note: Note | null;
  groups?: Group[];
  onClose: () => void;
  onEdit?: (note: Note) => void;
  /** Current user's ID for decryption */
  userId?: string;
  /** User's private key for decrypting secure notes */
  privateKey?: CryptoKey | null;
  pinned?: boolean;
  onTogglePin?: (id: string) => void;
  /** Moves the note to trash; only passed for notes the user owns. */
  onTrash?: (note: Note) => void;
}

type ToolPanel = "reminder" | "export" | "history" | null;

const PANEL_TITLES: Record<Exclude<ToolPanel, null>, string> = {
  reminder: "Reminder",
  export: "Export",
  history: "Version history",
};

export function ViewNoteModal(props: ViewNoteModalProps) {
  const titleId = useDialogTitleId();
  return (
    <Dialog open={Boolean(props.note)} onClose={props.onClose} labelledBy={titleId} size="xl" sheetOnMobile>
      {props.note && <ViewNoteBody key={props.note.id} {...props} note={props.note} titleId={titleId} />}
    </Dialog>
  );
}

function ViewNoteBody({
  note,
  groups = [],
  onClose,
  onEdit,
  userId,
  privateKey,
  pinned = false,
  onTogglePin,
  onTrash,
  titleId,
}: ViewNoteModalProps & { note: Note; titleId: string }) {
  const [decrypted, setDecrypted] = useState<{
    noteId: string; userId: string; key: CryptoKey; title: string; content: string; richContent: string | null;
  } | null>(null);
  const matchesNote = decrypted?.noteId === note.id && decrypted?.userId === userId && decrypted?.key === privateKey;
  const decryptedTitle = matchesNote ? decrypted?.title ?? null : null;
  const decryptedContent = matchesNote ? decrypted?.content ?? null : null;
  const decryptedRich = matchesNote ? decrypted?.richContent ?? null : null;
  const [decrypting, setDecrypting] = useState(false);
  const [decryptError, setDecryptError] = useState<string | null>(null);
  const [panel, setPanel] = useState<ToolPanel>(null);
  const { getMeta } = useNoteMeta();
  const { archived, setArchived } = useNoteArchive(note.id);
  const toast = useToast();

  // Decrypt secure notes on open
  useEffect(() => {
    if (!isSecureNote(note)) {
      // Changing the note intentionally clears decrypted UI state.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDecrypted(null);
      setDecryptError(null);
      return;
    }

    if (!userId || !privateKey) {
      setDecryptError("Encryption keys not available. Please set up your vault password.");
      return;
    }

    let cancelled = false;
    setDecrypting(true);
    setDecrypted(null);
    setDecryptError(null);

    readSecureNote(note.id, userId, privateKey)
      .then(({ title, content, richContent }) => {
        if (!cancelled) {
          setDecrypted({ noteId: note.id, userId, key: privateKey, title, content, richContent });
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setDecryptError(err instanceof Error ? err.message : "Failed to decrypt note");
        }
      })
      .finally(() => {
        if (!cancelled) setDecrypting(false);
      });

    return () => { cancelled = true; };
  }, [note, userId, privateKey]);

  const createdDate = new Date(note.createdAt).toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const createdTime = new Date(note.createdAt).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });

  const updatedDate =
    note.updatedAt !== note.createdAt
      ? new Date(note.updatedAt).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : null;

  const noteGroups = groups.filter((g) => note.groupIds?.includes(g.id));

  const displayTitle = isSecureNote(note)
    ? (decryptedTitle || getNoteTitle(note))
    : getNoteTitle(note);

  // Allow editing for normal notes AND decrypted secure notes
  const canEdit = isNormalNote(note) || (isSecureNote(note) && !!decryptedTitle);
  const organisable = Boolean(userId) && !isCollabNote(note);
  const canExport = isNormalNote(note) || (isSecureNote(note) && !decrypting && !decryptError && decryptedTitle !== null && decryptedContent !== null);
  const hasHistory = Boolean(userId) && note.authorId === userId && !isCollabNote(note);
  const reminderAt = getMeta(note.id).reminderAt;

  const togglePanel = (next: Exclude<ToolPanel, null>) => setPanel((current) => current === next ? null : next);

  const runArchive = async () => {
    const previous = archived;
    try {
      await setArchived(!previous);
      toast({ message: previous ? "Moved back to notes" : "Archived", actionLabel: "Undo", onAction: () => setArchived(previous) });
    } catch (caught) {
      toast({ message: caught instanceof Error ? caught.message : "Could not update archive.", tone: "error" });
    }
  };

  const menuItems: MenuItem[] = [
    ...(canExport ? [{ label: "Export", icon: Download, onSelect: () => togglePanel("export") }] : []),
    ...(hasHistory ? [{ label: "Version history", icon: History, onSelect: () => togglePanel("history") }] : []),
    ...(onTrash ? [{ label: "Move to trash", icon: Trash2, destructive: true, separated: true, onSelect: () => onTrash(note) }] : []),
  ];

  return (
    <>
      {/* Action bar: the most used actions sit on top, the rest in the overflow menu. */}
      <div className="flex shrink-0 items-center gap-1 border-b border-slate-200 px-2 py-2 sm:px-4">
        <button type="button" onClick={onClose} className="icon-btn" aria-label="Close">
          <X size={20} aria-hidden="true" />
        </button>
        <div className="ml-auto flex items-center gap-1">
          {onEdit && canEdit && (
            <button type="button" onClick={() => { onEdit(note); onClose(); }} className="btn-secondary mr-1 min-h-10 px-3" data-autofocus>
              <Pencil size={15} aria-hidden="true" /> Edit
            </button>
          )}
          {onTogglePin && (
            <button type="button" onClick={() => onTogglePin(note.id)} aria-pressed={pinned} aria-label={pinned ? "Unpin note" : "Pin note"} title={pinned ? "Unpin" : "Pin"}
              className={`icon-btn ${pinned ? "text-indigo-700" : ""}`}>
              <Pin size={18} fill={pinned ? "currentColor" : "none"} aria-hidden="true" />
            </button>
          )}
          {organisable && (
            <>
              <button type="button" onClick={() => togglePanel("reminder")} aria-expanded={panel === "reminder"} aria-label={reminderAt ? "Reminder set, change reminder" : "Set reminder"} title="Reminder"
                className={`icon-btn ${reminderAt ? "text-amber-700" : ""} ${panel === "reminder" ? "bg-slate-100" : ""}`}>
                <Bell size={18} fill={reminderAt ? "currentColor" : "none"} aria-hidden="true" />
              </button>
              <button type="button" onClick={() => void runArchive()} aria-label={archived ? "Unarchive note" : "Archive note"} title={archived ? "Unarchive" : "Archive"} className="icon-btn">
                {archived ? <ArchiveRestore size={18} aria-hidden="true" /> : <Archive size={18} aria-hidden="true" />}
              </button>
            </>
          )}
          {menuItems.length > 0 && <Menu items={menuItems} label="More note actions" />}
        </div>
      </div>

      {panel && (
        <section aria-label={PANEL_TITLES[panel]} className="shrink-0 border-b border-slate-200 bg-slate-50 px-4 py-4 sm:px-8">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">{PANEL_TITLES[panel]}</h3>
            <button type="button" onClick={() => setPanel(null)} className="icon-btn -my-2 -mr-2" aria-label={`Close ${PANEL_TITLES[panel]}`}><X size={16} aria-hidden="true" /></button>
          </div>
          <div className="max-h-[40dvh] overflow-y-auto">
            {panel === "reminder" && <NoteReminderControl noteId={note.id} />}
            {panel === "export" && (isNormalNote(note)
              ? <NoteExport title={note.title} content={note.content} delta={parseRichContent(note.richContent)} images={userId ? { noteId: note.id, userId, privateKey: null } : null} />
              : decryptedTitle !== null && decryptedContent !== null && <NoteExport title={decryptedTitle} content={decryptedContent} delta={parseRichContent(decryptedRich)} images={userId ? { noteId: note.id, userId, privateKey: privateKey ?? null } : null} encrypted />)}
            {panel === "history" && userId && <NoteHistory key={`history:${note.id}`} note={note} userId={userId} privateKey={privateKey ?? null} onRestored={onClose} />}
          </div>
        </section>
      )}

      {/* Scrollable body */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8 sm:py-7">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <ModeBadge mode={note.mode || "normal"} hideNormal />
          {archived && <span className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700"><Archive size={12} aria-hidden="true" /> Archived</span>}
          {noteGroups.map((g) => (
            <span key={g.id} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-semibold text-slate-800">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: g.color }} aria-hidden="true" />
              {g.title}
            </span>
          ))}
        </div>

        <h2 id={titleId} className="mb-3 break-words text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
          {displayTitle}
        </h2>

        <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-slate-600">
          <span className="flex items-center gap-1.5">
            <CalendarDays size={14} aria-hidden="true" />
            {createdDate}, {createdTime}
          </span>
          {updatedDate && (
            <span className="flex items-center gap-1.5">
              <Clock size={14} aria-hidden="true" />
              Edited {updatedDate}
            </span>
          )}
        </div>

        {organisable && <div className="mb-6"><NoteTagEditor noteId={note.id} /></div>}

        <div className="mb-6 h-px bg-slate-200" />

        {/* Content: mode-aware rendering */}
        {isSecureNote(note) ? (
          decrypting ? (
            <div className="space-y-3" aria-busy="true" aria-label="Decrypting note">
              <div className="h-4 w-11/12 animate-pulse rounded bg-slate-200" />
              <div className="h-4 w-4/5 animate-pulse rounded bg-slate-200" />
              <div className="h-4 w-2/3 animate-pulse rounded bg-slate-200" />
              <p className="flex items-center gap-2 pt-2 text-sm text-slate-600"><Loader2 size={15} className="animate-spin" aria-hidden="true" /> Decrypting on this device…</p>
            </div>
          ) : decryptError ? (
            <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50">
                <Lock size={26} className="text-red-700" aria-hidden="true" />
              </div>
              <div>
                <p className="text-lg font-semibold text-slate-900">Couldn&apos;t decrypt this note</p>
                <p className="mt-1 max-w-sm text-sm text-slate-600">{decryptError}</p>
              </div>
              <div className="max-w-sm rounded-xl border border-amber-300 bg-amber-50 p-3 text-left text-sm text-amber-900">
                On a different device? Restore the keys from the device that created this note in{" "}
                <Link href="/settings" className="font-semibold underline">Settings, Vault and encryption keys</Link>.
              </div>
            </div>
          ) : decryptedContent ? (
            <RichNoteEditor
              key={`${note.id}:${note.updatedAt}`}
              readOnly
              initial={parseRichContent(decryptedRich) ?? deltaFromPlain(decryptedContent)}
              images={userId ? { noteId: note.id, userId, privateKey: privateKey ?? null } : null}
            />
          ) : (
            <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50">
                <Lock size={26} className="text-indigo-700" aria-hidden="true" />
              </div>
              <p className="text-sm text-slate-600">Encrypted content</p>
            </div>
          )
        ) : isCollabNote(note) ? (
          <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50">
              <Users size={26} className="text-emerald-700" aria-hidden="true" />
            </div>
            <div>
              <p className="text-lg font-semibold text-slate-900">Shared note</p>
              <p className="mt-1 max-w-sm text-sm text-slate-600">
                Open the live editor to view and edit this note with your collaborators.
              </p>
            </div>
            <Link href={`/collab/${note.id}`} className="btn-primary">Open editor</Link>
          </div>
        ) : (
          <RichNoteEditor
            key={`${note.id}:${note.updatedAt}`}
            readOnly
            initial={(isNormalNote(note) && parseRichContent(note.richContent)) || deltaFromPlain(getNoteContent(note))}
            images={userId ? { noteId: note.id, userId, privateKey: null } : null}
          />
        )}
        {isNormalNote(note) && userId && <NoteAttachments key={`${userId}:${note.id}`} noteId={note.id} userId={userId} privateKey={null} knownNote={note} />}
        {isSecureNote(note) && userId && privateKey && <NoteAttachments key={`${userId}:${note.id}`} noteId={note.id} userId={userId} privateKey={privateKey} knownNote={note} />}
      </div>
    </>
  );
}
