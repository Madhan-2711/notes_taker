"use client";

import { signInWithPopup } from "firebase/auth";
import { auth, googleProvider, hasValidConfig } from "../lib/firebaseConfig";
import { useAuth } from "../hooks/useAuth";
import { LogOut, LogIn } from "lucide-react";

export function AuthButton() {
  const { user, loading, signOut } = useAuth();

  const handleSignIn = async () => {
    if (!hasValidConfig) {
      console.warn("Firebase is not configured. Please add your credentials to .env.local");
      return;
    }
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Sign in failed", error);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse h-10 w-24 bg-border rounded-[var(--radius-xl)]" />
    );
  }

  return user ? (
    <div className="flex items-center gap-4">
      <span className="text-sm font-medium text-foreground/80 hidden sm:block">
        {user.displayName || user.email}
      </span>
      <button
        onClick={signOut}
        className="glass neubrutal px-4 py-2 rounded-[var(--radius-xl)] flex items-center gap-2 font-medium text-sm hover:text-accent transition-colors"
      >
        <LogOut size={16} />
        Sign Out
      </button>
    </div>
  ) : (
    <button
      onClick={handleSignIn}
      className="bg-primary text-primary-foreground neubrutal px-6 py-2 rounded-[var(--radius-xl)] flex items-center gap-2 font-medium text-sm"
    >
      <LogIn size={16} />
      Sign In
    </button>
  );
}
