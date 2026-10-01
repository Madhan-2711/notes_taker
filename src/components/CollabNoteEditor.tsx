"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import * as Y from "yjs";
import { useCollabEditor } from "../hooks/useCollabEditor";
import { usePresence } from "../hooks/usePresence";
import { PresenceIndicator } from "./PresenceIndicator";
import { motion } from "framer-motion";
import { Loader2, Wifi, WifiOff, Share2, ArrowLeft, Save, Maximize2, Minimize2, PanelRight, X } from "lucide-react";
import { Dialog, useDialogTitleId } from "./ui/Dialog";
import Link from "next/link";
import { NoteExport } from "./NoteExport";
import { NoteAttachments } from "./NoteAttachments";
import { NoteComments } from "./NoteComments";
import { CollabHistory } from "./CollabHistory";
import { NoteOrganizer } from "./NoteOrganizer";
import type { Attachment } from "../lib/services/attachments";
import { CollabRichText } from "./CollabRichText";
import { FloatingImageLayer } from "./FloatingImageLayer";
import { DEFAULT_IMAGE_WIDTH, clampImage, isValidFloatingImage, migrateLegacyImageTokens, type FloatingImage } from "../lib/floatingImages";
import { sanitizeDelta, type RichDelta, type RichOp } from "../lib/richText";
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

/** Shared text followed by the board's pictures, top to bottom, for exports. */
function collabExportDelta(text: Y.Text, images: Y.Map<FloatingImage> | null): RichDelta {
  const placed: FloatingImage[] = [];
  images?.forEach((image) => { if (isValidFloatingImage(image)) placed.push(image); });
  const pictures: RichOp[] = placed
    .sort((a, b) => a.y - b.y)
    .map((image) => ({ insert: { noteImage: { id: image.id, alt: image.alt } } }));
  return sanitizeDelta({ ops: [...(text.toDelta() as RichOp[]), ...pictures] });
}

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
    images,
    title,
    isLoading,
    isSynced,
    error,
    canEdit,
    canCompact,
    saveSnapshot,
  } = useCollabEditor(noteId, userId, privateKey);

  const [saving, setSaving] = useState(false);
  const [checkpointError, setCheckpointError] = useState("");
  const [toolbarContainer, setToolbarContainer] = useState<HTMLDivElement | null>(null);

  // Drawing layer state: which tool is active and its color/size.
  const [tool, setTool] = useState<DrawTool>("text");
  const [color, setColor] = useState<string>(DEFAULT_COLORS[0]);
  const [size, setSize] = useState<number>(PEN_PRESETS.pen.defaultSize);

  // The board is a fixed logical size scaled to fit the viewport, so text wraps
  // identically and ink lands in the same place for every collaborator.
  const [scale, setScale] = useState(1);
  const [fitBoard, setFitBoard] = useState(false);
  const [editorScrollTop, setEditorScrollTop] = useState(0);
  const [drawingLimitReached, setDrawingLimitReached] = useState(false);
  const boardWrapRef = useRef<HTMLDivElement>(null);

  // Undo/redo scoped to this user's own strokes.
  const undoManagerRef = useRef<Y.UndoManager | null>(null);

  // Plain-text copy of the shared text for export.
  const [plainText, setPlainText] = useState("");

  // Presence tracking with cursor
  const { activeUsers, updateCursor } = usePresence(noteId, userId, displayName, photoURL);

  useEffect(() => {
    if (!text) return;
    const sync = () => setPlainText(text.toString());
    const timer = setTimeout(sync, 0);
    text.observe(sync);
    return () => {
      clearTimeout(timer);
      text.unobserve(sync);
    };
  }, [text]);

  // Older versions stored pictures as tokens inside the text; move them onto the board.
  useEffect(() => {
    if (!text || !images || !canEdit) return;
    migrateLegacyImageTokens(text, images, userId);
    const onRemote = (_event: Y.YTextEvent, transaction: Y.Transaction) => {
      if (transaction.local) return;
      if (text.toString().includes("(attachment:")) migrateLegacyImageTokens(text, images, userId);
    };
    text.observe(onRemote);
    return () => text.unobserve(onRemote);
  }, [text, images, canEdit, userId]);

  const insertImage = useCallback((file: Attachment) => {
    const id = file.path.split("/").pop();
    if (!images || !canEdit || !id || !/^[a-zA-Z0-9]{1,80}$/.test(id)) return;
    const width = Math.min(DEFAULT_IMAGE_WIDTH, BOARD_WIDTH - 80);
    images.set(id, clampImage({
      id,
      alt: file.name.replace(/[\[\]\n]/g, " ").slice(0, 120),
      x: (BOARD_WIDTH - width) / 2,
      y: editorScrollTop + 120,
      width,
      authorId: userId,
      createdAt: Date.now(),
    }));
    setTool("move");
  }, [images, canEdit, userId, editorScrollTop]);

  const [fullscreen, setFullscreen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const detailsTitleId = useDialogTitleId();

  const exitFullscreen = useCallback(() => {
    setFullscreen(false);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  }, []);

  const enterFullscreen = useCallback(() => {
    setFullscreen(true);
    // Browser full screen also hides the tabs and address bar where supported;
    // the fixed overlay alone covers browsers that refuse it.
    void document.documentElement.requestFullscreen?.().catch(() => {});
  }, []);

  useEffect(() => {
    if (!fullscreen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.querySelector(".ql-expanded")) exitFullscreen();
    };
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) setFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, [fullscreen, exitFullscreen]);

  // Fit the fixed-size board into the available width. Re-runs once the board
  // mounts (after loading), so the ref is attached before we measure.
  useEffect(() => {
    const el = boardWrapRef.current;
    if (!el) return;
    const measure = () => setScale(
      fullscreen ? Math.min(2, el.clientWidth / BOARD_WIDTH)
        : window.innerWidth < 700 && !fitBoard ? 1 : Math.min(1, el.clientWidth / BOARD_WIDTH)
    );
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [isLoading, error, fitBoard, fullscreen]);

  // Set up an undo manager on the drawing layer once it is available. Default
  // tracked origins mean each user only undoes their own strokes, and undo
  // results still publish to everyone through the normal update pipeline.
  useEffect(() => {
    if (!strokes) return;
    const um = new Y.UndoManager(images ? [strokes, images] : [strokes], { captureTimeout: 250 });
    undoManagerRef.current = um;
    return () => {
      um.destroy();
      undoManagerRef.current = null;
    };
  }, [strokes, images]);

  const selectTool = useCallback((next: DrawTool) => {
    setTool(next);
    setDrawingLimitReached(false);
    if (isPenTool(next)) setSize(PEN_PRESETS[next].defaultSize);
  }, []);

  const undo = useCallback(() => undoManagerRef.current?.undo(), []);
  const redo = useCallback(() => undoManagerRef.current?.redo(), []);

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8" aria-busy="true" aria-label="Loading shared note">
        <div className="mb-6 h-9 w-64 animate-pulse rounded-xl bg-slate-200" />
        <div className="mb-3 h-12 animate-pulse rounded-2xl bg-slate-200" />
        <div className="h-[60dvh] animate-pulse rounded-card border border-slate-200 bg-white" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50">
          <WifiOff size={26} className="text-red-700" aria-hidden="true" />
        </div>
        <p className="text-lg font-semibold text-slate-900">Couldn&apos;t open this shared note</p>
        <p className="max-w-sm text-sm text-slate-600">{error}</p>
        <Link href="/notes" className="btn-secondary">
          <ArrowLeft size={15} aria-hidden="true" /> Back to notes
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      {/* Header: the board follows directly; secondary tools live in the details sheet. */}
      <div className="mb-5 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <Link href="/notes" className="-ml-2 mb-1 inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900">
            <ArrowLeft size={16} aria-hidden="true" /> Notes
          </Link>
          <div className="flex min-w-0 items-center gap-3">
            <h1 className="truncate text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
            <PresenceIndicator users={activeUsers} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Sync indicator */}
          <span role="status" className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-xs font-semibold ${
            isSynced ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-300 bg-amber-50 text-amber-900"
          }`}>
            {isSynced ? <Wifi size={13} aria-hidden="true" /> : <Loader2 size={13} className="animate-spin" aria-hidden="true" />}
            {isSynced ? "Synced" : "Syncing…"}
          </span>

          {/* Only the owner creates checkpoints and prunes represented updates. */}
          {canCompact && (
            <button
              type="button"
              onClick={async () => {
                setSaving(true);
                setCheckpointError("");
                try { await saveSnapshot(); }
                catch { setCheckpointError("Could not save a checkpoint. Your recent edits will keep retrying to sync."); }
                finally { setSaving(false); }
              }}
              disabled={saving}
              aria-label={saving ? "Saving checkpoint" : "Save checkpoint"}
              className="btn-secondary px-3"
            >
              {saving ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Save size={15} aria-hidden="true" />}
              <span className="hidden lg:inline">{saving ? "Saving…" : "Checkpoint"}</span>
            </button>
          )}

          <button type="button" onClick={enterFullscreen} aria-label="Full screen" title="Full screen" className="btn-secondary px-3">
            <Maximize2 size={15} aria-hidden="true" />
            <span className="hidden lg:inline">Full screen</span>
          </button>

          <button type="button" onClick={() => setDetailsOpen(true)} aria-haspopup="dialog" className="btn-secondary px-3" aria-label="Comments and files">
            <PanelRight size={15} aria-hidden="true" />
            <span className="hidden sm:inline">Comments &amp; files</span>
          </button>

          {/* Share button */}
          {onShare && (
            <button type="button" onClick={onShare} className="btn-primary">
              <Share2 size={15} aria-hidden="true" />
              Share
            </button>
          )}
        </div>
      </div>
      {checkpointError && <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{checkpointError}</p>}

      <Dialog open={detailsOpen} onClose={() => setDetailsOpen(false)} labelledBy={detailsTitleId} size="lg" sheetOnMobile>
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-5 py-3 sm:px-6">
          <h2 id={detailsTitleId} className="text-lg font-bold tracking-tight">Comments and files</h2>
          <button type="button" onClick={() => setDetailsOpen(false)} className="icon-btn -mr-2" aria-label="Close">
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-5 sm:px-6">
          <NoteComments noteId={noteId} userId={userId} userName={displayName} privateKey={privateKey} />
          <section aria-labelledby="collab-organise">
            <h3 id="collab-organise" className="mb-3 text-base font-bold">Organise</h3>
            <NoteOrganizer noteId={noteId} />
          </section>
          {privateKey && <NoteAttachments key={`${userId}:${noteId}`} noteId={noteId} userId={userId} privateKey={privateKey} onInsertImage={canEdit ? (file) => { insertImage(file); setDetailsOpen(false); } : undefined} onInsertText={canEdit && text ? (spoken) => text.insert(text.length, `\n${spoken}`) : undefined} />}
          <section aria-labelledby="collab-export">
            <h3 id="collab-export" className="mb-3 text-base font-bold">Export</h3>
            <NoteExport title={title} content={plainText} delta={text ? collabExportDelta(text, images) : null} images={{ noteId, userId, privateKey }} encrypted />
          </section>
          {canCompact && <CollabHistory noteId={noteId} userId={userId} privateKey={privateKey} />}
        </div>
      </Dialog>

      <div
        className={fullscreen ? "fixed inset-0 z-[60] overflow-y-auto px-3 py-3 sm:px-6" : ""}
        style={fullscreen ? { background: "var(--background)" } : undefined}
        role={fullscreen ? "dialog" : undefined}
        aria-modal={fullscreen || undefined}
        aria-label={fullscreen ? `${title} in full screen` : undefined}
      >
      {fullscreen && (
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="min-w-0 truncate text-lg font-bold tracking-tight">{title}</h2>
          <button
            type="button"
            onClick={exitFullscreen}
            className="flex shrink-0 items-center gap-2 rounded-xl border-2 border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-indigo-600"
          >
            <Minimize2 size={14} /> Exit full screen <kbd className="hidden rounded border border-slate-300 px-1.5 text-xs font-medium text-slate-500 sm:inline">Esc</kbd>
          </button>
        </div>
      )}

      {/* Formatting sits above later siblings so its dropdowns aren't painted under them. */}
      <div
        ref={setToolbarContainer}
        className={`collab-toolbar glass neubrutal relative z-30 mb-3 rounded-2xl p-1.5 sm:p-2 ${canEdit && tool === "text" ? "" : "hidden"}`}
      />
      {/* Tool switch: routes the next pointer drag to text or ink. Both layers
          stay live at all times. */}
      {canEdit && (
        <div className="relative z-20 mb-4 flex justify-center">
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

      <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 sm:hidden">
        <span>{fitBoard ? "Whole page view" : "Full-size board. Swipe sideways to see more."}</span>
        <button type="button" onClick={() => setFitBoard((value) => !value)} className="min-h-11 shrink-0 rounded-lg border border-indigo-300 px-3 font-semibold text-indigo-700 focus-visible:outline-2 focus-visible:outline-indigo-600">{fitBoard ? "Full size" : "Fit page"}</button>
      </div>

      {/* Fixed-size workspace: the text editor with the drawing canvas layered
          on top at the same coordinates. The whole board scales to fit. */}
      <motion.div
        ref={boardWrapRef}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="flex w-full justify-start overflow-x-auto overscroll-x-contain pb-8 xl:justify-center"
      >
        <div
          style={{ width: BOARD_WIDTH * scale, height: BOARD_HEIGHT * scale }}
          className="relative"
        >
          <div
            className="glass neubrutal absolute left-0 top-0 overflow-hidden rounded-card"
            style={{
              width: BOARD_WIDTH,
              height: BOARD_HEIGHT,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
          >
            {/* Pictures sit under the text and ink so both can go on top of them. */}
            <FloatingImageLayer
              images={images}
              noteId={noteId}
              userId={userId}
              privateKey={privateKey}
              movable={canEdit && tool === "move"}
              scrollTop={editorScrollTop}
            />

            <div className={tool === "text" ? "" : "pointer-events-none"}>
              {text && (
                <CollabRichText
                  text={text}
                  editable={canEdit && tool === "text"}
                  toolbarContainer={toolbarContainer}
                  remoteUsers={activeUsers}
                  onCursorChange={updateCursor}
                  onScroll={setEditorScrollTop}
                />
              )}
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
      </div>

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
