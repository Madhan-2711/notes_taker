"use client";

import { useState, useMemo } from "react";
import { type Note, getNoteTitle, getNoteContent } from "../lib/validations";
import { Search, Check } from "lucide-react";

interface NotePickerGridProps {
  notes: Note[];
  selectedIds: string[];
  onToggle: (id: string) => void;
}

export function NotePickerGrid({ notes, selectedIds, onToggle }: NotePickerGridProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search.trim()) return notes;
    const q = search.toLowerCase();
    return notes.filter((n) => {
      const title = getNoteTitle(n);
      const content = getNoteContent(n);
      return title.toLowerCase().includes(q) || content.toLowerCase().includes(q);
    });
  }, [notes, search]);

  return (
    <div className="flex flex-col gap-3">
      {/* Search bar */}
      <div className="relative">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" aria-hidden="true" />
        <input
          type="text"
          placeholder="Search notes…"
          aria-label="Search notes to add"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="field pl-9"
        />
      </div>

      {/* Selection count */}
      {selectedIds.length > 0 && (
        <p className="text-xs font-semibold text-indigo-800" aria-live="polite">
          {selectedIds.length} note{selectedIds.length !== 1 ? "s" : ""} selected
        </p>
      )}

      {/* Note grid */}
      <div className="max-h-64 overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-600">No notes found.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {filtered.map((note) => {
              const isSelected = selectedIds.includes(note.id);
              return (
                <button
                  key={note.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => onToggle(note.id)}
                  className={`relative text-left p-3 rounded-xl border-2 transition-all duration-150 ${
                    isSelected
                      ? "border-indigo-700 bg-indigo-50"
                      : "border-slate-200 bg-white hover:border-indigo-400"
                  }`}
                >
                  {/* Checkbox indicator */}
                  <div
                    aria-hidden="true"
                    className={`absolute top-2.5 right-2.5 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                      isSelected
                        ? "border-indigo-700 bg-indigo-700"
                        : "border-slate-300 bg-white"
                    }`}
                  >
                    {isSelected && <Check size={11} className="text-white" strokeWidth={3} />}
                  </div>

                  <p className="font-semibold text-sm truncate pr-7 text-foreground">
                    {getNoteTitle(note)}
                  </p>
                  <p className="text-xs text-foreground/50 mt-0.5 line-clamp-2 leading-relaxed">
                    {getNoteContent(note)}
                  </p>
                  <p className="mt-1.5 text-xs tabular-nums text-slate-600">
                    {new Date(note.createdAt).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
