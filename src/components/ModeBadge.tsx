"use client";

import { Lock, Unlock, Users } from "lucide-react";
import { type NoteMode } from "../lib/validations";

interface ModeBadgeProps {
  mode: NoteMode;
  /** Show only the icon without text. Default: false */
  compact?: boolean;
}

const BADGE_CONFIG: Record<NoteMode, {
  label: string;
  icon: typeof Lock;
  bgColor: string;
  textColor: string;
  borderColor: string;
}> = {
  normal: {
    label: "Normal",
    icon: Unlock,
    bgColor: "transparent",
    textColor: "#64748b",
    borderColor: "#cbd5e1",
  },
  secure: {
    label: "Encrypted",
    icon: Lock,
    bgColor: "#6366f110",
    textColor: "#6366f1",
    borderColor: "#6366f140",
  },
  collab: {
    label: "Collab",
    icon: Users,
    bgColor: "#10b98110",
    textColor: "#10b981",
    borderColor: "#10b98140",
  },
};

export function ModeBadge({ mode, compact = false }: ModeBadgeProps) {
  // Don't render a badge for normal notes to keep existing UI clean
  const effectiveMode = mode || "normal";
  if (effectiveMode === "normal") return null;

  const config = BADGE_CONFIG[effectiveMode];
  const Icon = config.icon;

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border shrink-0"
      style={{
        backgroundColor: config.bgColor,
        color: config.textColor,
        borderColor: config.borderColor,
      }}
    >
      <Icon size={10} />
      {!compact && config.label}
    </span>
  );
}
