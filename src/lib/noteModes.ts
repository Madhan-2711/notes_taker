import { Lock, PenLine, Users, type LucideIcon } from "lucide-react";
import type { NoteMode } from "./validations";

export interface NoteModeInfo {
  value: NoteMode;
  label: string;
  description: string;
  icon: LucideIcon;
  /** Tailwind classes for the small badge; text shades are chosen to pass WCAG AA on their tint. */
  badge: string;
  /** Text colour for the selected state of the mode switch. */
  selectedText: string;
}

/** The one source of names, icons and colours for note types, used by every screen. */
export const NOTE_MODES: NoteModeInfo[] = [
  {
    value: "normal",
    label: "Note",
    description: "Quick and searchable, not encrypted",
    icon: PenLine,
    badge: "border-slate-300 bg-slate-100 text-slate-700",
    selectedText: "text-slate-900",
  },
  {
    value: "secure",
    label: "Private",
    description: "End-to-end encrypted, only you can read it",
    icon: Lock,
    badge: "border-indigo-200 bg-indigo-50 text-indigo-800",
    selectedText: "text-indigo-800",
  },
  {
    value: "collab",
    label: "Shared",
    description: "Encrypted and edited live with friends",
    icon: Users,
    badge: "border-emerald-200 bg-emerald-50 text-emerald-800",
    selectedText: "text-emerald-800",
  },
];

export function noteModeInfo(mode: NoteMode | undefined): NoteModeInfo {
  return NOTE_MODES.find((entry) => entry.value === (mode || "normal")) ?? NOTE_MODES[0];
}
