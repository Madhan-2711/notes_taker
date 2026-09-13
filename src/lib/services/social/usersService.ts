/**
 * User profile service for managing user documents in Firestore.
 * Handles user profiles, public keys, and vault backup storage.
 */

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { type UserProfile } from "../../validations";
import { importPublicKey } from "../crypto/keys";
import type { User as FirebaseUser } from "firebase/auth";

/**
 * Get or create a user profile document.
 * Called on sign-in to ensure the user has a Firestore profile.
 */
export async function getOrCreateUserProfile(
  user: FirebaseUser,
  publicKeyJwk?: string
): Promise<UserProfile> {
  const privateRef = doc(db, "users", user.uid);
  const publicRef = doc(db, "public_profiles", user.uid);
  const [privateSnap, publicSnap] = await Promise.all([
    getDoc(privateRef),
    getDoc(publicRef),
  ]);

  const legacy = privateSnap.exists() ? privateSnap.data() : {};
  const privateProfile = {
    email: user.email || "",
    wrappedPrivateKey: legacy.wrappedPrivateKey || "",
    createdAt: legacy.createdAt || Date.now(),
  };
  const publicProfile = publicSnap.exists()
    ? publicSnap.data()
    : {
        displayName: user.displayName || "Anonymous",
        photoURL: user.photoURL || null,
        publicKey: legacy.publicKey || publicKeyJwk || "",
        createdAt: legacy.createdAt || Date.now(),
      };

  if (!privateSnap.exists()) await setDoc(privateRef, privateProfile);
  if (!publicSnap.exists()) await setDoc(publicRef, publicProfile);

  if (user.email) {
    await setDoc(doc(db, "email_directory", user.email.toLowerCase()), {
      uid: user.uid,
    });
  }

  return {
    uid: user.uid,
    email: privateProfile.email,
    displayName: publicProfile.displayName || "Anonymous",
    photoURL: publicProfile.photoURL || null,
    publicKey: publicProfile.publicKey || "",
    wrappedPrivateKey: privateProfile.wrappedPrivateKey || undefined,
    createdAt: publicProfile.createdAt || privateProfile.createdAt,
  };
}

/** Fetch a user's public CryptoKey from their Firestore profile. */
export async function getUserPublicKey(uid: string): Promise<CryptoKey> {
  const ref = doc(db, "public_profiles", uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    throw new Error("User profile not found");
  }

  const profile = snap.data() as Omit<UserProfile, "uid">;
  if (!profile.publicKey) {
    throw new Error("User has no public key");
  }

  return importPublicKey(profile.publicKey);
}

/** Search for a user by exact email match. */
export async function searchUserByEmail(
  email: string
): Promise<UserProfile | null> {
  const normalizedEmail = email.toLowerCase().trim();
  const directorySnap = await getDoc(doc(db, "email_directory", normalizedEmail));
  if (!directorySnap.exists()) return null;

  const uid = directorySnap.data().uid as string;
  const profileSnap = await getDoc(doc(db, "public_profiles", uid));
  if (!profileSnap.exists()) return null;

  return {
    uid,
    email: normalizedEmail,
    ...profileSnap.data(),
  } as UserProfile;
}

/** Save a wrapped (vault-encrypted) private key to Firestore for multi-device sync. */
export async function updateWrappedPrivateKey(
  uid: string,
  wrapped: string
): Promise<void> {
  await updateDoc(doc(db, "users", uid), { wrappedPrivateKey: wrapped });
}

/** Fetch the wrapped private key from Firestore. Returns null if not set. */
export async function getWrappedPrivateKey(
  uid: string
): Promise<string | null> {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);

  if (!snap.exists()) return null;
  return snap.data().wrappedPrivateKey || null;
}

/** Update the public key in a user's profile. */
export async function updatePublicKey(
  uid: string,
  publicKeyJwk: string
): Promise<void> {
  await updateDoc(doc(db, "public_profiles", uid), { publicKey: publicKeyJwk });
}
