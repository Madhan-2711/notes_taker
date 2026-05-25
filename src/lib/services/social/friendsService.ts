/**
 * Friends service for managing friend requests and friendships.
 */

import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  getDocs,
  onSnapshot,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "../../firebaseConfig";
import { type FriendRequest, type UserProfile } from "../../validations";
import { searchUserByEmail } from "./usersService";

/**
 * Send a friend request to a user by email.
 * Checks for existing pending requests to prevent spam.
 */
export async function sendFriendRequest(
  senderId: string,
  senderEmail: string,
  senderName: string,
  senderPhoto: string | null,
  receiverEmail: string
): Promise<void> {
  // Look up receiver by email
  const receiver = await searchUserByEmail(receiverEmail);
  if (!receiver) {
    throw new Error("No user found with that email address.");
  }

  if (receiver.uid === senderId) {
    throw new Error("You can't send a friend request to yourself.");
  }

  // Check for existing pending request
  const existingQuery = query(
    collection(db, "friend_requests"),
    where("senderId", "==", senderId),
    where("receiverId", "==", receiver.uid),
    where("status", "==", "pending")
  );
  const existing = await getDocs(existingQuery);
  if (!existing.empty) {
    throw new Error("You already have a pending friend request to this user.");
  }

  // Check if they're already friends
  const friendsQuery = query(
    collection(db, "friends"),
    where("users", "array-contains", senderId)
  );
  const friends = await getDocs(friendsQuery);
  const alreadyFriends = friends.docs.some((d) => {
    const users = d.data().users as string[];
    return users.includes(receiver.uid);
  });
  if (alreadyFriends) {
    throw new Error("You are already friends with this user.");
  }

  // Create the friend request
  await addDoc(collection(db, "friend_requests"), {
    senderId,
    senderEmail,
    senderName,
    senderPhoto,
    receiverId: receiver.uid,
    receiverEmail: receiver.email,
    receiverName: receiver.displayName,
    receiverPhoto: receiver.photoURL,
    status: "pending",
    createdAt: Date.now(),
  });
}

/** Get all pending incoming friend requests. */
export async function getPendingRequests(
  userId: string
): Promise<FriendRequest[]> {
  const q = query(
    collection(db, "friend_requests"),
    where("receiverId", "==", userId),
    where("status", "==", "pending")
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as FriendRequest);
}

/** Get all outgoing friend requests (any status). */
export async function getSentRequests(
  userId: string
): Promise<FriendRequest[]> {
  const q = query(
    collection(db, "friend_requests"),
    where("senderId", "==", userId)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as FriendRequest);
}

/** Accept a friend request — updates status and creates a friends doc. */
export async function acceptRequest(
  requestId: string,
  senderId: string,
  receiverId: string
): Promise<void> {
  // Update request status
  await updateDoc(doc(db, "friend_requests", requestId), {
    status: "accepted",
  });

  // Create a friends document
  await addDoc(collection(db, "friends"), {
    users: [senderId, receiverId],
    createdAt: Date.now(),
  });
}

/** Reject a friend request. */
export async function rejectRequest(requestId: string): Promise<void> {
  await updateDoc(doc(db, "friend_requests", requestId), {
    status: "rejected",
  });
}

/** Get all friends for a user (returns their profiles). */
export async function getFriends(
  userId: string
): Promise<(UserProfile & { friendDocId: string })[]> {
  const q = query(
    collection(db, "friends"),
    where("users", "array-contains", userId)
  );
  const snap = await getDocs(q);

  const friends: (UserProfile & { friendDocId: string })[] = [];

  for (const d of snap.docs) {
    const users = d.data().users as string[];
    const friendUid = users.find((uid) => uid !== userId);
    if (!friendUid) continue;

    // Fetch friend's profile
    const profileRef = doc(db, "users", friendUid);
    const { getDoc } = await import("firebase/firestore");
    const profileSnap = await getDoc(profileRef);

    if (profileSnap.exists()) {
      friends.push({
        uid: profileSnap.id,
        friendDocId: d.id,
        ...profileSnap.data(),
      } as UserProfile & { friendDocId: string });
    }
  }

  return friends;
}

/** Remove a friend. */
export async function removeFriend(friendDocId: string): Promise<void> {
  await deleteDoc(doc(db, "friends", friendDocId));
}

/** Real-time subscription to pending incoming friend requests. */
export function subscribeToPendingRequests(
  userId: string,
  callback: (requests: FriendRequest[]) => void
): Unsubscribe {
  const q = query(
    collection(db, "friend_requests"),
    where("receiverId", "==", userId),
    where("status", "==", "pending")
  );

  return onSnapshot(q, (snap) => {
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as FriendRequest);
    data.sort((a, b) => b.createdAt - a.createdAt);
    callback(data);
  });
}
