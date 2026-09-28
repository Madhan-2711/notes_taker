"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  type Note,
  type Group,
  isSecureNote,
  isCollabNote,
  getNoteTitle,
  getNoteContent,
} from "../lib/validations";
import { ModeBadge } from "./ModeBadge";
import { Trash2, Pencil, Eye, Users, Pin } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "../hooks/useAuth";
import { useUserKeysContext } from "../contexts/UserKeysContext";
import { decryptNoteTitle } from "../lib/services/notes/noteTitles";

interface NoteCardProps {
  note: Note;
  groups?: Group[];
  onDelete: (id: string) => void;
  onEdit?: (note: Note) => void;
  onView?: (note: Note) => void;
  pinned?: boolean;
  onTogglePin?: (id: string) => void;
  canDelete?: boolean;
}

export function NoteCard({ note, groups = [], onDelete, onEdit, onView, pinned = false, onTogglePin, canDelete = true }: NoteCardProps) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { user } = useAuth();
  const { privateKey } = useUserKeysContext();
  const [decrypted, setDecrypted] = useState<{ id: string; title: string } | null>(null);

  useEffect(() => {
    if (!user || !privateKey || (!isSecureNote(note) && !isCollabNote(note))) return;
    let cancelled = false;
    void decryptNoteTitle(note, user.uid, privateKey).then((title) => {
      if (!cancelled && title) setDecrypted({ id: note.id, title });
    });
    return () => { cancelled = true; };
  }, [note, user, privateKey]);

  // Derive groups this note belongs to
  const noteGroups = groups.filter((g) => note.groupIds?.includes(g.id));

  const handleDelete = () => {
    if (confirmDelete) {
      onDelete(note.id);
      setConfirmDelete(false);
    } else {
      setConfirmDelete(true);
      setTimeout(() => setConfirmDelete(false), 3000);
    }
  };

  const displayTitle = (decrypted?.id === note.id && decrypted.title.trim()) || getNoteTitle(note);

  // Display content — encrypted notes show a placeholder, collab notes show collaborator info
  const displayContent = isSecureNote(note)
    ? "This note is end-to-end encrypted. Open to decrypt and view."
    : isCollabNote(note)
    ? getNoteContent(note)
    : getNoteContent(note);

  // Disable edit for collab notes (those use the Yjs editor)
  const canEdit = !isCollabNote(note);

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -5 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className="glass neubrutal rounded-[var(--radius-xl)] p-6 relative group flex flex-col gap-3 min-h-[160px]"
    >
      <button
        type="button"
        className="absolute inset-0 z-10 rounded-[var(--radius-xl)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-indigo-600"
        aria-label={`Open ${displayTitle}`}
        onClick={() => isCollabNote(note) ? router.push(`/collab/${note.id}`) : onView?.(note)}
      />
      <div className="flex items-center justify-between gap-2 min-h-11">
        <ModeBadge mode={note.mode || "normal"} compact />
        {/* Always visible on mobile, hover-reveal on desktop */}
        <div className="relative z-20 ml-auto flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 transition-opacity">
          {onTogglePin && <button type="button" onClick={() => onTogglePin(note.id)} aria-label={pinned ? `Unpin ${displayTitle}` : `Pin ${displayTitle}`} aria-pressed={pinned}
            className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-indigo-600 ${pinned ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-indigo-50 hover:text-indigo-700"}`}><Pin size={16} fill={pinned ? "currentColor" : "none"} /></button>}
          {onView && !isCollabNote(note) && (
            <button
              onClick={(e) => { e.stopPropagation(); onView(note); }}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-emerald-50 hover:text-emerald-700 focus-visible:outline-2 focus-visible:outline-indigo-600"
              aria-label={`View ${displayTitle}`}
            >
              <Eye size={16} />
            </button>
          )}
          {onEdit && canEdit && (
            <button
              onClick={(e) => { e.stopPropagation(); onEdit(note); }}
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-indigo-50 hover:text-primary focus-visible:outline-2 focus-visible:outline-indigo-600"
              aria-label={`Edit ${displayTitle}`}
            >
              <Pencil size={16} />
            </button>
          )}
          {canDelete && <button
            onClick={(e) => { e.stopPropagation(); handleDelete(); }}
            className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg transition-colors focus-visible:outline-2 focus-visible:outline-indigo-600 ${
              confirmDelete
                ? "text-white bg-red-500 hover:bg-red-600"
                : "text-foreground/50 hover:text-red-500 hover:bg-red-50"
            }`}
            aria-label={confirmDelete ? `Confirm moving ${displayTitle} to trash` : `Move ${displayTitle} to trash`}
          >
            <Trash2 size={16} />
          </button>}
        </div>
      </div>

      <h3 className="font-bold text-lg leading-snug font-sans break-words line-clamp-2" title={displayTitle}>
        {displayTitle}
      </h3>

      {confirmDelete && (
        <div className="text-xs text-red-500 font-medium animate-pulse">
          Tap again to move to trash
        </div>
      )}

      <p className="text-foreground/70 text-sm flex-1 whitespace-pre-wrap break-words line-clamp-6">
        {displayContent}
      </p>

      {/* Collab collaborator count */}
      {isCollabNote(note) && note.collaboratorIds?.length > 0 && (
        <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-semibold">
          <Users size={12} />
          {note.collaboratorIds.length} collaborator{note.collaboratorIds.length !== 1 ? "s" : ""}
        </div>
      )}

      {/* Footer: date + group badges */}
      <div className="flex items-center justify-between gap-2 mt-2 flex-wrap">
        <div className="text-xs text-foreground/40 font-mono shrink-0">
          {new Date(note.createdAt).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
        {noteGroups.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {noteGroups.slice(0, 2).map((g) => (
              <span
                key={g.id}
                className="text-xs font-semibold px-2 py-0.5 rounded-full border"
                style={{
                  backgroundColor: g.color + "18",
                  borderColor: g.color + "40",
                  color: g.color,
                }}
              >
                {g.title}
              </span>
            ))}
            {noteGroups.length > 2 && (
              <span className="text-xs font-semibold text-foreground/40">
                +{noteGroups.length - 2}
              </span>
            )}
          </div>
        )}
      </div>
    </motion.article>
  );
}
