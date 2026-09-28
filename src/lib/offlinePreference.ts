export const OFFLINE_STORAGE_KEY = "notes_taker_trusted_offline_device";

export function offlineStorageEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try { return window.localStorage.getItem(OFFLINE_STORAGE_KEY) === "yes"; }
  catch { return false; }
}
