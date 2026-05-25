/**
 * User profile service for managing user documents in Firestore.
 * Handles user profiles, public keys, and vault backup storage.
 */

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  query,
  collection,
  where,
  getDocs,
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
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    return { uid: snap.id, ...snap.data() } as UserProfile;
  }

  // Create new profile
  const profile: Omit<UserProfile, "uid"> = {
    email: user.email || "",
    displayName: user.displayName || "Anonymous",
    photoURL: user.photoURL || null,
    publicKey: publicKeyJwk || "",
    createdAt: Date.now(),
  };

  await setDoc(ref, profile);
  return { uid: user.uid, ...profile };
}

/** Fetch a user's public CryptoKey from their Firestore profile. */
export async function getUserPublicKey(uid: string): Promise<CryptoKey> {
  const ref = doc(db, "users", uid);
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
  const q = query(
    collection(db, "users"),
    where("email", "==", email.toLowerCase().trim())
  );
  const snap = await getDocs(q);

  if (snap.empty) return null;
  const d = snap.docs[0];
  return { uid: d.id, ...d.data() } as UserProfile;
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
  const data = snap.data() as Omit<UserProfile, "uid">;
  return data.wrappedPrivateKey || null;
}

/** Update the public key in a user's profile. */
export async function updatePublicKey(
  uid: string,
  publicKeyJwk: string
): Promise<void> {
  await updateDoc(doc(db, "users", uid), { publicKey: publicKeyJwk });
}
