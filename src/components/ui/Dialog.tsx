"use client";

import { useEffect, useId, useRef, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  /** Accessible name; rendered by the caller inside the panel with id={titleId}. */
  labelledBy?: string;
  label?: string;
  children: ReactNode;
  /** Tailwind max-width class for the panel on larger screens. */
  size?: "sm" | "md" | "lg" | "xl";
  /** Full-height sheet on phones instead of a centred card. */
  sheetOnMobile?: boolean;
  className?: string;
}

const SIZES = { sm: "sm:max-w-md", md: "sm:max-w-lg", lg: "sm:max-w-2xl", xl: "sm:max-w-3xl" };

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

/** Modal dialog: closes on Escape and backdrop click, keeps focus inside, and restores focus on close. */
export function Dialog({ open, onClose, labelledBy, label, children, size = "md", sheetOnMobile = false, className = "" }: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const reduceMotion = useReducedMotion();

  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    const focusTimer = window.setTimeout(() => {
      const panel = panelRef.current;
      if (!panel || panel.contains(document.activeElement)) return;
      const preferred = panel.querySelector<HTMLElement>("[data-autofocus]") ?? panel.querySelector<HTMLElement>(FOCUSABLE);
      (preferred ?? panel).focus();
    }, 30);

    const onKeyDown = (event: KeyboardEvent) => {
      const panel = panelRef.current;
      if (!panel) return;
      // Nested dialogs: only the top-most open dialog reacts.
      const dialogs = document.querySelectorAll("[data-dialog-panel]");
      if (dialogs[dialogs.length - 1] !== panel) return;
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const items = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((element) => element.offsetParent !== null);
      if (items.length === 0) { event.preventDefault(); return; }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
      previouslyFocused?.focus?.();
    };
  }, [open]);

  // Portalled to <body> so a transformed ancestor (animated cards) can't trap the fixed overlay.
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);

  const shape = sheetOnMobile
    ? "h-dvh max-h-dvh rounded-none sm:h-auto sm:max-h-[90dvh] sm:rounded-card"
    : "max-h-[90dvh] rounded-card";

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="dialog"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.15 }}
          className={`fixed inset-0 z-[var(--z-dialog)] flex items-center justify-center ${sheetOnMobile ? "p-0 sm:p-6" : "p-4 sm:p-6"}`}
        >
          <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
          <motion.div
            ref={panelRef}
            data-dialog-panel
            role="dialog"
            aria-modal="true"
            aria-labelledby={labelledBy}
            aria-label={labelledBy ? undefined : label}
            tabIndex={-1}
            initial={reduceMotion ? false : { opacity: 0, y: 24, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: 16, scale: 0.98, transition: { duration: 0.14, ease: "easeIn" } }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className={`relative flex w-full flex-col overflow-hidden overscroll-contain [&_.overflow-y-auto]:overscroll-contain border-2 border-slate-900 bg-white shadow-[var(--neubrutalism-shadow)] focus:outline-none ${shape} ${SIZES[size]} ${className}`}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

export function useDialogTitleId() {
  return useId();
}
