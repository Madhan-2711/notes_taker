/**
 * Serialization utilities for converting between ArrayBuffer and base64.
 * Used by all crypto services for Firestore storage.
 */

/** Convert ArrayBuffer to base64 string. */
export function arrayBufferToBase64(buffer: ArrayBufferLike): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/** Convert base64 string to ArrayBuffer. */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/** Export an AES-GCM key as a base64-encoded raw key. */
export async function exportAESKey(key: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey("raw", key);
  return arrayBufferToBase64(raw);
}

/** Import an AES-GCM key from a base64-encoded raw key. */
export async function importAESKey(raw: string): Promise<CryptoKey> {
  const buffer = base64ToArrayBuffer(raw);
  return crypto.subtle.importKey(
    "raw",
    buffer,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}
