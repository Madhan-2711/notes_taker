/**
 * Collaboration service for managing note sharing invites.
 */

import {
  collection,
  updateDoc,
  doc,
  setDoc,
  query,
  where,
  getDocs,
  getDoc,
  onSnapshot,
  arrayUnion,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { type CollabInvite, type UserProfile } from "../../validations";
import { encryptKeyForUser, decryptKeyFromUser } from "../crypto/sharing";
import { getUserPublicKey } from "./usersService";

/**
 * Send a collaboration invite to a friend.
 * Encrypts the note's AES key with the recipient's public key.
 */
export async function sendCollabInvite(
  noteId: string,
  senderId: string,
  senderName: string,
  senderEmail: string,
  receiverId: string,
  receiverName: string,
  permission: "viewer" | "editor",
  noteKey: CryptoKey
): Promise<void> {
  const noteSnap = await getDoc(doc(db, "notes", noteId));
  if (!noteSnap.exists() || noteSnap.data().authorId !== senderId) {
    throw new Error("Only the note owner can invite collaborators.");
  }

  // Lazily migrate pre-role collaborative notes. Existing collaborators were
  // historically editors, so preserving that role avoids breaking access.
  if (!noteSnap.data().collaboratorRoles) {
    const legacyRoles = Object.fromEntries(
      ((noteSnap.data().collaboratorIds || []) as string[]).map((uid) => [uid, "editor"])
    );
    await updateDoc(noteSnap.ref, { collaboratorRoles: legacyRoles });
  }

  // Get recipient's public key for key wrapping
  const recipientPublicKey = await getUserPublicKey(receiverId);
  const encryptedNoteKey = await encryptKeyForUser(noteKey, recipientPublicKey);

  const inviteId = `${noteId}_${receiverId}`;
  await setDoc(doc(db, "collab_invites", inviteId), {
    noteId,
    senderId,
    senderName,
    senderEmail,
    receiverId,
    receiverName,
    encryptedNoteKey,
    permission,
    status: "pending",
    createdAt: Date.now(),
  });
}

/** Get all pending incoming collab invites. */
export async function getIncomingInvites(
  userId: string
): Promise<CollabInvite[]> {
  const q = query(
    collection(db, "collab_invites"),
    where("receiverId", "==", userId),
    where("status", "==", "pending")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as CollabInvite);
}

/**
 * Accept a collab invite.
 * Decrypts the note key and adds the user to the note's collaborators.
 *
 * The membership and invitation status writes are committed atomically.
 * Security rules validate both post-write documents with getAfter().
 */
export async function acceptInvite(
  inviteId: string,
  userId: string,
  privateKey: CryptoKey
): Promise<void> {
  // Get the invite
  const inviteRef = doc(db, "collab_invites", inviteId);
  const inviteSnap = await getDoc(inviteRef);
  if (!inviteSnap.exists()) throw new Error("Invite not found");

  const invite = inviteSnap.data() as Omit<CollabInvite, "id">;
  if (invite.receiverId !== userId || invite.status !== "pending") {
    throw new Error("This invitation is not valid for the current user.");
  }

  // Decrypt the note key using the receiver's private key
  const noteKey = await decryptKeyFromUser(invite.encryptedNoteKey, privateKey);

  // Re-encrypt the key with the user's own public key for direct access
  const userPublicKey = await getUserPublicKey(userId);
  const reEncryptedKey = await encryptKeyForUser(noteKey, userPublicKey);

  // arrayUnion and dot notation avoid reading or replacing membership maps.
  const noteRef = doc(db, "notes", invite.noteId);
  const batch = writeBatch(db);
  batch.update(noteRef, {
    collaboratorIds: arrayUnion(userId),
    [`encryptedKeys.${userId}`]: reEncryptedKey,
    [`collaboratorRoles.${userId}`]: invite.permission,
    updatedAt: Date.now(),
  });

  batch.update(inviteRef, { status: "accepted" });
  await batch.commit();
}

/** Reject a collab invite. */
export async function rejectInvite(inviteId: string): Promise<void> {
  await updateDoc(doc(db, "collab_invites", inviteId), { status: "rejected" });
}

/** Revoke a collaborator's access to a note. */
export async function revokeAccess(
  noteId: string,
  ownerId: string,
  collaboratorId: string
): Promise<void> {
  const noteRef = doc(db, "notes", noteId);
  const noteSnap = await getDoc(noteRef);
  if (!noteSnap.exists()) throw new Error("Note not found");

  const noteData = noteSnap.data();
  if (noteData.authorId !== ownerId) {
    throw new Error("Only the note owner can revoke access.");
  }
  const collaboratorIds = (noteData.collaboratorIds || []).filter(
    (id: string) => id !== collaboratorId
  );
  const encryptedKeys = { ...noteData.encryptedKeys };
  delete encryptedKeys[collaboratorId];
  const collaboratorRoles = { ...(noteData.collaboratorRoles || {}) };
  delete collaboratorRoles[collaboratorId];

  await updateDoc(noteRef, {
    collaboratorIds,
    encryptedKeys,
    collaboratorRoles,
    updatedAt: Date.now(),
  });
}

/** Get profiles of all collaborators on a note. */
export async function getCollaborators(
  noteId: string
): Promise<UserProfile[]> {
  const noteRef = doc(db, "notes", noteId);
  const noteSnap = await getDoc(noteRef);
  if (!noteSnap.exists()) return [];

  const noteData = noteSnap.data();
  const collaboratorIds: string[] = noteData.collaboratorIds || [];

  const profiles: UserProfile[] = [];
  for (const uid of collaboratorIds) {
    const profileRef = doc(db, "public_profiles", uid);
    const profileSnap = await getDoc(profileRef);
    if (profileSnap.exists()) {
      profiles.push({
        uid: profileSnap.id,
        email: "",
        ...profileSnap.data(),
      } as UserProfile);
    }
  }

  return profiles;
}

/** Real-time subscription to incoming collab invites. */
export function subscribeToInvites(
  userId: string,
  callback: (invites: CollabInvite[]) => void
): Unsubscribe {
  const q = query(
    collection(db, "collab_invites"),
    where("receiverId", "==", userId),
    where("status", "==", "pending")
  );

  return onSnapshot(q, (snap) => {
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as CollabInvite);
    data.sort((a, b) => b.createdAt - a.createdAt);
    callback(data);
  });
}
