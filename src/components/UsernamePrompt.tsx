"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "../hooks/useAuth";
import { useMyUsername } from "../hooks/useMyUsername";
import { useUserKeysContext } from "../contexts/UserKeysContext";
import { suggestUsername } from "../lib/usernames";
import { UsernameForm } from "./UsernameForm";

const DISMISS_KEY = "username-prompt-dismissed";

function wasDismissed(): boolean {
  try { return sessionStorage.getItem(DISMISS_KEY) === "1"; } catch { return false; }
}

/** Asks accounts without a username to pick one; "Later" hides it for this browser session. */
export function UsernamePrompt() {
  const { user } = useAuth();
  const pathname = usePathname();
  const username = useMyUsername(user?.uid);
  const { vaultDialogOpen } = useUserKeysContext();
  const [dismissed, setDismissed] = useState(wasDismissed);
  const [savedFor, setSavedFor] = useState<string | null>(null);

  // Waits for any vault prompt first so new users never see two dialogs at once.
  if (!user || username !== null || dismissed || savedFor === user.uid || vaultDialogOpen || pathname === "/access") return null;

  const later = () => {
    try { sessionStorage.setItem(DISMISS_KEY, "1"); } catch { /* still hidden for now */ }
    setDismissed(true);
  };

  return (
    <div className="fixed inset-0 z-[75] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="username-prompt-title">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div className="relative w-full max-w-md rounded-[var(--radius-xl)] border-2 border-slate-900 bg-white p-6 shadow-2xl">
        <h2 id="username-prompt-title" className="text-lg font-bold">Choose your username</h2>
        <p className="mb-5 mt-1 text-sm text-slate-600">Friends can send you requests with your username instead of your email.</p>
        <UsernameForm userId={user.uid} initial={suggestUsername(user.displayName, user.email)} submitLabel="Save" autoFocus onSaved={() => setSavedFor(user.uid)} />
        <button type="button" onClick={later} className="mt-4 min-h-11 w-full rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-indigo-600">
          Later
        </button>
      </div>
    </div>
  );
}
