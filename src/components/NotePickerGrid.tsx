"use client";

import { useState, useMemo } from "react";
import { type Note } from "../lib/validations";
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
    return notes.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q)
    );
  }, [notes, search]);

  return (
    <div className="flex flex-col gap-3">
      {/* Search bar */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" />
        <input
          type="text"
          placeholder="Search notes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-sm bg-border/20 border border-border/60 rounded-xl focus:outline-none focus:border-primary transition-colors placeholder:text-foreground/30"
        />
      </div>

      {/* Selection count */}
      {selectedIds.length > 0 && (
        <p className="text-xs font-semibold text-primary">
          {selectedIds.length} note{selectedIds.length !== 1 ? "s" : ""} selected
        </p>
      )}

      {/* Note grid */}
      <div className="max-h-64 overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <p className="text-sm text-foreground/40 text-center py-8">No notes found.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {filtered.map((note) => {
              const isSelected = selectedIds.includes(note.id);
              return (
                <button
                  key={note.id}
                  type="button"
                  onClick={() => onToggle(note.id)}
                  className={`relative text-left p-3 rounded-xl border-2 transition-all duration-150 ${
                    isSelected
                      ? "border-primary bg-primary/8 shadow-[2px_2px_0px_0px_rgba(99,102,241,0.3)]"
                      : "border-border/60 bg-white hover:border-primary/40 hover:bg-primary/4"
                  }`}
                >
                  {/* Checkbox indicator */}
                  <div
                    className={`absolute top-2.5 right-2.5 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                      isSelected
                        ? "bg-primary border-primary"
                        : "border-border bg-white"
                    }`}
                  >
                    {isSelected && <Check size={11} className="text-white" strokeWidth={3} />}
                  </div>

                  <p className="font-semibold text-sm truncate pr-7 text-foreground">
                    {note.title}
                  </p>
                  <p className="text-xs text-foreground/50 mt-0.5 line-clamp-2 leading-relaxed">
                    {note.content}
                  </p>
                  <p className="text-xs text-foreground/30 mt-1.5 font-mono">
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
