"use client";

import { useEffect, useState } from "react";
import { TRASH_RETENTION_DAYS, autoEmptyTrashEnabled, setAutoEmptyTrash } from "../lib/trash";

/** On/off switch for removing notes that have been in trash longer than the retention period. */
export function AutoEmptyTrashControl() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setEnabled(autoEmptyTrashEnabled()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const toggle = () => {
    setAutoEmptyTrash(!enabled);
    setEnabled(!enabled);
  };

  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p id="auto-empty-label" className="text-sm font-semibold text-slate-900">Empty trash automatically</p>
        <p id="auto-empty-help" className="mt-0.5 max-w-prose text-sm text-slate-600">
          Notes that have been in trash for {TRASH_RETENTION_DAYS} days are deleted forever the next time you open Notes on this device.
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-labelledby="auto-empty-label"
        aria-describedby="auto-empty-help"
        onClick={toggle}
        className="-my-1.5 flex h-11 w-16 shrink-0 items-center justify-center rounded-full"
      >
        {/* The 44px button is the hit area; the visible track sits inside it. */}
        <span className={`flex h-8 w-14 items-center rounded-full border-2 border-slate-900 transition-colors ${enabled ? "bg-primary-strong" : "bg-slate-200"}`} aria-hidden="true">
          <span className={`inline-block h-6 w-6 rounded-full border-2 border-slate-900 bg-white transition-transform ${enabled ? "translate-x-6" : "translate-x-0.5"}`} />
        </span>
      </button>
    </div>
  );
}
