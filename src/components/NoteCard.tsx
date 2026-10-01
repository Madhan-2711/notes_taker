"use client";

import { motion, useReducedMotion } from "framer-motion";
import {
  type Note,
  type Group,
  isSecureNote,
  isCollabNote,
  getNoteContent,
} from "../lib/validations";
import { ModeBadge } from "./ModeBadge";
import { Menu, type MenuItem } from "./ui/Menu";
import { previewText } from "../lib/inlineImages";
import { useNow } from "../hooks/useNow";
import { useNoteTitle } from "../hooks/useNoteTitle";
import { Trash2, Pencil, Users, Pin, Bell, ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";

interface NoteCardProps {
  note: Note;
  groups?: Group[];
  /** Moves the note to trash; the page offers Undo. */
  onDelete: (id: string) => void;
  onEdit?: (note: Note) => void;
  onView?: (note: Note) => void;
  pinned?: boolean;
  onTogglePin?: (id: string) => void;
  canDelete?: boolean;
  tags?: string[];
  reminderAt?: number | null;
}

export function NoteCard({ note, groups = [], onDelete, onEdit, onView, pinned = false, onTogglePin, canDelete = true, tags = [], reminderAt = null }: NoteCardProps) {
  const router = useRouter();
  const now = useNow();
  const reduceMotion = useReducedMotion();
  const displayTitle = useNoteTitle(note);

  // Derive groups this note belongs to
  const noteGroups = groups.filter((g) => note.groupIds?.includes(g.id));

  // Encrypted notes show a placeholder until opened
  const displayContent = isSecureNote(note)
    ? "End-to-end encrypted. Open to read."
    : previewText(getNoteContent(note));

  const open = () => isCollabNote(note) ? router.push(`/collab/${note.id}`) : onView?.(note);
  // Shared notes are edited in the live editor, not the edit dialog.
  const canEdit = !isCollabNote(note);

  const menuItems: MenuItem[] = [
    { label: "Open", icon: ExternalLink, onSelect: open },
    ...(onEdit && canEdit ? [{ label: "Edit", icon: Pencil, onSelect: () => onEdit(note) }] : []),
    ...(canDelete ? [{ label: "Move to trash", icon: Trash2, destructive: true, separated: true, onSelect: () => onDelete(note.id) }] : []),
  ];

  return (
    <motion.article
      layout={!reduceMotion}
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.2 }}
      className="card group relative flex min-h-44 flex-col gap-2 p-5 transition-[box-shadow,transform] duration-200 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[var(--neubrutalism-shadow-hover)] focus-within:-translate-x-0.5 focus-within:-translate-y-0.5"
    >
      <button
        type="button"
        className="absolute inset-0 z-10 rounded-card focus-visible:outline-offset-4"
        aria-label={`Open ${displayTitle}`}
        onClick={open}
      />
      <div className="flex items-center gap-1">
        <ModeBadge mode={note.mode || "normal"} />
        <div className="relative z-20 -mr-2 -mt-2 ml-auto flex items-center">
          {onTogglePin && (
            <button
              type="button"
              onClick={() => onTogglePin(note.id)}
              aria-label={pinned ? `Unpin ${displayTitle}` : `Pin ${displayTitle}`}
              aria-pressed={pinned}
              className={`icon-btn ${pinned ? "text-indigo-700 hover:text-indigo-800" : ""}`}
            >
              <Pin size={17} fill={pinned ? "currentColor" : "none"} aria-hidden="true" />
            </button>
          )}
          <Menu items={menuItems} label={`More actions for ${displayTitle}`} />
        </div>
      </div>

      <h3 className="line-clamp-2 break-words text-lg font-bold leading-snug tracking-tight" title={displayTitle}>
        {displayTitle}
      </h3>

      <p className="line-clamp-5 flex-1 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">
        {displayContent}
      </p>

      {isCollabNote(note) && note.collaboratorIds?.length > 0 && (
        <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
          <Users size={13} aria-hidden="true" />
          {note.collaboratorIds.length} collaborator{note.collaboratorIds.length !== 1 ? "s" : ""}
        </div>
      )}

      {(tags.length > 0 || reminderAt) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {reminderAt && (
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${reminderAt < now ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-900"}`}>
              <Bell size={12} aria-hidden="true" /> {new Date(reminderAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
          {tags.slice(0, 3).map((tag) => (
            <span key={tag} className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-800">#{tag}</span>
          ))}
          {tags.length > 3 && <span className="text-xs font-semibold text-slate-600">+{tags.length - 3}</span>}
        </div>
      )}

      {/* Footer: date + group badges */}
      <div className="mt-1 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3">
        <time dateTime={new Date(note.createdAt).toISOString()} className="shrink-0 text-xs tabular-nums text-slate-600">
          {new Date(note.createdAt).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </time>
        {noteGroups.length > 0 && (
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            {noteGroups.slice(0, 2).map((g) => (
              <span key={g.id} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs font-semibold text-slate-800">
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: g.color }} aria-hidden="true" />
                {g.title}
              </span>
            ))}
            {noteGroups.length > 2 && (
              <span className="text-xs font-semibold text-slate-600">
                +{noteGroups.length - 2}
              </span>
            )}
          </div>
        )}
      </div>
    </motion.article>
  );
}
