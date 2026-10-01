"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "../hooks/useAuth";
import { hasValidConfig } from "../lib/firebaseConfig";
import type { CollabInvite, FriendRequest } from "../lib/validations";
import { subscribeToPendingRequests } from "../lib/services/social/friendsService";
import { subscribeToInvites } from "../lib/services/social/collaborationService";

interface InboxState {
  invites: CollabInvite[];
  friendRequests: FriendRequest[];
  /** False until both subscriptions have delivered their first snapshot. */
  loaded: boolean;
}

const InboxContext = createContext<InboxState>({ invites: [], friendRequests: [], loaded: false });

/** Live collaboration invites and incoming friend requests, shared by the nav badge and pages. */
export function InboxProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<{ uid: string; invites?: CollabInvite[]; friendRequests?: FriendRequest[] } | null>(null);

  useEffect(() => {
    if (!user || !hasValidConfig) return;
    const uid = user.uid;
    const stopInvites = subscribeToInvites(uid, (invites) =>
      setState((previous) => ({ ...(previous?.uid === uid ? previous : {}), uid, invites })));
    const stopRequests = subscribeToPendingRequests(uid, (friendRequests) =>
      setState((previous) => ({ ...(previous?.uid === uid ? previous : {}), uid, friendRequests })));
    return () => { stopInvites(); stopRequests(); };
  }, [user]);

  const current = state && user && state.uid === user.uid ? state : null;
  const value: InboxState = {
    invites: current?.invites ?? [],
    friendRequests: current?.friendRequests ?? [],
    loaded: Boolean(current?.invites && current?.friendRequests),
  };

  return <InboxContext.Provider value={value}>{children}</InboxContext.Provider>;
}

export function useInbox() {
  return useContext(InboxContext);
}
