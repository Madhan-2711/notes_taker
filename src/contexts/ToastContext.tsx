"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";

interface ToastOptions {
  message: string;
  actionLabel?: string;
  onAction?: () => Promise<void> | void;
  tone?: "neutral" | "error";
}

interface Toast extends ToastOptions {
  id: number;
}

const ToastContext = createContext<(options: ToastOptions) => void>(() => {});

const VISIBLE_MS = 6000;

/** Short-lived status messages with an optional action such as Undo. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<Toast | null>(null);
  const timer = useRef<number | null>(null);
  const nextId = useRef(0);
  const reduceMotion = useReducedMotion();

  const dismiss = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    setToast(null);
  }, []);

  const show = useCallback((options: ToastOptions) => {
    if (timer.current) window.clearTimeout(timer.current);
    nextId.current += 1;
    setToast({ ...options, id: nextId.current });
    timer.current = window.setTimeout(() => setToast(null), VISIBLE_MS);
  }, []);

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  const runAction = async () => {
    const action = toast?.onAction;
    dismiss();
    if (!action) return;
    try { await action(); }
    catch (caught) { show({ message: caught instanceof Error ? caught.message : "That didn't work. Please try again.", tone: "error" }); }
  };

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-[var(--z-toast)] flex justify-center px-4 md:bottom-6" role="status" aria-live="polite">
        <AnimatePresence mode="wait">
          {toast && (
            <motion.div
              key={toast.id}
              initial={reduceMotion ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: reduceMotion ? 0 : 16 }}
              transition={{ duration: reduceMotion ? 0 : 0.18, ease: "easeOut" }}
              className={`pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-xl border-2 border-slate-900 py-2 pl-4 pr-2 text-sm font-medium shadow-[var(--neubrutalism-shadow)] ${toast.tone === "error" ? "bg-red-50 text-red-900" : "bg-slate-900 text-white"}`}
            >
              <span className="min-w-0 flex-1">{toast.message}</span>
              {toast.actionLabel && (
                <button type="button" onClick={() => void runAction()} className={`min-h-10 shrink-0 rounded-lg px-3 font-bold ${toast.tone === "error" ? "text-red-900 hover:bg-red-100" : "text-indigo-200 hover:bg-white/10"}`}>
                  {toast.actionLabel}
                </button>
              )}
              <button type="button" onClick={dismiss} aria-label="Dismiss message" className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${toast.tone === "error" ? "hover:bg-red-100" : "hover:bg-white/10"}`}>
                <X size={16} aria-hidden="true" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
