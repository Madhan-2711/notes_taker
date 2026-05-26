/**
 * Key generation, storage, and vault wrapping services.
 *
 * - RSA-OAEP 4096-bit keys for wrapping/unwrapping per-note AES keys
 * - AES-256-GCM keys for note encryption
 * - IndexedDB (via idb-keyval) for local private key storage
 * - PBKDF2 → AES-KW for vault password wrapping (multi-device sync)
 */

import { get, set, del } from "idb-keyval";
import { arrayBufferToBase64, base64ToArrayBuffer } from "./serialization";

// ── AES Key Generation ───────────────────────────────────────────────────────

/** Generate a random 256-bit AES-GCM key. */
export async function generateAESKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true, // extractable — needed for wrapping
    ["encrypt", "decrypt"]
  );
}

// ── RSA Key Pair ─────────────────────────────────────────────────────────────

/** Generate an RSA-OAEP 4096-bit key pair. */
export async function generateRSAKeyPair(): Promise<{
  publicKey: CryptoKey;
  privateKey: CryptoKey;
}> {
  return crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 4096,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true, // extractable
    ["wrapKey", "unwrapKey"]
  );
}

// ── Public Key Export/Import ──────────────────────────────────────────────────

/** Export an RSA public key as a base64-encoded JWK for Firestore storage. */
export async function exportPublicKey(key: CryptoKey): Promise<string> {
  const jwk = await crypto.subtle.exportKey("jwk", key);
  return JSON.stringify(jwk);
}

/** Import an RSA public key from a base64-encoded JWK from Firestore. */
export async function importPublicKey(jwkString: string): Promise<CryptoKey> {
  const jwk = JSON.parse(jwkString);
  return crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["wrapKey"]
  );
}

/** Import an RSA private key from a JWK string. */
export async function importPrivateKey(jwkString: string): Promise<CryptoKey> {
  const jwk = JSON.parse(jwkString);
  return crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["unwrapKey"]
  );
}

// ── IndexedDB Private Key Storage ─────────────────────────────────────────────

const IDB_KEY_PREFIX = "notes_taker_private_key_";

/** Store a private key in IndexedDB (keyed by user UID). */
export async function storePrivateKey(
  uid: string,
  key: CryptoKey
): Promise<void> {
  // Export as JWK for IndexedDB storage (CryptoKey objects can't be serialized)
  const jwk = await crypto.subtle.exportKey("jwk", key);
  await set(IDB_KEY_PREFIX + uid, JSON.stringify(jwk));
}

/** Load a private key from IndexedDB. Returns null if not found. */
export async function loadPrivateKey(
  uid: string
): Promise<CryptoKey | null> {
  try {
    const stored = await get(IDB_KEY_PREFIX + uid);
    if (!stored) return null;
    return importPrivateKey(stored as string);
  } catch {
    return null;
  }
}

/** Remove a private key from IndexedDB. */
export async function clearPrivateKey(uid: string): Promise<void> {
  await del(IDB_KEY_PREFIX + uid);
}

/**
 * Derive an AES-GCM key from a vault password using PBKDF2.
 * Uses a deterministic salt derived from the password itself.
 */
async function deriveWrappingKey(password: string): Promise<{
  wrappingKey: CryptoKey;
  salt: Uint8Array;
}> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);

  // Use PBKDF2 with a deterministic salt (SHA-256 of password)
  const saltSource = await crypto.subtle.digest("SHA-256", passwordBuffer);
  const salt = new Uint8Array(saltSource).slice(0, 16);

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    passwordBuffer,
    "PBKDF2",
    false,
    ["deriveKey"]
  );

  const wrappingKey = await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 600000, // OWASP recommended minimum for PBKDF2-SHA-256
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );

  return { wrappingKey, salt };
}

/**
 * Wrap a private key with a vault password for backup.
 * Exports the private key as JWK, then encrypts with AES-GCM
 * using a PBKDF2-derived key from the password.
 * Returns a base64-encoded string containing: [4-byte IV length][IV][ciphertext]
 */
export async function wrapPrivateKey(
  privateKey: CryptoKey,
  password: string
): Promise<string> {
  const { wrappingKey } = await deriveWrappingKey(password);

  // Export the private key as JWK and encode to bytes
  const jwk = await crypto.subtle.exportKey("jwk", privateKey);
  const jwkString = JSON.stringify(jwk);
  const encoder = new TextEncoder();
  const jwkBytes = encoder.encode(jwkString);

  // Encrypt using AES-GCM with a random 12-byte IV
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    wrappingKey,
    jwkBytes
  );

  // Combine: [4-byte IV length][IV][ciphertext]
  const ivLenBuf = new Uint8Array(4);
  new DataView(ivLenBuf.buffer).setUint32(0, iv.length);

  const combined = new Uint8Array(4 + iv.length + encrypted.byteLength);
  combined.set(ivLenBuf, 0);
  combined.set(iv, 4);
  combined.set(new Uint8Array(encrypted), 4 + iv.length);

  return arrayBufferToBase64(combined.buffer);
}

/**
 * Unwrap a private key from a vault password backup.
 * Decrypts the AES-GCM ciphertext, then imports the JWK as an RSA private key.
 * Throws if the password is wrong.
 */
export async function unwrapPrivateKey(
  wrapped: string,
  password: string
): Promise<CryptoKey> {
  const { wrappingKey } = await deriveWrappingKey(password);

  const combined = new Uint8Array(base64ToArrayBuffer(wrapped));

  // Parse: [4-byte IV length][IV][ciphertext]
  const ivLength = new DataView(combined.buffer).getUint32(0);
  const iv = combined.slice(4, 4 + ivLength);
  const ciphertext = combined.slice(4 + ivLength);

  // Decrypt using AES-GCM
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    wrappingKey,
    ciphertext
  );

  const decoder = new TextDecoder();
  const jwkString = decoder.decode(decrypted);

  return importPrivateKey(jwkString);
}

