"use client";

import { useState } from "react";
import { AtSign, Loader2 } from "lucide-react";
import { claimUsername } from "../lib/services/social/usersService";
import { normalizeUsername, usernameProblem } from "../lib/usernames";

export function UsernameForm({ userId, initial = "", submitLabel = "Save", onSaved, autoFocus = false }: {
  userId: string;
  initial?: string;
  submitLabel?: string;
  onSaved?: (username: string) => void;
  autoFocus?: boolean;
}) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const inputId = `username-${userId}`;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const problem = usernameProblem(value);
    if (problem) { setError(problem); return; }
    setBusy(true);
    setError("");
    try {
      onSaved?.(await claimUsername(userId, value));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save your username.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <label htmlFor={inputId} className="mb-1 block text-sm font-semibold text-slate-700">Username</label>
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <AtSign size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden />
          <input id={inputId} value={value} onChange={(event) => setValue(normalizeUsername(event.target.value))} maxLength={20}
            autoComplete="off" autoCapitalize="none" spellCheck={false} autoFocus={autoFocus} aria-describedby={`${inputId}-hint`}
            className="h-12 w-full rounded-xl border border-slate-300 pl-9 pr-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200" />
        </div>
        <button type="submit" disabled={busy || !value}
          className="inline-flex min-h-12 shrink-0 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/85 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600">
          {busy && <Loader2 size={15} className="animate-spin" />} {submitLabel}
        </button>
      </div>
      <p id={`${inputId}-hint`} className="mt-1.5 text-xs text-slate-500">3–20 letters, numbers or underscores. Friends can find you with it.</p>
      {error && <p role="alert" className="mt-1.5 text-sm text-red-700">{error}</p>}
    </form>
  );
}
