"use client";

import { useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, useDialogTitleId } from "./Dialog";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  /** Destructive actions get the red button. */
  destructive?: boolean;
  onConfirm: () => Promise<void> | void;
  onCancel: () => void;
}

/** In-app replacement for window.confirm, with a busy state and inline error. */
export function ConfirmDialog({ open, title, description, confirmLabel, destructive = false, onConfirm, onCancel }: ConfirmDialogProps) {
  const titleId = useDialogTitleId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const close = () => {
    if (busy) return;
    setError("");
    onCancel();
  };

  const confirm = async () => {
    setBusy(true);
    setError("");
    try {
      await onConfirm();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={close} labelledBy={titleId} size="sm">
      <div className="p-6">
        <h2 id={titleId} className="text-lg font-bold tracking-tight">{title}</h2>
        {description && <div className="mt-2 text-sm leading-6 text-slate-700">{description}</div>}
        {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-medium text-red-800">{error}</p>}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={close} disabled={busy} className="btn-quiet" data-autofocus>Cancel</button>
          <button
            type="button"
            onClick={() => void confirm()}
            disabled={busy}
            className={destructive ? "btn border-2 border-red-700 bg-red-600 font-bold text-white hover:bg-red-700" : "btn-primary"}
          >
            {busy && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
