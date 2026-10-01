"use client";

import { useRef } from "react";
import { type NoteMode } from "../lib/validations";
import { NOTE_MODES, noteModeInfo } from "../lib/noteModes";

interface NoteModePickerProps {
  value: NoteMode;
  onChange: (mode: NoteMode) => void;
  disabled?: boolean;
  /** Show the selected type's one-line description under the switch. */
  showDescription?: boolean;
  label?: string;
}

/** Compact segmented switch for the note type, shared by quick capture and the Write page. */
export function NoteModePicker({ value, onChange, disabled = false, showDescription = true, label = "Note type" }: NoteModePickerProps) {
  const groupRef = useRef<HTMLDivElement>(null);

  // Arrow keys move between options, as in a native radio group.
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    const index = NOTE_MODES.findIndex((mode) => mode.value === value);
    const step = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
    const next = NOTE_MODES[(index + step + NOTE_MODES.length) % NOTE_MODES.length];
    onChange(next.value);
    window.requestAnimationFrame(() => groupRef.current?.querySelector<HTMLElement>(`[data-mode="${next.value}"]`)?.focus());
  };

  return (
    <div>
      <div
        ref={groupRef}
        role="radiogroup"
        aria-label={label}
        aria-disabled={disabled || undefined}
        onKeyDown={onKeyDown}
        className={`inline-grid w-full grid-cols-3 gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1 sm:w-auto ${disabled ? "pointer-events-none opacity-60" : ""}`}
      >
        {NOTE_MODES.map((mode) => {
          const selected = value === mode.value;
          const Icon = mode.icon;
          return (
            <button
              key={mode.value}
              type="button"
              role="radio"
              data-mode={mode.value}
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              disabled={disabled}
              onClick={() => onChange(mode.value)}
              className={`flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-colors sm:px-4 ${
                selected ? `bg-white shadow-sm ring-1 ring-slate-300 ${mode.selectedText}` : "text-slate-700 hover:bg-white/60 hover:text-slate-900"
              }`}
            >
              <Icon size={15} aria-hidden="true" />
              {mode.label}
            </button>
          );
        })}
      </div>
      {showDescription && <p className="mt-2 text-xs text-slate-600">{noteModeInfo(value).description}</p>}
    </div>
  );
}
