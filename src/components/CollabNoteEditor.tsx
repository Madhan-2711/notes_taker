"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import * as Y from "yjs";
import { useCollabEditor } from "../hooks/useCollabEditor";
import { usePresence } from "../hooks/usePresence";
import { PresenceIndicator } from "./PresenceIndicator";
import { RemoteCursors } from "./RemoteCursors";
import { motion } from "framer-motion";
import { Loader2, Wifi, WifiOff, Share2, ArrowLeft, Save } from "lucide-react";
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
  const { text, title, isLoading, isSynced, error, saveSnapshot } = useCollabEditor(
    noteId,
    userId,
    privateKey
  );

  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isLocalChangeRef = useRef(false);

  // Presence tracking with cursor
  const { activeUsers, updateCursor } = usePresence(noteId, userId, displayName, photoURL);

  // Sync Yjs text to local state, with cursor-aware remote update handling
  useEffect(() => {
    if (!text) return;

    // Set initial content
    setContent(text.toString());

    // Observe Yjs changes with delta-aware cursor adjustment
    const observer = (event: Y.YTextEvent) => {
      if (isLocalChangeRef.current) {
        // Local change — cursor is already correct, just reset the flag
        isLocalChangeRef.current = false;
        return;
      }

      // Remote change — adjust cursor position using Yjs delta
      const textarea = textareaRef.current;
      const prevCursor = textarea?.selectionStart ?? 0;
      const prevSelEnd = textarea?.selectionEnd ?? prevCursor;

      // Walk the delta to compute how much the cursor should shift.
      let adjustedCursor = prevCursor;
      let adjustedSelEnd = prevSelEnd;
      let pos = 0;

      for (const op of event.delta) {
        if (op.retain != null) {
          pos += op.retain;
        } else if (op.insert != null) {
          const insertLen = typeof op.insert === "string" ? op.insert.length : 1;
          if (pos <= prevCursor) {
            adjustedCursor += insertLen;
          }
          if (pos <= prevSelEnd) {
            adjustedSelEnd += insertLen;
          }
          pos += insertLen;
        } else if (op.delete != null) {
          if (pos < prevCursor) {
            const shift = Math.min(op.delete, prevCursor - pos);
            adjustedCursor -= shift;
          }
          if (pos < prevSelEnd) {
            const shift = Math.min(op.delete, prevSelEnd - pos);
            adjustedSelEnd -= shift;
          }
        }
      }

      const newContent = text.toString();
      setContent(newContent);

      // Restore cursor after React re-renders
      requestAnimationFrame(() => {
        if (textarea) {
          const clamp = (v: number) => Math.max(0, Math.min(v, textarea.value.length));
          textarea.selectionStart = clamp(adjustedCursor);
          textarea.selectionEnd = clamp(adjustedSelEnd);
        }
      });
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
        // Insertion
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
        // Replacement (same length)
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

      // Publish cursor position
      updateCursor(e.target.selectionEnd);
    },
    [text, updateCursor]
  );

  // Track cursor movement (click, arrow keys)
  const handleCursorChange = useCallback(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      updateCursor(textarea.selectionStart);
    }
  }, [updateCursor]);

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
    <div className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 sm:mt-4">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-6"
      >
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <Link
            href="/notes"
            className="flex items-center gap-2 text-sm font-medium text-foreground/50 hover:text-foreground transition-colors shrink-0"
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">Notes</span>
          </Link>
          <div className="h-4 w-px bg-border shrink-0"></div>
          <h1 className="text-lg sm:text-xl font-bold tracking-tight truncate">{title}</h1>
          <PresenceIndicator users={activeUsers} />
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Sync indicator */}
          <div className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs font-semibold ${
            isSynced
              ? "text-emerald-600 bg-emerald-50 border border-emerald-200"
              : "text-amber-600 bg-amber-50 border border-amber-200"
          }`}>
            {isSynced ? <Wifi size={12} /> : <Loader2 size={12} className="animate-spin" />}
            {isSynced ? "Synced" : "Syncing..."}
          </div>

          {/* Save button */}
          <button
            onClick={async () => {
              setSaving(true);
              try { await saveSnapshot(); } finally { setSaving(false); }
            }}
            disabled={saving}
            className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-xl text-sm font-bold text-primary border-2 border-primary/30 hover:bg-primary/5 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            <span className="hidden sm:inline">{saving ? "Saving..." : "Save"}</span>
          </button>

          {/* Share button */}
          {onShare && (
            <button
              onClick={onShare}
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-xl text-sm font-bold text-emerald-600 border-2 border-emerald-200 hover:bg-emerald-50 transition-colors"
            >
              <Share2 size={14} />
              <span className="hidden sm:inline">Share</span>
            </button>
          )}
        </div>
      </motion.div>

      {/* Editor with remote cursors */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass neubrutal rounded-[var(--radius-xl)] p-4 sm:p-8 relative"
      >
        {/* Remote cursor indicators */}
        <RemoteCursors
          users={activeUsers}
          content={content}
        />

        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleChange}
          onSelect={handleCursorChange}
          onKeyUp={handleCursorChange}
          onClick={handleCursorChange}
          placeholder="Start collaborating..."
          className="w-full bg-transparent min-h-[50vh] sm:min-h-[400px] resize-none focus:outline-none placeholder:text-foreground/25 leading-relaxed text-foreground/85 text-base sm:text-lg"
        />
      </motion.div>
    </div>
  );
}
