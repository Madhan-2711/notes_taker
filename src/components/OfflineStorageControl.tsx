"use client";

import { useEffect, useState } from "react";
import { clearIndexedDbPersistence, terminate, waitForPendingWrites } from "firebase/firestore";
import { db } from "../lib/firebaseConfig";
import { OFFLINE_STORAGE_KEY, offlineStorageEnabled } from "../lib/offlinePreference";

export function OfflineStorageControl() {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setEnabled(offlineStorageEnabled());
      const warning = window.sessionStorage.getItem("notes_taker_cache_warning");
      if (warning) { setError(warning); window.sessionStorage.removeItem("notes_taker_cache_warning"); }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function changePreference() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (!enabled) {
        window.localStorage.setItem(OFFLINE_STORAGE_KEY, "yes");
        window.location.reload();
        return;
      }
      await clearStoredCopies();
    } catch (caught) {
      setBusy(false);
      setError(caught instanceof Error ? caught.message : "Could not change offline storage.");
    }
  }

  async function clearStoredCopies() {
    setBusy(true);
    setError("");
    let terminated = false;
    try {
      // Do not discard an edit still waiting to reach Firestore.
      await Promise.race([
        waitForPendingWrites(db),
        new Promise<never>((_, reject) => window.setTimeout(() => reject(new Error("Wait for your notes to finish syncing before clearing offline copies.")), 10000)),
      ]);
      window.localStorage.removeItem(OFFLINE_STORAGE_KEY);
      await terminate(db);
      terminated = true;
      await clearIndexedDbPersistence(db);
      window.location.reload();
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Could not clear offline copies. Close other tabs and try again.";
      if (terminated) {
        window.sessionStorage.setItem("notes_taker_cache_warning", `${message} Close other tabs or clear this site's data in your browser.`);
        window.location.reload();
        return;
      }
      setError(message);
      setBusy(false);
    }
  }

  return <div>
    <p className="max-w-prose text-sm leading-6 text-slate-700">{enabled ? "This browser keeps notes on this device for offline use. Use this only on a trusted device." : "Notes are kept in memory while this tab is open. Older offline copies may still remain from previous versions."}</p>
    <div className="mt-4 flex flex-wrap gap-2">
      <button type="button" disabled={busy} onClick={() => void changePreference()} className="btn-secondary">
        {busy ? "Updating…" : enabled ? "Turn off offline storage" : "Enable on this trusted device"}
      </button>
      {!enabled && <button type="button" disabled={busy} onClick={() => void clearStoredCopies()} className="btn-quiet">Clear older copies</button>}
    </div>
    {error && <p role="alert" className="mt-3 text-sm font-medium text-red-700">{error}</p>}
  </div>;
}
