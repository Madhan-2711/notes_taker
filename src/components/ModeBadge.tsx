"use client";

import { type NoteMode } from "../lib/validations";
import { noteModeInfo } from "../lib/noteModes";

interface ModeBadgeProps {
  mode: NoteMode;
  /** Hide the plain "Note" badge, which adds nothing next to private and shared notes. Default: false */
  hideNormal?: boolean;
}

export function ModeBadge({ mode, hideNormal = false }: ModeBadgeProps) {
  const info = noteModeInfo(mode);
  if (hideNormal && info.value === "normal") return null;
  const Icon = info.icon;

  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${info.badge}`}>
      <Icon size={12} aria-hidden="true" />
      {info.label}
    </span>
  );
}
