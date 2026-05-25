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

// ── Vault Password Wrapping ──────────────────────────────────────────────────

/**
 * Derive an AES-KW key from a vault password using PBKDF2.
 * Uses a fixed salt derived from the password itself (acceptable since the
 * wrapped key is already high-entropy and we need deterministic derivation).
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
    { name: "AES-KW", length: 256 },
    false,
    ["wrapKey", "unwrapKey"]
  );

  return { wrappingKey, salt };
}

/**
 * Wrap a private key with a vault password for Firestore backup.
 * Returns a base64-encoded wrapped key string.
 */
export async function wrapPrivateKey(
  privateKey: CryptoKey,
  password: string
): Promise<string> {
  const { wrappingKey } = await deriveWrappingKey(password);

  // First export the private key as JWK, then import as a raw-wrappable key
  const jwk = await crypto.subtle.exportKey("jwk", privateKey);
  const jwkString = JSON.stringify(jwk);
  const encoder = new TextEncoder();
  const jwkBytes = encoder.encode(jwkString);

  // Pad to multiple of 8 bytes (required by AES-KW)
  const paddedLength = Math.ceil(jwkBytes.length / 8) * 8;
  const padded = new Uint8Array(paddedLength);
  padded.set(jwkBytes);

  // Import as a generic "raw" key for wrapping
  const rawKey = await crypto.subtle.importKey(
    "raw",
    padded,
    { name: "AES-GCM", length: paddedLength * 8 > 256 ? 256 : 128 },
    true,
    ["encrypt"]
  );

  const wrapped = await crypto.subtle.wrapKey("raw", rawKey, wrappingKey, "AES-KW");

  // Store length prefix so we can trim padding on unwrap
  const lengthPrefix = new Uint8Array(4);
  new DataView(lengthPrefix.buffer).setUint32(0, jwkBytes.length);

  const combined = new Uint8Array(4 + wrapped.byteLength);
  combined.set(lengthPrefix);
  combined.set(new Uint8Array(wrapped), 4);

  return arrayBufferToBase64(combined.buffer);
}

/**
 * Unwrap a private key from a vault password backup.
 * Throws if the password is wrong.
 */
export async function unwrapPrivateKey(
  wrapped: string,
  password: string
): Promise<CryptoKey> {
  const { wrappingKey } = await deriveWrappingKey(password);

  const combined = new Uint8Array(base64ToArrayBuffer(wrapped));
  const originalLength = new DataView(combined.buffer).getUint32(0);
  const wrappedBytes = combined.slice(4);

  const paddedLength = Math.ceil(originalLength / 8) * 8;

  const unwrappedKey = await crypto.subtle.unwrapKey(
    "raw",
    wrappedBytes,
    wrappingKey,
    "AES-KW",
    { name: "AES-GCM", length: paddedLength * 8 > 256 ? 256 : 128 },
    true,
    ["encrypt"]
  );

  // Extract the raw bytes and trim padding
  const rawBytes = new Uint8Array(
    await crypto.subtle.exportKey("raw", unwrappedKey)
  );
  const jwkBytes = rawBytes.slice(0, originalLength);

  const decoder = new TextDecoder();
  const jwkString = decoder.decode(jwkBytes);

  return importPrivateKey(jwkString);
}
