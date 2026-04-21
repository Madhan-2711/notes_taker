import { useEffect, useState } from "react";
import { onAuthStateChanged, User, signOut as firebaseSignOut } from "firebase/auth";
import { auth, hasValidConfig } from "../lib/firebaseConfig";

const INACTIVITY_TIMEOUT = 15 * 60 * 1000; // 15 minutes

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!hasValidConfig) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Secure Lock: Auto logout after 15 minutes of inactivity
  useEffect(() => {
    if (!user || !hasValidConfig) return;

    let timeoutId: NodeJS.Timeout;

    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        firebaseSignOut(auth).then(() => {
          console.log("Logged out due to inactivity");
        });
      }, INACTIVITY_TIMEOUT);
    };

    // Listen to user activities to reset the timer
    const events = ["mousemove", "keydown", "scroll", "click"];
    
    resetTimer(); // initialize

    events.forEach((event) => {
      window.addEventListener(event, resetTimer);
    });

    return () => {
      clearTimeout(timeoutId);
      events.forEach((event) => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [user]);

  const signOut = () => {
    if (!hasValidConfig) return Promise.resolve();
    return firebaseSignOut(auth);
  };

  return { user, loading, signOut };
}
