/**
 * Key sharing utilities for encrypting/decrypting per-note AES keys
 * using RSA-OAEP public/private keys.
 *
 * This enables secure key exchange: the note owner wraps the AES key
 * with each collaborator's public key so only they can unwrap it.
 */

import { arrayBufferToBase64, base64ToArrayBuffer } from "./serialization";

/**
 * Encrypt (wrap) a note's AES key for a specific recipient using their RSA public key.
 * Returns a base64-encoded string suitable for Firestore storage.
 */
export async function encryptKeyForUser(
  noteKey: CryptoKey,
  recipientPublicKey: CryptoKey
): Promise<string> {
  const wrapped = await crypto.subtle.wrapKey(
    "raw",
    noteKey,
    recipientPublicKey,
    { name: "RSA-OAEP" }
  );
  return arrayBufferToBase64(wrapped);
}

/**
 * Decrypt (unwrap) a note's AES key using the recipient's RSA private key.
 * Takes the base64-encoded wrapped key from Firestore.
 */
export async function decryptKeyFromUser(
  encryptedKey: string,
  privateKey: CryptoKey
): Promise<CryptoKey> {
  const wrappedBuffer = base64ToArrayBuffer(encryptedKey);
  return crypto.subtle.unwrapKey(
    "raw",
    wrappedBuffer,
    privateKey,
    { name: "RSA-OAEP" },
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}
