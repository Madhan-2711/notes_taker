/**
 * Collaboration service for managing note sharing invites.
 */

import {
  collection,
  addDoc,
  updateDoc,
  doc,
  setDoc,
  query,
  where,
  getDocs,
  getDoc,
  onSnapshot,
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

  // Decrypt the note key
  const noteKey = await decryptKeyFromUser(invite.encryptedNoteKey, privateKey);

  // Re-encrypt the key with the user's own public key for direct access
  const userPublicKey = await getUserPublicKey(userId);
  const reEncryptedKey = await encryptKeyForUser(noteKey, userPublicKey);

  // Update the note's collaboratorIds and encryptedKeys
  const noteRef = doc(db, "notes", invite.noteId);
  const noteSnap = await getDoc(noteRef);
  if (!noteSnap.exists()) throw new Error("Note not found");

  const noteData = noteSnap.data();
  const collaboratorIds = noteData.collaboratorIds || [];
  const encryptedKeys = noteData.encryptedKeys || {};

  await updateDoc(noteRef, {
    collaboratorIds: [...collaboratorIds, userId],
    encryptedKeys: { ...encryptedKeys, [userId]: reEncryptedKey },
  });

  // Update invite status
  await updateDoc(inviteRef, { status: "accepted" });
}

/** Reject a collab invite. */
export async function rejectInvite(inviteId: string): Promise<void> {
  await updateDoc(doc(db, "collab_invites", inviteId), { status: "rejected" });
}

/** Revoke a collaborator's access to a note. */
export async function revokeAccess(
  noteId: string,
  collaboratorId: string
): Promise<void> {
  const noteRef = doc(db, "notes", noteId);
  const noteSnap = await getDoc(noteRef);
  if (!noteSnap.exists()) throw new Error("Note not found");

  const noteData = noteSnap.data();
  const collaboratorIds = (noteData.collaboratorIds || []).filter(
    (id: string) => id !== collaboratorId
  );
  const encryptedKeys = { ...noteData.encryptedKeys };
  delete encryptedKeys[collaboratorId];

  await updateDoc(noteRef, { collaboratorIds, encryptedKeys });
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
    const profileRef = doc(db, "users", uid);
    const profileSnap = await getDoc(profileRef);
    if (profileSnap.exists()) {
      profiles.push({ uid: profileSnap.id, ...profileSnap.data() } as UserProfile);
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
