"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { Bell, X } from "lucide-react";
import { db } from "../lib/firebaseConfig";
import { useAuth } from "../hooks/useAuth";
import { useNoteMeta } from "../contexts/NoteMetaContext";
import { useUserKeysContext } from "../contexts/UserKeysContext";
import { decryptNoteTitle } from "../lib/services/notes/noteTitles";
import { getNoteTitle, isCollabNote, isNormalNote, type Note } from "../lib/validations";
import { nextOccurrence, type ReminderRepeat } from "../lib/noteMeta";

interface DueReminder { noteId: string; title: string; url: string }

const MAX_TIMEOUT = 2_147_483_647;

/** Claims a reminder so only one open tab announces it. */
function claim(noteId: string, at: number): boolean {
  try {
    const key = `reminder-fired:${noteId}:${at}`;
    if (localStorage.getItem(key)) return false;
    localStorage.setItem(key, "1");
    return true;
  } catch {
    return true;
  }
}

async function announce(title: string, url: string, noteId: string) {
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  const options: NotificationOptions = { body: title, tag: `reminder-${noteId}`, data: { url }, icon: "/icon.svg" };
  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    if (registration) {
      await registration.showNotification("Note reminder", options);
      return;
    }
    const notification = new Notification("Note reminder", options);
    notification.onclick = () => { window.focus(); window.location.assign(url); };
  } catch {
    // The in-app card still shows the reminder.
  }
}

export function ReminderNotifier() {
  const router = useRouter();
  const { user } = useAuth();
  const { privateKey } = useUserKeysContext();
  const { metaByNote, updateMeta } = useNoteMeta();
  const [due, setDue] = useState<DueReminder[]>([]);
  const keyRef = useRef(privateKey);
  const updateRef = useRef(updateMeta);

  useEffect(() => {
    keyRef.current = privateKey;
    updateRef.current = updateMeta;
  });

  useEffect(() => {
    if (!user) return;
    const userId = user.uid;
    const timers: number[] = [];

    const fire = async (noteId: string, at: number, repeat: ReminderRepeat | null) => {
      if (!claim(noteId, at)) return;
      try {
        const snapshot = await getDoc(doc(db, "notes", noteId));
        if (!snapshot.exists() || snapshot.data().deletedAt) return;
        const note = { id: noteId, mode: snapshot.data().mode || "normal", ...snapshot.data() } as Note;
        const title = isNormalNote(note)
          ? getNoteTitle(note)
          : (keyRef.current && await decryptNoteTitle(note, userId, keyRef.current)) || "An encrypted note";
        const url = isCollabNote(note) ? `/collab/${noteId}` : `/notes?open=${encodeURIComponent(noteId)}`;
        setDue((current) => [...current.filter((item) => item.noteId !== noteId), { noteId, title, url }]);
        await announce(title, url, noteId);
      } catch (error) {
        console.error("Reminder failed:", error);
      } finally {
        // Repeating reminders move on to their next time; one-off reminders are cleared.
        const next = repeat ? { reminderAt: nextOccurrence(at, repeat, Date.now()) } : { reminderAt: null };
        await updateRef.current(noteId, next).catch(() => {});
      }
    };

    metaByNote.forEach((meta, noteId) => {
      if (meta.reminderAt === null) return;
      const at = meta.reminderAt;
      const repeat = meta.repeat;
      const delay = at - Date.now();
      if (delay > MAX_TIMEOUT) return;
      timers.push(window.setTimeout(() => void fire(noteId, at, repeat), Math.max(0, delay)));
    });
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [user, metaByNote]);

  if (!due.length) return null;

  return (
    <div className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] right-4 z-[var(--z-toast)] flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2 md:bottom-4" role="region" aria-label="Reminders">
      {due.map((item) => (
        <div key={item.noteId} role="alert" className="card flex items-start gap-3 p-4">
          <Bell size={20} className="mt-0.5 shrink-0 text-amber-700" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-amber-900">Reminder</p>
            <p className="truncate text-sm font-semibold text-slate-900">{item.title}</p>
            <button type="button" onClick={() => { setDue((current) => current.filter((entry) => entry.noteId !== item.noteId)); router.push(item.url); }}
              className="btn-primary mt-2">
              Open note
            </button>
          </div>
          <button type="button" aria-label="Dismiss reminder" onClick={() => setDue((current) => current.filter((entry) => entry.noteId !== item.noteId))}
            className="icon-btn shrink-0">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
      ))}
    </div>
  );
}
