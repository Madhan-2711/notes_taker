"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { auth, hasValidConfig } from "../lib/firebaseConfig";
import { getOrCreateUserProfile } from "../lib/services/social/usersService";

const INACTIVITY_TIMEOUT = 24 * 60 * 60 * 1000;

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(hasValidConfig);

  useEffect(() => {
    if (!hasValidConfig) return;
    return onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      if (currentUser) {
        void getOrCreateUserProfile(currentUser).catch((error) => {
          console.error("Profile migration failed:", error);
        });
      }
    });
  }, []);

  useEffect(() => {
    if (!user || !hasValidConfig) return;

    let timeoutId: ReturnType<typeof setTimeout>;
    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => void firebaseSignOut(auth), INACTIVITY_TIMEOUT);
    };
    const events = ["mousemove", "keydown", "scroll", "click"] as const;

    resetTimer();
    events.forEach((event) => window.addEventListener(event, resetTimer));
    return () => {
      clearTimeout(timeoutId);
      events.forEach((event) => window.removeEventListener(event, resetTimer));
    };
  }, [user]);

  const signOut = useCallback(async () => {
    if (hasValidConfig) await firebaseSignOut(auth);
  }, []);

  const value = useMemo(() => ({ user, loading, signOut }), [user, loading, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
