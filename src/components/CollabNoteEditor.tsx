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
import {
  computeTextDelta,
  transformSelectionForRemoteDelta,
} from "../lib/textDelta";
import { DrawingCanvas } from "./DrawingCanvas";
import { DrawingToolbar } from "./DrawingToolbar";
import {
  BOARD_WIDTH,
  BOARD_HEIGHT,
  DEFAULT_COLORS,
  PEN_PRESETS,
  isPenTool,
  type DrawTool,
} from "../lib/drawing";

interface CollabNoteEditorProps {
  noteId: string;
  userId: string;
  privateKey: CryptoKey | null;
  onShare?: () => void;
  displayName?: string;
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
  const {
    text,
    strokes,
    title,
    isLoading,
    isSynced,
    error,
    canEdit,
    canCompact,
    saveSnapshot,
  } = useCollabEditor(noteId, userId, privateKey);

  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isLocalChangeRef = useRef(false);

  // Drawing layer state: which tool is active and its color/size.
  const [tool, setTool] = useState<DrawTool>("text");
  const [color, setColor] = useState<string>(DEFAULT_COLORS[0]);
  const [size, setSize] = useState<number>(PEN_PRESETS.pen.defaultSize);

  // The board is a fixed logical size scaled to fit the viewport, so text wraps
  // identically and ink lands in the same place for every collaborator.
  const [scale, setScale] = useState(1);
  const [editorScrollTop, setEditorScrollTop] = useState(0);
  const [drawingLimitReached, setDrawingLimitReached] = useState(false);
  const boardWrapRef = useRef<HTMLDivElement>(null);

  // Undo/redo scoped to this user's own strokes.
  const undoManagerRef = useRef<Y.UndoManager | null>(null);

  // Track content in a ref to avoid React re-render on remote updates
  const contentRef = useRef("");
  const [cursorContent, setCursorContent] = useState("");

  // Presence tracking with cursor
  const { activeUsers, updateCursor } = usePresence(noteId, userId, displayName, photoURL);

  // Sync Yjs text to textarea — bypass React state to avoid cursor jumping
  useEffect(() => {
    if (!text) return;

    // Set initial content
    const initial = text.toString();
    contentRef.current = initial;
    const initialContentTimer = setTimeout(() => setCursorContent(initial), 0);
    if (textareaRef.current) {
      textareaRef.current.value = initial;
    }

    const observer = (event: Y.YTextEvent) => {
      if (isLocalChangeRef.current) {
        isLocalChangeRef.current = false;
        return;
      }

      // Remote change — update textarea directly (no React setState)
      const textarea = textareaRef.current;
      if (!textarea) return;

      const prevCursor = textarea.selectionStart;
      const prevSelEnd = textarea.selectionEnd;
      const selectionDirection = textarea.selectionDirection;
      const adjustedSelection = transformSelectionForRemoteDelta(
        prevCursor,
        prevSelEnd,
        event.delta
      );

      // Directly set textarea value (bypass React render cycle)
      const newContent = text.toString();
      contentRef.current = newContent;
      setCursorContent(newContent);
      textarea.value = newContent;

      // Immediately restore cursor — no requestAnimationFrame needed
      const clamp = (v: number) => Math.max(0, Math.min(v, textarea.value.length));
      const adjustedCursor = clamp(adjustedSelection.start);
      const adjustedSelEnd = clamp(adjustedSelection.end);
      textarea.setSelectionRange(
        adjustedCursor,
        adjustedSelEnd,
        selectionDirection
      );
      updateCursor(adjustedSelEnd);
    };

    text.observe(observer);
    return () => {
      clearTimeout(initialContentTimer);
      text.unobserve(observer);
    };
  }, [text, updateCursor]);

  // Handle local text changes
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (!text) return;

      const newValue = e.target.value;
      const oldValue = contentRef.current;
      isLocalChangeRef.current = true;

      const delta = computeTextDelta(oldValue, newValue);

      text.doc?.transact(() => {
        if (delta.deleteCount > 0) text.delete(delta.start, delta.deleteCount);
        if (delta.insertText) text.insert(delta.start, delta.insertText);
      });

      contentRef.current = newValue;
      setCursorContent(newValue);

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

  // Fit the fixed-size board into the available width. Re-runs once the board
  // mounts (after loading), so the ref is attached before we measure.
  useEffect(() => {
    const el = boardWrapRef.current;
    if (!el) return;
    const measure = () => setScale(Math.min(1, el.clientWidth / BOARD_WIDTH));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isLoading, error]);

  // Set up an undo manager on the drawing layer once it is available. Default
  // tracked origins mean each user only undoes their own strokes, and undo
  // results still publish to everyone through the normal update pipeline.
  useEffect(() => {
    if (!strokes) return;
    const um = new Y.UndoManager(strokes, { captureTimeout: 250 });
    undoManagerRef.current = um;
    return () => {
      um.destroy();
      undoManagerRef.current = null;
    };
  }, [strokes]);

  const selectTool = useCallback((next: DrawTool) => {
    setTool(next);
    setDrawingLimitReached(false);
    if (isPenTool(next)) setSize(PEN_PRESETS[next].defaultSize);
  }, []);

  const undo = useCallback(() => undoManagerRef.current?.undo(), []);
  const redo = useCallback(() => undoManagerRef.current?.redo(), []);

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
    <div className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 sm:mt-4">
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

          {/* Only the owner creates checkpoints and prunes represented updates. */}
          {canCompact && (
            <button
              onClick={async () => {
                setSaving(true);
                try { await saveSnapshot(); } finally { setSaving(false); }
              }}
              disabled={saving}
              className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-xl text-sm font-bold text-primary border-2 border-primary/30 hover:bg-primary/5 transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              <span className="hidden sm:inline">{saving ? "Saving..." : "Checkpoint"}</span>
            </button>
          )}

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

      {/* Tool switch: routes the next pointer drag to text or ink. Both layers
          stay live at all times. */}
      {canEdit && (
        <div className="mb-4 flex justify-center">
          <DrawingToolbar
            tool={tool}
            onToolChange={selectTool}
            color={color}
            onColorChange={setColor}
            size={size}
            onSizeChange={setSize}
            onUndo={undo}
            onRedo={redo}
          />
        </div>
      )}

      {/* Fixed-size workspace: the text editor with the drawing canvas layered
          on top at the same coordinates. The whole board scales to fit. */}
      <motion.div
        ref={boardWrapRef}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="flex w-full justify-center pb-8"
      >
        <div
          style={{ width: BOARD_WIDTH * scale, height: BOARD_HEIGHT * scale }}
          className="relative"
        >
          <div
            className="glass neubrutal absolute left-0 top-0 overflow-hidden rounded-[var(--radius-xl)]"
            style={{
              width: BOARD_WIDTH,
              height: BOARD_HEIGHT,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
          >
            <textarea
              ref={textareaRef}
              defaultValue=""
              onChange={handleChange}
              onSelect={handleCursorChange}
              onKeyUp={handleCursorChange}
              onClick={handleCursorChange}
              onScroll={(event) => setEditorScrollTop(event.currentTarget.scrollTop)}
              placeholder="Start collaborating..."
              readOnly={!canEdit || tool !== "text"}
              className="absolute inset-0 h-full w-full resize-none bg-transparent p-10 leading-relaxed text-foreground/85 placeholder:text-foreground/25 focus:outline-none"
              style={{ fontSize: "18px", lineHeight: "1.9em" }}
            />

            {/* Remote text cursors (pointer-events off so they never block input) */}
            <div className="pointer-events-none absolute inset-0">
              <RemoteCursors
                users={activeUsers}
                content={cursorContent}
                textareaRef={textareaRef}
              />
            </div>

            {/* Ink layer on top; captures pointer only when a draw tool is on. */}
            <DrawingCanvas
              strokes={strokes}
              canEdit={canEdit}
              tool={tool}
              color={color}
              size={size}
              authorId={userId}
              scrollTop={editorScrollTop}
              onLimitReached={() => setDrawingLimitReached(true)}
            />
          </div>
        </div>
      </motion.div>

      {!canEdit && (
        <p className="text-center text-xs font-medium text-foreground/45">
          View-only access
        </p>
      )}
      {drawingLimitReached && (
        <p className="text-center text-xs font-medium text-amber-600">
          Drawing limit reached. Erase some strokes before adding more.
        </p>
      )}
    </div>
  );
}
