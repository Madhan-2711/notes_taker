"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** Registers the service worker and offers an Install button where the browser supports it. */
export function AppInstall() {
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

  if (!installEvent) return null;

  return (
    <button
      type="button"
      onClick={async () => {
        await installEvent.prompt();
        await installEvent.userChoice.catch(() => undefined);
        setInstallEvent(null);
      }}
      className="inline-flex min-h-11 items-center gap-2 rounded-xl border-2 border-indigo-200 bg-white px-3 text-sm font-bold text-indigo-700 hover:bg-indigo-50 focus-visible:outline-2 focus-visible:outline-indigo-600"
    >
      <Download size={16} /> <span className="hidden sm:inline">Install app</span><span className="sr-only sm:hidden">Install app</span>
    </button>
  );
}
