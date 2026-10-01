"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

interface InstallState {
  /** True when the browser offered an install prompt that has not been used yet. */
  canInstall: boolean;
  install: () => Promise<void>;
}

const InstallContext = createContext<InstallState>({ canInstall: false, install: async () => {} });

/** Registers the service worker and keeps the browser's install prompt for the Settings page. */
export function InstallProvider({ children }: { children: ReactNode }) {
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    // Skipped in development so cached bundles never hide code changes.
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch((error) => {
        console.error("Service worker registration failed:", error);
      });
    }
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallPromptEvent);
    };
    const onInstalled = () => setInstallEvent(null);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = useCallback(async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice.catch(() => undefined);
    setInstallEvent(null);
  }, [installEvent]);

  return <InstallContext.Provider value={{ canInstall: Boolean(installEvent), install }}>{children}</InstallContext.Provider>;
}

export function useInstallPrompt() {
  return useContext(InstallContext);
}
