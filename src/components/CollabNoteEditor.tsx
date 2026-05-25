"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useCollabEditor } from "../hooks/useCollabEditor";
import { usePresence } from "../hooks/usePresence";
import { PresenceIndicator } from "./PresenceIndicator";
import { motion } from "framer-motion";
import { Loader2, Wifi, WifiOff, Share2, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface CollabNoteEditorProps {
  noteId: string;
  userId: string;
  privateKey: CryptoKey | null;
  onShare?: () => void;
  /** Display name for presence */
  displayName?: string;
  /** Photo URL for presence */
  photoURL?: string | null;
}

export function CollabNoteEditor({
  noteId,
  userId,
  privateKey,
  onShare,
  displayName = "Anonymous",
  photoURL = null,
}: CollabNoteEditorProps) {
  const { text, title, isLoading, isSynced, error } = useCollabEditor(
    noteId,
    userId,
    privateKey
  );

  const [content, setContent] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isLocalChangeRef = useRef(false);

  // Presence tracking
  const activeUsers = usePresence(noteId, userId, displayName, photoURL);

  // Sync Yjs text to local state
  useEffect(() => {
    if (!text) return;

    // Set initial content
    setContent(text.toString());

    // Observe Yjs changes
    const observer = () => {
      if (!isLocalChangeRef.current) {
        setContent(text.toString());
      }
      isLocalChangeRef.current = false;
    };

    text.observe(observer);
    return () => text.unobserve(observer);
  }, [text]);

  // Handle local text changes
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (!text) return;

      const newValue = e.target.value;
      isLocalChangeRef.current = true;

      // Calculate the diff and apply to Yjs
      const oldValue = text.toString();

      if (newValue.length > oldValue.length) {
        // Insertion — find where the new content starts
        const selEnd = e.target.selectionEnd;
        const insertPos = selEnd - (newValue.length - oldValue.length);
        const insertText = newValue.slice(insertPos, selEnd);
        text.insert(insertPos, insertText);
      } else if (newValue.length < oldValue.length) {
        // Deletion
        const selStart = e.target.selectionStart;
        const deleteCount = oldValue.length - newValue.length;
        text.delete(selStart, deleteCount);
      } else {
        // Replacement (same length) — delete old, insert new
        const selStart = e.target.selectionStart;
        // Find first differing character
        let start = 0;
        while (start < oldValue.length && oldValue[start] === newValue[start]) {
          start++;
        }
        let endOld = oldValue.length - 1;
        let endNew = newValue.length - 1;
        while (endOld > start && endNew > start && oldValue[endOld] === newValue[endNew]) {
          endOld--;
          endNew--;
        }
        if (endOld >= start) {
          text.delete(start, endOld - start + 1);
          text.insert(start, newValue.slice(start, endNew + 1));
        }
      }

      setContent(newValue);
    },
    [text]
  );

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8">
        <Loader2 size={28} className="text-emerald-500 animate-spin" />
        <p className="text-sm text-foreground/50 font-medium">Loading collaborative note...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
        <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center">
          <WifiOff size={28} className="text-red-500" />
        </div>
        <p className="text-lg font-semibold text-foreground/80">Connection Error</p>
        <p className="text-sm text-foreground/45 max-w-sm text-center">{error}</p>
        <Link
          href="/notes"
          className="text-sm font-medium text-primary hover:underline flex items-center gap-1"
        >
          <ArrowLeft size={14} /> Back to notes
        </Link>
      </div>
    );
  }

  return (
    <div className="flex-1 max-w-3xl mx-auto w-full p-6 mt-4">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between gap-4 mb-6"
      >
        <div className="flex items-center gap-4">
          <Link
            href="/notes"
            className="flex items-center gap-2 text-sm font-medium text-foreground/50 hover:text-foreground transition-colors"
          >
            <ArrowLeft size={16} />
            Notes
          </Link>
          <div className="h-4 w-px bg-border"></div>
          <h1 className="text-xl font-bold tracking-tight truncate">{title}</h1>
          <PresenceIndicator users={activeUsers} />
        </div>

        <div className="flex items-center gap-3 shrink-0">
          {/* Sync indicator */}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
            isSynced
              ? "text-emerald-600 bg-emerald-50 border border-emerald-200"
              : "text-amber-600 bg-amber-50 border border-amber-200"
          }`}>
            {isSynced ? <Wifi size={12} /> : <Loader2 size={12} className="animate-spin" />}
            {isSynced ? "Synced" : "Syncing..."}
          </div>

          {/* Share button */}
          {onShare && (
            <button
              onClick={onShare}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-emerald-600 border-2 border-emerald-200 hover:bg-emerald-50 transition-colors"
            >
              <Share2 size={14} />
              Share
            </button>
          )}
        </div>
      </motion.div>

      {/* Editor */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass neubrutal rounded-[var(--radius-xl)] p-8"
      >
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          placeholder="Start collaborating..."
          className="w-full bg-transparent min-h-[400px] resize-none focus:outline-none placeholder:text-foreground/25 leading-relaxed text-foreground/85 text-lg"
        />
      </motion.div>
    </div>
  );
}
