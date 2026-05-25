"use client";

import { useState, useEffect } from "react";
import { useAuth } from "../../hooks/useAuth";
import { hasValidConfig } from "../../lib/firebaseConfig";
import { type FriendRequest, type UserProfile } from "../../lib/validations";
import {
  sendFriendRequest,
  subscribeToPendingRequests,
  getSentRequests,
  acceptRequest,
  rejectRequest,
  getFriends,
  removeFriend,
} from "../../lib/services/social/friendsService";
import { FriendRequestCard } from "../../components/FriendRequestCard";
import { FriendCard } from "../../components/FriendCard";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Search, Send, UserPlus, Users, Inbox } from "lucide-react";
import Link from "next/link";

export default function FriendsPage() {
  const { user, loading } = useAuth();
  const [searchEmail, setSearchEmail] = useState("");
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchSuccess, setSearchSuccess] = useState(false);
  const [sending, setSending] = useState(false);
  const [incomingRequests, setIncomingRequests] = useState<FriendRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<FriendRequest[]>([]);
  const [friends, setFriends] = useState<(UserProfile & { friendDocId: string })[]>([]);

  // Subscribe to incoming pending requests
  useEffect(() => {
    if (!user || !hasValidConfig) return;
    const unsub = subscribeToPendingRequests(user.uid, setIncomingRequests);
    return () => unsub();
  }, [user]);

  // Fetch sent requests and friends (re-fetch on user change)
  useEffect(() => {
    if (!user || !hasValidConfig) return;
    loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;
    const [sent, friendsList] = await Promise.all([
      getSentRequests(user.uid),
      getFriends(user.uid),
    ]);
    setSentRequests(sent);
    setFriends(friendsList);
  };

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

  const handleAccept = async (requestId: string) => {
    if (!user) return;
    const request = incomingRequests.find((r) => r.id === requestId);
    if (!request) return;
    await acceptRequest(requestId, request.senderId, user.uid);
    await loadData();
  };

  const handleReject = async (requestId: string) => {
    await rejectRequest(requestId);
  };

  const handleRemoveFriend = async (friendDocId: string) => {
    await removeFriend(friendDocId);
    setFriends((prev) => prev.filter((f) => f.friendDocId !== friendDocId));
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-lg mx-auto gap-4">
        <p className="text-foreground/60 text-lg">Please sign in to manage friends.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 max-w-3xl mx-auto w-full p-6 mt-4">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-4 mb-8"
      >
        <Link
          href="/"
          className="flex items-center gap-2 text-sm font-medium text-foreground/50 hover:text-foreground transition-colors"
        >
          <ArrowLeft size={16} />
          Home
        </Link>
        <div className="h-4 w-px bg-border"></div>
        <h1 className="text-2xl font-bold tracking-tight">Friends</h1>
      </motion.div>

      {/* Search / Send Request */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="glass neubrutal rounded-[var(--radius-xl)] p-6 mb-8"
      >
        <div className="flex items-center gap-2 mb-4">
          <UserPlus size={16} className="text-primary" />
          <h2 className="text-sm font-bold tracking-tight">Add a Friend</h2>
        </div>

        <form onSubmit={handleSendRequest} className="flex gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/40" />
            <input
              type="email"
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              placeholder="Enter friend's email address..."
              className="w-full pl-9 pr-4 py-2.5 text-sm bg-transparent border border-border/60 rounded-xl focus:outline-none focus:border-primary transition-colors placeholder:text-foreground/30"
            />
          </div>
          <button
            type="submit"
            disabled={!searchEmail.trim() || sending}
            className="bg-primary text-primary-foreground neubrutal px-5 py-2.5 rounded-xl font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors flex items-center gap-2 shrink-0"
          >
            <Send size={14} />
            {sending ? "Sending..." : "Send"}
          </button>
        </form>

        {searchError && (
          <p className="text-sm text-red-500 font-medium mt-3">{searchError}</p>
        )}
        {searchSuccess && (
          <motion.p
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-sm text-accent font-medium mt-3"
          >
            ✓ Friend request sent!
          </motion.p>
        )}
      </motion.div>

      {/* Incoming Requests */}
      {incomingRequests.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-10"
        >
          <h3 className="text-xs font-medium tracking-widest uppercase text-foreground/35 mb-4 flex items-center gap-3">
            <Inbox size={13} />
            <span>Incoming Requests</span>
            <span className="bg-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
              {incomingRequests.length}
            </span>
            <span className="flex-1 h-px bg-border/50"></span>
          </h3>
          <div className="space-y-3">
            <AnimatePresence>
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
          </div>
        </motion.section>
      )}

      {/* Sent Requests */}
      {sentRequests.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mb-10"
        >
          <h3 className="text-xs font-medium tracking-widest uppercase text-foreground/35 mb-4 flex items-center gap-3">
            <Send size={13} />
            <span>Sent Requests</span>
            <span className="text-foreground/25">{sentRequests.length}</span>
            <span className="flex-1 h-px bg-border/50"></span>
          </h3>
          <div className="space-y-3">
            <AnimatePresence>
              {sentRequests.map((req) => (
                <FriendRequestCard
                  key={req.id}
                  request={req}
                  direction="outgoing"
                />
              ))}
            </AnimatePresence>
          </div>
        </motion.section>
      )}

      {/* Friends List */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h3 className="text-xs font-medium tracking-widest uppercase text-foreground/35 mb-4 flex items-center gap-3">
          <Users size={13} />
          <span>Your Friends</span>
          <span className="text-foreground/25">{friends.length}</span>
          <span className="flex-1 h-px bg-border/50"></span>
        </h3>

        {friends.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <AnimatePresence>
              {friends.map((friend) => (
                <FriendCard
                  key={friend.uid}
                  friend={friend}
                  onRemove={handleRemoveFriend}
                />
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="py-16 text-center text-foreground/40 font-medium flex flex-col items-center gap-4">
            <div className="w-16 h-16 border-2 border-dashed border-border rounded-full flex items-center justify-center">👥</div>
            <p>No friends yet. Send a request to get started!</p>
          </div>
        )}
      </motion.section>
    </div>
  );
}
