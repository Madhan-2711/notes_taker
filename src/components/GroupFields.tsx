"use client";

import { Check } from "lucide-react";
import { type Note, GROUP_COLORS } from "../lib/validations";
import { NotePickerGrid } from "./NotePickerGrid";

interface GroupFieldsProps {
  idPrefix: string;
  title: string;
  onTitleChange: (value: string) => void;
  color: string;
  onColorChange: (value: string) => void;
  notes: Note[];
  selectedNoteIds: string[];
  onToggleNote: (id: string) => void;
  notesLabel: string;
}

/** Name, colour and notes fields shared by the create and manage group dialogs. */
export function GroupFields({ idPrefix, title, onTitleChange, color, onColorChange, notes, selectedNoteIds, onToggleNote, notesLabel }: GroupFieldsProps) {
  return (
    <>
      <div>
        <label htmlFor={`${idPrefix}-name`} className="label">Name</label>
        <input
          id={`${idPrefix}-name`}
          type="text"
          placeholder="Work, personal, research…"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          maxLength={50}
          autoComplete="off"
          data-autofocus
          className="field text-base font-semibold"
        />
      </div>

      <fieldset>
        <legend className="label">Colour</legend>
        <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Group colour">
          {GROUP_COLORS.map(({ value, label }) => {
            const selected = color === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={selected}
                aria-label={label}
                title={label}
                onClick={() => onColorChange(value)}
                className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-transform ${selected ? "border-slate-900" : "border-transparent hover:scale-110"}`}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full text-white" style={{ backgroundColor: value }}>
                  {selected && <Check size={15} strokeWidth={3} aria-hidden="true" />}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div>
        <p className="label">{notesLabel}</p>
        <NotePickerGrid notes={notes} selectedIds={selectedNoteIds} onToggle={onToggleNote} />
      </div>
    </>
  );
}
