/**
 * Encryption service using AES-256-GCM.
 * Each encryption generates a unique 12-byte IV for security.
 */

import { arrayBufferToBase64 } from "./serialization";

/** Encrypt plaintext using AES-GCM. Returns base64-encoded ciphertext and IV. */
export async function encryptData(
  plaintext: string,
  key: CryptoKey
): Promise<{ ciphertext: string; iv: string }> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);

  // Generate a random 12-byte IV (recommended for AES-GCM)
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    data
  );

  return {
    ciphertext: arrayBufferToBase64(encrypted),
    iv: arrayBufferToBase64(iv.buffer),
  };
}
