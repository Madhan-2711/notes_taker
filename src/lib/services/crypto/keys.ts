/**
 * Key generation, storage, and vault wrapping services.
 *
 * - RSA-OAEP 4096-bit keys for wrapping/unwrapping per-note AES keys
 * - AES-256-GCM keys for note encryption
 * - IndexedDB (via idb-keyval) for local private key storage
 * - PBKDF2 → AES-GCM for authenticated vault backup encryption
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

/** Reconstruct the public JWK fields carried by an RSA private key. */
export async function exportPublicKeyFromPrivateKey(
  privateKey: CryptoKey
): Promise<string> {
  const privateJwk = await crypto.subtle.exportKey("jwk", privateKey);
  if (!privateJwk.n || !privateJwk.e) throw new Error("Invalid RSA private key");

  const publicJwk: JsonWebKey = {
    kty: "RSA",
    n: privateJwk.n,
    e: privateJwk.e,
    alg: "RSA-OAEP-256",
    ext: true,
    key_ops: ["wrapKey"],
  };
  return JSON.stringify(publicJwk);
}

/** Verify that a public key and private key belong to the same RSA pair. */
export async function keyPairMatches(
  publicKey: CryptoKey,
  privateKey: CryptoKey
): Promise<boolean> {
  const [publicJwk, privateJwk] = await Promise.all([
    crypto.subtle.exportKey("jwk", publicKey),
    crypto.subtle.exportKey("jwk", privateKey),
  ]);
  return publicJwk.n === privateJwk.n && publicJwk.e === privateJwk.e;
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
 * Version 2 vaults use a random salt stored with the encrypted payload.
 */
const VAULT_ITERATIONS = 600_000;

async function deriveWrappingKey(
  password: string,
  salt: ArrayBuffer
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordBuffer = encoder.encode(password);

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
      iterations: VAULT_ITERATIONS,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );

  return wrappingKey;
}

interface VaultEnvelopeV2 {
  version: 2;
  kdf: "PBKDF2-SHA256";
  iterations: number;
  salt: string;
  cipher: "AES-256-GCM";
  iv: string;
  ciphertext: string;
}

/**
 * Wrap a private key with a vault password for backup.
 * Exports the private key as JWK, then encrypts with AES-GCM
 * using a PBKDF2-derived key from the password.
 * Returns a versioned JSON envelope containing the random salt, IV and ciphertext.
 */
export async function wrapPrivateKey(
  privateKey: CryptoKey,
  password: string
): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const wrappingKey = await deriveWrappingKey(password, salt.buffer);

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

  const envelope: VaultEnvelopeV2 = {
    version: 2,
    kdf: "PBKDF2-SHA256",
    iterations: VAULT_ITERATIONS,
    salt: arrayBufferToBase64(salt.buffer),
    cipher: "AES-256-GCM",
    iv: arrayBufferToBase64(iv.buffer),
    ciphertext: arrayBufferToBase64(encrypted),
  };

  return JSON.stringify(envelope);
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
  if (wrapped.trimStart().startsWith("{")) {
    const envelope = JSON.parse(wrapped) as Partial<VaultEnvelopeV2>;
    if (
      envelope.version !== 2 ||
      envelope.kdf !== "PBKDF2-SHA256" ||
      envelope.cipher !== "AES-256-GCM" ||
      envelope.iterations !== VAULT_ITERATIONS ||
      !envelope.salt ||
      !envelope.iv ||
      !envelope.ciphertext
    ) {
      throw new Error("Unsupported vault backup format");
    }

    const salt = new Uint8Array(base64ToArrayBuffer(envelope.salt));
    const iv = new Uint8Array(base64ToArrayBuffer(envelope.iv));
    if (salt.byteLength !== 16 || iv.byteLength !== 12) {
      throw new Error("Invalid vault backup parameters");
    }

    const wrappingKey = await deriveWrappingKey(password, salt.buffer);
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      wrappingKey,
      base64ToArrayBuffer(envelope.ciphertext)
    );

    return importPrivateKey(new TextDecoder().decode(decrypted));
  }

  // Version 1 compatibility: the original format derived its salt from the
  // password and stored [IV length][IV][ciphertext] as one base64 string.
  const passwordBuffer = new TextEncoder().encode(password);
  const saltSource = await crypto.subtle.digest("SHA-256", passwordBuffer);
  const legacySalt = new Uint8Array(saltSource).slice(0, 16);
  const wrappingKey = await deriveWrappingKey(password, legacySalt.buffer);

  const combined = new Uint8Array(base64ToArrayBuffer(wrapped));

  // Parse: [4-byte IV length][IV][ciphertext]
  const ivLength = new DataView(combined.buffer).getUint32(0);
  if (ivLength !== 12 || combined.byteLength <= 4 + ivLength) {
    throw new Error("Invalid legacy vault backup");
  }
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
