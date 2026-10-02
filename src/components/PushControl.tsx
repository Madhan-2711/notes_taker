"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { disablePush, enablePush, getPushStatus, type PushStatus } from "../lib/push";

const EXPLAIN: Record<PushStatus, string> = {
  unsupported: "This browser can't receive push notifications. On iPhone and iPad, add Notes Taker to your Home Screen first, then turn this on from the installed app.",
  unconfigured: "Push notifications aren't set up for this site yet. The site owner needs to add a web push key (see the README).",
  "no-worker": "Push notifications work in the installed app or the live site. Open Notes Taker from your home screen or the published site to turn them on.",
  denied: "Notifications are blocked for this site. Allow them in your browser's site settings, then come back here.",
  off: "Get reminders on this device even when Notes Taker is closed.",
  on: "This device gets reminders even when Notes Taker is closed. Private notes show as “A private note”, because their titles are encrypted.",
};

/** On/off switch for reminder push notifications on this device. */
export function PushControl({ userId }: { userId: string }) {
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void getPushStatus().then((value) => { if (active) setStatus(value); }).catch(() => { if (active) setStatus("unsupported"); });
    return () => { active = false; };
  }, []);

  const available = status === "off" || status === "on";
  const toggle = async () => {
    if (!available || busy) return;
    setBusy(true);
    setError("");
    try {
      setStatus(status === "on" ? await disablePush(userId) : await enablePush(userId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Couldn't change notifications. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p id="push-label" className="text-sm font-semibold text-slate-900">Push notifications on this device</p>
          <p id="push-help" className="mt-0.5 max-w-prose text-sm text-slate-600">{status ? EXPLAIN[status] : "Checking this browser…"}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={status === "on"}
          aria-labelledby="push-label"
          aria-describedby="push-help"
          disabled={!available || busy}
          onClick={() => void toggle()}
          className="-my-1.5 flex h-11 w-16 shrink-0 items-center justify-center rounded-full disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? (
            <Loader2 size={18} className="animate-spin text-slate-600" aria-hidden="true" />
          ) : (
            <span className={`flex h-8 w-14 items-center rounded-full border-2 border-slate-900 transition-colors ${status === "on" ? "bg-primary-strong" : "bg-slate-200"}`} aria-hidden="true">
              <span className={`inline-block h-6 w-6 rounded-full border-2 border-slate-900 bg-white transition-transform ${status === "on" ? "translate-x-6" : "translate-x-0.5"}`} />
            </span>
          )}
        </button>
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}
