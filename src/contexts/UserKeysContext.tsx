"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "../hooks/useAuth";
import { hasValidConfig } from "../lib/firebaseConfig";
import {
  exportPublicKey,
  exportPublicKeyFromPrivateKey,
  generateRSAKeyPair,
  importPublicKey,
  keyPairMatches,
  loadPrivateKey,
  storePrivateKey,
  unwrapPrivateKey,
  wrapPrivateKey,
} from "../lib/services/crypto/keys";
import {
  getOrCreateUserProfile,
  getWrappedPrivateKey,
  updatePublicKey,
  updateWrappedPrivateKey,
} from "../lib/services/social/usersService";
import { KeySetupModal } from "../components/KeySetupModal";
import { VaultUnlockModal } from "../components/VaultUnlockModal";

interface UserKeysContextValue {
  publicKey: CryptoKey | null;
  privateKey: CryptoKey | null;
  isReady: boolean;
  hasKeys: boolean;
  needsVaultPassword: boolean;
  needsVaultSetup: boolean;
  openVaultSetup: () => void;
  setVaultPassword: (password: string) => Promise<void>;
  unlockVault: (password: string) => Promise<void>;
  error: string | null;
}

const UserKeysContext = createContext<UserKeysContextValue | null>(null);

export function UserKeysProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [publicKey, setPublicKey] = useState<CryptoKey | null>(null);
  const [privateKey, setPrivateKey] = useState<CryptoKey | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [hasKeys, setHasKeys] = useState(false);
  const [needsVaultPassword, setNeedsVaultPassword] = useState(false);
  const [needsVaultSetup, setNeedsVaultSetup] = useState(false);
  const [setupDismissed, setSetupDismissed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    queueMicrotask(() => {
      setPublicKey(null);
      setPrivateKey(null);
      setIsReady(false);
      setHasKeys(false);
      setNeedsVaultPassword(false);
      setNeedsVaultSetup(false);
      setSetupDismissed(false);
      setError(null);
    });

    if (!user || !hasValidConfig) return;
    const currentUser = user;

    let cancelled = false;

    async function initializeKeys() {
      try {
        const localKey = await loadPrivateKey(currentUser.uid);

        if (localKey && !cancelled) {
          const profile = await getOrCreateUserProfile(currentUser);
          if (cancelled) return;

          if (profile.publicKey) {
            const storedPublicKey = await importPublicKey(profile.publicKey);
            if (!(await keyPairMatches(storedPublicKey, localKey))) {
              throw new Error("Your local encryption key does not match your account public key");
            }
            setPublicKey(storedPublicKey);
          } else {
            const publicKeyJwk = await exportPublicKeyFromPrivateKey(localKey);
            await updatePublicKey(currentUser.uid, publicKeyJwk);
            setPublicKey(await importPublicKey(publicKeyJwk));
          }

          const wrappedKey = await getWrappedPrivateKey(currentUser.uid);
          if (cancelled) return;

          setPrivateKey(localKey);
          setHasKeys(true);
          setNeedsVaultSetup(!wrappedKey);
          setIsReady(true);
          return;
        }

        const profile = await getOrCreateUserProfile(currentUser);
        const wrappedKey = await getWrappedPrivateKey(currentUser.uid);
        if (cancelled) return;

        if (wrappedKey) {
          setNeedsVaultPassword(true);
          setIsReady(true);
          return;
        }

        if (profile.publicKey) {
          setError(
            "Your account has an encryption identity, but its private key is unavailable on this device. Import a key backup instead of generating a replacement."
          );
          setIsReady(true);
          return;
        }

        const keyPair = await generateRSAKeyPair();
        const publicKeyJwk = await exportPublicKey(keyPair.publicKey);
        if (cancelled) return;

        await storePrivateKey(currentUser.uid, keyPair.privateKey);
        await updatePublicKey(currentUser.uid, publicKeyJwk);
        if (cancelled) return;

        setPublicKey(keyPair.publicKey);
        setPrivateKey(keyPair.privateKey);
        setHasKeys(true);
        setNeedsVaultSetup(true);
        setIsReady(true);
      } catch (caughtError) {
        if (cancelled) return;
        console.error("Key initialization error:", caughtError);
        setPublicKey(null);
        setPrivateKey(null);
        setHasKeys(false);
        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "Failed to initialize encryption keys"
        );
        setIsReady(true);
      }
    }

    void initializeKeys();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const setVaultPassword = useCallback(
    async (password: string) => {
      if (!user || !privateKey) throw new Error("Encryption keys are not ready");
      setError(null);

      try {
        const wrapped = await wrapPrivateKey(privateKey, password);
        await updateWrappedPrivateKey(user.uid, wrapped);
        setNeedsVaultSetup(false);
      } catch (caughtError) {
        console.error("Vault setup error:", caughtError);
        setError("Failed to set vault password");
        throw caughtError;
      }
    },
    [user, privateKey]
  );

  const unlockVault = useCallback(
    async (password: string) => {
      if (!user) throw new Error("You must be signed in to unlock the vault");
      setError(null);

      try {
        const wrapped = await getWrappedPrivateKey(user.uid);
        if (!wrapped) throw new Error("No vault backup found");

        const unwrapped = await unwrapPrivateKey(wrapped, password);
        const profile = await getOrCreateUserProfile(user);
        if (!profile.publicKey) throw new Error("Account public key is missing");

        const storedPublicKey = await importPublicKey(profile.publicKey);
        if (!(await keyPairMatches(storedPublicKey, unwrapped))) {
          throw new Error("Vault key does not match the account public key");
        }

        await storePrivateKey(user.uid, unwrapped);
        setPrivateKey(unwrapped);
        setPublicKey(storedPublicKey);
        setHasKeys(true);
        setNeedsVaultPassword(false);
      } catch (caughtError) {
        console.error("Vault unlock error:", caughtError);
        setError("Wrong vault password. Please try again.");
        throw caughtError;
      }
    },
    [user]
  );

  const openVaultSetup = useCallback(() => {
    setSetupDismissed(false);
  }, []);

  const value = useMemo(
    () => ({
      publicKey,
      privateKey,
      isReady,
      hasKeys,
      needsVaultPassword,
      needsVaultSetup,
      openVaultSetup,
      setVaultPassword,
      unlockVault,
      error,
    }),
    [
      publicKey,
      privateKey,
      isReady,
      hasKeys,
      needsVaultPassword,
      needsVaultSetup,
      openVaultSetup,
      setVaultPassword,
      unlockVault,
      error,
    ]
  );

  return (
    <UserKeysContext.Provider value={value}>
      {children}
      <KeySetupModal
        isOpen={needsVaultSetup && !setupDismissed}
        onClose={() => setSetupDismissed(true)}
        onSetPassword={setVaultPassword}
      />
      <VaultUnlockModal
        isOpen={needsVaultPassword}
        onUnlock={unlockVault}
        error={error}
      />
    </UserKeysContext.Provider>
  );
}

export function useUserKeysContext(): UserKeysContextValue {
  const value = useContext(UserKeysContext);
  if (!value) throw new Error("useUserKeys must be used inside UserKeysProvider");
  return value;
}
