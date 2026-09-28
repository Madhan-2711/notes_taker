"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { MotionConfig } from "framer-motion";
import type { NoteMode } from "../lib/validations";

export interface NoteDraft {
  ownerId: string;
  mode: NoteMode;
  title: string;
  content: string;
}

const emptyDraft = (ownerId: string): NoteDraft => ({ ownerId, mode: "normal", title: "", content: "" });

const NoteDraftContext = createContext<{
  draft: NoteDraft | null;
  update: (ownerId: string, changes: Partial<Omit<NoteDraft, "ownerId">>) => void;
  clear: () => void;
} | null>(null);

/** Keeps unfinished writing in memory across client-side navigation, never in browser storage. */
export function NoteDraftProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<NoteDraft | null>(null);
  const update = (ownerId: string, changes: Partial<Omit<NoteDraft, "ownerId">>) => {
    setDraft((previous) => ({ ...(previous?.ownerId === ownerId ? previous : emptyDraft(ownerId)), ...changes }));
  };
  return <NoteDraftContext.Provider value={{ draft, update, clear: () => setDraft(null) }}><MotionConfig reducedMotion="user">{children}</MotionConfig></NoteDraftContext.Provider>;
}

export function useNoteDraft(ownerId: string | undefined) {
  const context = useContext(NoteDraftContext);
  if (!context) throw new Error("Note drafts need NoteDraftProvider.");
  return {
    draft: ownerId && context.draft?.ownerId === ownerId ? context.draft : emptyDraft(ownerId ?? ""),
    update: (changes: Partial<Omit<NoteDraft, "ownerId">>) => { if (ownerId) context.update(ownerId, changes); },
    clear: context.clear,
  };
}
