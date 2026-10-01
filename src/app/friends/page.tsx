"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence } from "framer-motion";
import { Send, UserPlus, Users, LockKeyhole, ChevronDown, Loader2 } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { useUserKeys } from "../../hooks/useUserKeys";
import { useMyUsername } from "../../hooks/useMyUsername";
import { useInbox } from "../../contexts/InboxContext";
import { useToast } from "../../contexts/ToastContext";
import { hasValidConfig } from "../../lib/firebaseConfig";
import { type FriendRequest, type UserProfile } from "../../lib/validations";
import {
  sendFriendRequest,
  getSentRequests,
  acceptRequest,
  rejectRequest,
  getFriends,
  removeFriend,
} from "../../lib/services/social/friendsService";
import { acceptInvite, rejectInvite } from "../../lib/services/social/collaborationService";
import { FriendRequestCard } from "../../components/FriendRequestCard";
import { FriendCard } from "../../components/FriendCard";
import { CollabInviteCard } from "../../components/CollabInviteCard";
import { PageHeader } from "../../components/PageHeader";
import { EmptyState, PageLoading, SignInRequired } from "../../components/PageState";

export default function FriendsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const { privateKey, needsVaultSetup, openVaultSetup } = useUserKeys();
  const { invites: collabInvites, friendRequests: incomingRequests } = useInbox();
  const myUsername = useMyUsername(user?.uid);

  const [searchEmail, setSearchEmail] = useState("");
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchSuccess, setSearchSuccess] = useState(false);
  const [sending, setSending] = useState(false);
  const [sentRequests, setSentRequests] = useState<FriendRequest[]>([]);
  const [friends, setFriends] = useState<(UserProfile & { friendDocId: string })[] | null>(null);
  const [loadError, setLoadError] = useState("");

  const loadData = useCallback(async () => {
    if (!user) return;
    const [sent, friendsList] = await Promise.all([
      getSentRequests(user.uid),
      getFriends(user.uid),
    ]);
    setSentRequests(sent);
    setFriends(friendsList);
  }, [user]);

  // Fetch sent requests and friends (re-fetch on user change)
  useEffect(() => {
    if (!user || !hasValidConfig) return;
    let cancelled = false;
    Promise.all([getSentRequests(user.uid), getFriends(user.uid)]).then(
      ([sent, friendsList]) => {
        if (cancelled) return;
        setSentRequests(sent);
        setFriends(friendsList);
      }
    ).catch(() => {
      if (!cancelled) { setLoadError("Could not load your friends. Check your connection and refresh."); setFriends([]); }
    });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const handleSendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !searchEmail.trim()) return;

    setSearchError(null);
    setSearchSuccess(false);
    setSending(true);

    try {
      await sendFriendRequest(
        user.uid,
        user.email || "",
        user.displayName || "Anonymous",
        user.photoURL,
        searchEmail.trim()
      );
      setSearchSuccess(true);
      setSearchEmail("");
      setTimeout(() => setSearchSuccess(false), 3000);
      // Refresh sent requests
      const sent = await getSentRequests(user.uid);
      setSentRequests(sent);
    } catch (err: unknown) {
      setSearchError(err instanceof Error ? err.message : "Failed to send request");
    } finally {
      setSending(false);
    }
  };

  // Errors propagate to the card, which shows them inline.
  const handleAccept = async (requestId: string) => {
    if (!user) return;
    const request = incomingRequests.find((r) => r.id === requestId);
    if (!request) return;
    await acceptRequest(requestId, request.senderId, user.uid);
    await loadData();
    toast({ message: `You and ${request.senderName || "your new friend"} are now friends` });
  };

  const handleReject = async (requestId: string) => {
    await rejectRequest(requestId);
  };

  const handleRemoveFriend = async (friendDocId: string) => {
    await removeFriend(friendDocId);
    setFriends((prev) => (prev ?? []).filter((f) => f.friendDocId !== friendDocId));
    toast({ message: "Friend removed" });
  };

  const handleAcceptInvite = async (inviteId: string) => {
    if (!user) return;
    if (!privateKey) throw new Error("Unlock your vault to accept this invitation.");
    await acceptInvite(inviteId, user.uid, privateKey);
    // Find the invite to get noteId for navigation
    const invite = collabInvites.find((i) => i.id === inviteId);
    if (invite) {
      router.push(`/collab/${invite.noteId}`);
    }
  };

  const handleRejectInvite = async (inviteId: string) => {
    await rejectInvite(inviteId);
  };

  if (loading) return <PageLoading cards={2} label="Loading friends" />;
  if (!user) return <SignInRequired>Sign in to manage friends.</SignInRequired>;

  const waiting = collabInvites.length + incomingRequests.length;
  const pendingSent = sentRequests.filter((request) => request.status === "pending").length;

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <PageHeader
        title="Friends"
        subtitle={myUsername
          ? <>Friends can add you as <strong className="font-semibold text-slate-900">@{myUsername}</strong>. <Link href="/settings" className="font-semibold text-indigo-800 underline-offset-2 hover:underline">Change</Link></>
          : myUsername === null
            ? <><Link href="/settings" className="font-semibold text-indigo-800 underline-offset-2 hover:underline">Pick a username</Link> so friends can find you without your email.</>
            : undefined}
      />

      <div className="space-y-6">
        {/* Things that need a decision come first. */}
        {waiting > 0 && (
          <section aria-labelledby="waiting-heading" className="card p-5 sm:p-6">
            <h2 id="waiting-heading" className="flex items-center gap-2 text-lg font-bold tracking-tight">
              Waiting for you <span className="rounded-full bg-rose-600 px-2 py-0.5 text-xs font-bold text-white">{waiting}</span>
            </h2>
            {collabInvites.length > 0 && !privateKey && (
              <div className="mt-4 flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
                <span className="flex items-start gap-2">
                  <LockKeyhole size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                  {needsVaultSetup ? "Set up a vault password before accepting shared notes." : "Unlock your vault to accept shared notes."}
                </span>
                {needsVaultSetup && <button type="button" onClick={openVaultSetup} className="btn-secondary shrink-0">Set up vault</button>}
              </div>
            )}
            <ul className="mt-4 divide-y divide-slate-200">
              <AnimatePresence initial={false}>
                {collabInvites.map((invite) => (
                  <CollabInviteCard
                    key={invite.id}
                    invite={invite}
                    canAccept={Boolean(privateKey)}
                    onAccept={handleAcceptInvite}
                    onReject={handleRejectInvite}
                  />
                ))}
                {incomingRequests.map((req) => (
                  <FriendRequestCard
                    key={req.id}
                    request={req}
                    direction="incoming"
                    onAccept={handleAccept}
                    onReject={handleReject}
                  />
                ))}
              </AnimatePresence>
            </ul>
          </section>
        )}

        <section aria-labelledby="add-friend-heading" className="panel p-5 sm:p-6">
          <h2 id="add-friend-heading" className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <UserPlus size={18} aria-hidden="true" /> Add a friend
          </h2>
          <form onSubmit={handleSendRequest} className="mt-4 flex flex-col gap-2 sm:flex-row">
            <label htmlFor="friend-search" className="sr-only">Friend&apos;s username or email address</label>
            <input
              id="friend-search"
              type="text"
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              placeholder="Username or email address…"
              autoCapitalize="none"
              autoComplete="off"
              spellCheck={false}
              aria-invalid={Boolean(searchError) || undefined}
              aria-describedby={searchError ? "friend-search-error" : undefined}
              className="field sm:flex-1"
            />
            <button type="submit" disabled={!searchEmail.trim() || sending} className="btn-primary shrink-0">
              {sending ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Send size={15} aria-hidden="true" />}
              {sending ? "Sending…" : "Send request"}
            </button>
          </form>
          <div aria-live="polite">
            {searchError && <p id="friend-search-error" className="mt-2 text-sm font-medium text-red-700">{searchError}</p>}
            {searchSuccess && <p className="mt-2 text-sm font-medium text-emerald-800">Friend request sent.</p>}
          </div>
        </section>

        <section aria-labelledby="friends-heading">
          <h2 id="friends-heading" className="mb-3 flex items-center gap-2 text-lg font-bold tracking-tight">
            <Users size={18} aria-hidden="true" /> Your friends
            {friends && friends.length > 0 && <span className="text-sm font-semibold tabular-nums text-slate-600">{friends.length}</span>}
          </h2>
          {loadError && <p role="alert" className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">{loadError}</p>}
          {friends === null ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" aria-busy="true" aria-label="Loading friends">
              {[0, 1].map((index) => <div key={index} className="h-[70px] animate-pulse rounded-2xl border border-slate-200 bg-white" />)}
            </div>
          ) : friends.length > 0 ? (
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <AnimatePresence initial={false}>
                {friends.map((friend) => (
                  <FriendCard
                    key={friend.uid}
                    friend={friend}
                    onRemove={handleRemoveFriend}
                  />
                ))}
              </AnimatePresence>
            </ul>
          ) : (
            <EmptyState
              icon={<Users size={22} />}
              title="No friends yet"
              description="Send a request with a username or email to start sharing notes."
              action={<button type="button" onClick={() => document.getElementById("friend-search")?.focus()} className="btn-secondary">Add a friend</button>}
            />
          )}
        </section>

        {sentRequests.length > 0 && (
          <details className="panel group px-5 sm:px-6">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 font-semibold text-slate-900 [&::-webkit-details-marker]:hidden">
              <span className="flex items-center gap-2"><Send size={16} aria-hidden="true" /> Sent requests <span className="text-sm tabular-nums text-slate-600">{pendingSent > 0 ? `${pendingSent} pending` : sentRequests.length}</span></span>
              <ChevronDown size={18} className="text-slate-600 transition-transform group-open:rotate-180" aria-hidden="true" />
            </summary>
            <ul className="divide-y divide-slate-200 border-t border-slate-200 py-4">
              {sentRequests.map((req) => (
                <FriendRequestCard key={req.id} request={req} direction="outgoing" />
              ))}
            </ul>
          </details>
        )}
      </div>
    </div>
  );
}
