"use client";

/**
 * Hook for managing user encryption keys.
 *
 * Lifecycle:
 * 1. After auth → check IndexedDB for private key
 * 2. If found → ready
 * 3. If not → check Firestore for wrappedPrivateKey (vault backup)
 *    a. If found → prompt vault password → unwrap → store in IndexedDB
 *    b. If not found → generate new keypair → store public in Firestore,
 *       private in IndexedDB → prompt vault password setup
 */

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "./useAuth";
import { hasValidConfig } from "../lib/firebaseConfig";
import {
  generateRSAKeyPair,
  exportPublicKey,
  loadPrivateKey,
  storePrivateKey,
  wrapPrivateKey,
  unwrapPrivateKey,
  importPublicKey,
  exportPublicKeyFromPrivateKey,
  keyPairMatches,
} from "../lib/services/crypto/keys";
import {
  getOrCreateUserProfile,
  getWrappedPrivateKey,
  updateWrappedPrivateKey,
  updatePublicKey,
} from "../lib/services/social/usersService";

interface UseUserKeysReturn {
  publicKey: CryptoKey | null;
  privateKey: CryptoKey | null;
  isReady: boolean;
  hasKeys: boolean;
  needsVaultPassword: boolean;
  needsVaultSetup: boolean;
  setVaultPassword: (password: string) => Promise<void>;
  unlockVault: (password: string) => Promise<void>;
  error: string | null;
}

export function useUserKeys(): UseUserKeysReturn {
  const { user } = useAuth();
  const [publicKey, setPublicKey] = useState<CryptoKey | null>(null);
  const [privateKey, setPrivateKey] = useState<CryptoKey | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [hasKeys, setHasKeys] = useState(false);
  const [needsVaultPassword, setNeedsVaultPassword] = useState(false);
  const [needsVaultSetup, setNeedsVaultSetup] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || !hasValidConfig) {
      queueMicrotask(() => {
        setIsReady(false);
        setHasKeys(false);
        setPrivateKey(null);
        setPublicKey(null);
      });
      return;
    }

    let cancelled = false;

    async function initKeys() {
      try {
        // Step 1: Check IndexedDB for local private key
        const localKey = await loadPrivateKey(user!.uid);

        if (localKey && !cancelled) {
          // Ensure the stored public key still belongs to this private key.
          const profile = await getOrCreateUserProfile(user!);
          if (profile.publicKey && !cancelled) {
            const pubKey = await importPublicKey(profile.publicKey);
            if (!(await keyPairMatches(pubKey, localKey))) {
              throw new Error("Your local encryption key does not match your account public key");
            }
            setPublicKey(pubKey);
          } else if (!cancelled) {
            const publicKeyJwk = await exportPublicKeyFromPrivateKey(localKey);
            await updatePublicKey(user!.uid, publicKeyJwk);
            setPublicKey(await importPublicKey(publicKeyJwk));
          }

          setPrivateKey(localKey);
          setHasKeys(true);

          // Check if vault backup exists — if not, prompt setup
          const wrappedKey = await getWrappedPrivateKey(user!.uid);
          if (!wrappedKey && !cancelled) {
            setNeedsVaultSetup(true);
          }

          setIsReady(true);
          return;
        }

        // Step 2: No local key — check Firestore for vault backup
        const profile = await getOrCreateUserProfile(user!);
        const wrappedKey = await getWrappedPrivateKey(user!.uid);

        if (wrappedKey && !cancelled) {
          // Need vault password to unwrap
          setNeedsVaultPassword(true);
          setIsReady(true); // Ready but keys not available until unlocked
          return;
        }

        if (profile.publicKey && !cancelled) {
          setError(
            "Your account has an encryption identity, but its private key is unavailable on this device. Import a key backup instead of generating a replacement."
          );
          setIsReady(true);
          return;
        }

        if (!cancelled) {
          // Step 3: No keys anywhere — generate new keypair
          const keyPair = await generateRSAKeyPair();
          const pubKeyJwk = await exportPublicKey(keyPair.publicKey);

          // Store private key locally
          await storePrivateKey(user!.uid, keyPair.privateKey);

          // The profile was created above; publish the matching public key.
          await updatePublicKey(user!.uid, pubKeyJwk);

          setPublicKey(keyPair.publicKey);
          setPrivateKey(keyPair.privateKey);
          setHasKeys(true);
          setNeedsVaultSetup(true); // Prompt to set vault password
          setIsReady(true);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Key initialization error:", err);
          setPrivateKey(null);
          setPublicKey(null);
          setHasKeys(false);
          setError(err instanceof Error ? err.message : "Failed to initialize encryption keys");
          setIsReady(true);
        }
      }
    }

    initKeys();
    return () => { cancelled = true; };
  }, [user]);

  /** Set up vault password for the first time (wraps private key for Firestore backup). */
  const setVaultPassword = useCallback(async (password: string) => {
    if (!user || !privateKey) return;
    setError(null);

    try {
      const wrapped = await wrapPrivateKey(privateKey, password);
      await updateWrappedPrivateKey(user.uid, wrapped);
      setNeedsVaultSetup(false);
    } catch (err) {
      console.error("Vault setup error:", err);
      setError("Failed to set vault password");
    }
  }, [user, privateKey]);

  /** Unlock vault on a new device (unwraps private key from Firestore backup). */
  const unlockVault = useCallback(async (password: string) => {
    if (!user) return;
    setError(null);

    try {
      const wrapped = await getWrappedPrivateKey(user.uid);
      if (!wrapped) {
        setError("No vault backup found");
        return;
      }

      const unwrapped = await unwrapPrivateKey(wrapped, password);
      await storePrivateKey(user.uid, unwrapped);

      setPrivateKey(unwrapped);
      setHasKeys(true);
      setNeedsVaultPassword(false);

      // Also load the public key
      const profile = await getOrCreateUserProfile(user);
      if (profile.publicKey) {
        const pubKey = await importPublicKey(profile.publicKey);
        if (!(await keyPairMatches(pubKey, unwrapped))) {
          throw new Error("Vault key does not match the account public key");
        }
        setPublicKey(pubKey);
      }
    } catch (err) {
      console.error("Vault unlock error:", err);
      setError("Wrong vault password. Please try again.");
    }
  }, [user]);

  return {
    publicKey,
    privateKey,
    isReady,
    hasKeys,
    needsVaultPassword,
    needsVaultSetup,
    setVaultPassword,
    unlockVault,
    error,
  };
}
