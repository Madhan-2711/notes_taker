"use client";

import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { KeyRound, Loader2 } from "lucide-react";
import { auth, hasValidConfig } from "../lib/firebaseConfig";

// Firebase password accounts are keyed by email, so a bare username maps onto
// this domain. Create the account in the Firebase console as <username>@notestaker.local.
export const USERNAME_DOMAIN = "notestaker.local";

export function usernameToEmail(username: string): string {
  const value = username.trim().toLowerCase();
  return value.includes("@") ? value : `${value}@${USERNAME_DOMAIN}`;
}

function friendlyError(code: string | undefined): string {
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
    case "auth/invalid-email":
      return "Wrong username or password.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a few minutes and try again.";
    case "auth/operation-not-allowed":
      return "Username sign-in isn't enabled for this app yet.";
    case "auth/network-request-failed":
      return "No connection. Check your internet and try again.";
    default:
      return "Could not sign in. Please try again.";
  }
}

/** Password sign-in for accounts created by hand in the Firebase console; there is no sign-up. */
export function UsernameSignIn({ onSignedIn }: { onSignedIn: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!hasValidConfig || busy) return;
    setBusy(true);
    setError("");
    try {
      await signInWithEmailAndPassword(auth, usernameToEmail(username), password);
      onSignedIn();
    } catch (caught) {
      setError(friendlyError((caught as { code?: string }).code));
      setPassword("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} aria-labelledby="username-signin-title" className="w-full max-w-sm rounded-card border-2 border-slate-900 bg-white p-6 shadow-xl">
      <h1 id="username-signin-title" className="mb-5 flex items-center gap-2 text-lg font-bold"><KeyRound size={18} /> Sign in with username</h1>
      <label htmlFor="signin-username" className="mb-1 block text-sm font-semibold text-slate-700">Username</label>
      <input id="signin-username" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" autoCapitalize="none" spellCheck={false} required autoFocus
        className="mb-4 h-12 w-full rounded-xl border border-slate-300 px-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200" />
      <label htmlFor="signin-password" className="mb-1 block text-sm font-semibold text-slate-700">Password</label>
      <input id="signin-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" required
        className="h-12 w-full rounded-xl border border-slate-300 px-3 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200" />
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
      <button type="submit" disabled={busy || !username.trim() || !password}
        className="btn-primary mt-5 w-full">
        {busy && <Loader2 size={16} className="animate-spin" />} Sign in
      </button>
    </form>
  );
}
