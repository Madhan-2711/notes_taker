"use client";

import { motion, useReducedMotion } from "framer-motion";
import { type Group, type Note } from "../lib/validations";
import { useNoteTitle } from "../hooks/useNoteTitle";
import { ArrowRight, Settings } from "lucide-react";
import Link from "next/link";

interface GroupCardProps {
  group: Group;
  notes: Note[];
  onManage: () => void;
}

function NoteTitleChip({ note }: { note: Note }) {
  const title = useNoteTitle(note);
  return <li className="max-w-[160px] truncate rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">{title}</li>;
}

/** A group row: the card opens the group, Manage sits beside it (delete lives inside Manage). */
export function GroupCard({ group, notes, onManage }: GroupCardProps) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      layout={!reduceMotion}
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="card group relative overflow-hidden transition-[box-shadow,transform] duration-200 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[var(--neubrutalism-shadow-hover)]"
    >
      <span className="absolute inset-y-0 left-0 w-1.5" style={{ backgroundColor: group.color }} aria-hidden="true" />
      <div className="flex items-center gap-3 py-4 pl-6 pr-3 sm:pl-7">
        <Link href={`/groups/${group.id}`} className="flex min-w-0 flex-1 items-center gap-4 rounded-xl after:absolute after:inset-0 after:content-['']">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-lg font-bold">{group.title}</h3>
            <p className="mt-0.5 text-sm text-slate-600">
              {notes.length} {notes.length === 1 ? "note" : "notes"}
            </p>
          </div>
          <ArrowRight size={18} className="shrink-0 text-slate-500 transition-transform group-hover:translate-x-1 group-hover:text-indigo-700" aria-hidden="true" />
        </Link>
        <button
          type="button"
          onClick={onManage}
          className="btn-secondary relative z-10 min-h-10 shrink-0 px-3"
          aria-label={`Manage ${group.title}`}
        >
          <Settings size={16} aria-hidden="true" /> <span className="hidden sm:inline">Manage</span>
        </button>
      </div>

      {notes.length > 0 && (
        <ul className="flex flex-wrap items-center gap-2 border-t border-slate-200 py-3 pl-6 pr-4 sm:pl-7" aria-label={`Notes in ${group.title}`}>
          {notes.slice(0, 4).map((note) => <NoteTitleChip key={note.id} note={note} />)}
          {notes.length > 4 && (
            <li className="text-xs font-medium text-slate-600">+{notes.length - 4} more</li>
          )}
        </ul>
      )}
    </motion.div>
  );
}
