import { deleteDoc, doc, setDoc } from "firebase/firestore";
import { app, db } from "./firebaseConfig";

/**
 * Reminder push notifications for this device. The browser subscribes through Firebase
 * Cloud Messaging; the token is stored privately at users/{uid}/pushTokens/{id} so the
 * sendDueReminders Cloud Function can reach this device when the app is closed.
 */
export type PushStatus =
  | "unsupported"   // browser can't do web push (e.g. iOS Safari outside an installed app)
  | "unconfigured"  // the site has no VAPID key set (NEXT_PUBLIC_FIREBASE_VAPID_KEY)
  | "no-worker"     // service worker not active (development, or first visit)
  | "denied"        // notifications blocked in browser settings
  | "off"
  | "on";

const TOKEN_ID_KEY = "notes_taker_push_token_id";
const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

async function tokenId(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 40);
}

function savedTokenId(): string | null {
  try { return window.localStorage.getItem(TOKEN_ID_KEY); } catch { return null; }
}

function platformLabel(): string {
  const agent = navigator.userAgent;
  const os = /Android/.test(agent) ? "Android" : /iPhone|iPad/.test(agent) ? "iOS" : /Mac/.test(agent) ? "Mac" : /Windows/.test(agent) ? "Windows" : /Linux/.test(agent) ? "Linux" : "Device";
  const browser = /Edg\//.test(agent) ? "Edge" : /Firefox\//.test(agent) ? "Firefox" : /Chrome\//.test(agent) ? "Chrome" : /Safari\//.test(agent) ? "Safari" : "browser";
  return `${os}, ${browser}`;
}

async function workerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  return (await navigator.serviceWorker.getRegistration("/")) ?? null;
}

export async function getPushStatus(): Promise<PushStatus> {
  if (typeof window === "undefined" || !("Notification" in window) || !("PushManager" in window)) return "unsupported";
  const { isSupported } = await import("firebase/messaging");
  if (!(await isSupported().catch(() => false))) return "unsupported";
  if (!VAPID_KEY) return "unconfigured";
  if (!(await workerRegistration())) return "no-worker";
  if (Notification.permission === "denied") return "denied";
  return Notification.permission === "granted" && savedTokenId() ? "on" : "off";
}

export async function enablePush(userId: string): Promise<PushStatus> {
  if (!app || !VAPID_KEY) return "unconfigured";
  const registration = await workerRegistration();
  if (!registration) return "no-worker";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission === "denied" ? "denied" : "off";
  const { getMessaging, getToken } = await import("firebase/messaging");
  const token = await getToken(getMessaging(app), { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
  if (!token) throw new Error("This browser didn't provide a push address. Try again, or use another browser.");
  const id = await tokenId(token);
  const now = Date.now();
  await setDoc(doc(db, "users", userId, "pushTokens", id), { token, platform: platformLabel(), createdAt: now, updatedAt: now });
  try { window.localStorage.setItem(TOKEN_ID_KEY, id); } catch { /* status falls back to "off" next time */ }
  return "on";
}

export async function disablePush(userId: string): Promise<PushStatus> {
  const id = savedTokenId();
  if (id) await deleteDoc(doc(db, "users", userId, "pushTokens", id)).catch(() => undefined);
  try { window.localStorage.removeItem(TOKEN_ID_KEY); } catch { /* nothing to clean up */ }
  if (app) {
    const { getMessaging, deleteToken } = await import("firebase/messaging");
    await deleteToken(getMessaging(app)).catch(() => undefined);
  }
  return "off";
}
