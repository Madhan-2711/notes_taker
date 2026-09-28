"use client";

import "quill/dist/quill.snow.css";
import "quill-cursors/css";
import "./collabRichText.css";

import { useEffect, useRef } from "react";
import type * as Y from "yjs";
import type Quill from "quill";
import type QuillCursors from "quill-cursors";
import type { PresenceUser } from "../hooks/usePresence";

export const FONT_SIZES = ["12px", "14px", "16px", "24px", "32px", "48px"];

// Only these formats are accepted, including from collaborators' updates, so
// links, embeds and raw HTML can never enter the shared document.
const FORMATS = ["size", "header", "bold", "italic", "underline", "strike", "color", "background", "list", "align"];

const TOOLBAR = [
  [{ size: ["12px", "14px", "16px", false, "24px", "32px", "48px"] }],
  [{ header: [1, 2, 3, false] }],
  ["bold", "italic", "underline", "strike"],
  [{ color: [] }, { background: [] }],
  [{ list: "ordered" }, { list: "bullet" }],
  [{ align: [] }],
  ["clean"],
];

let registered = false;

interface CollabRichTextProps {
  text: Y.Text;
  editable: boolean;
  toolbarContainer: HTMLDivElement | null;
  remoteUsers: PresenceUser[];
  onCursorChange: (index: number) => void;
  onScroll: (scrollTop: number) => void;
}

export function CollabRichText({ text, editable, toolbarContainer, remoteUsers, onCursorChange, onScroll }: CollabRichTextProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const quillRef = useRef<Quill | null>(null);
  const editableRef = useRef(editable);
  const onCursorRef = useRef(onCursorChange);
  const onScrollRef = useRef(onScroll);

  useEffect(() => {
    editableRef.current = editable;
    onCursorRef.current = onCursorChange;
    onScrollRef.current = onScroll;
  });

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !toolbarContainer) return;
    let disposed = false;
    let dispose = () => {};

    void (async () => {
      const [{ default: QuillClass }, { QuillBinding }, { default: Cursors }] = await Promise.all([
        import("quill"),
        import("y-quill"),
        import("quill-cursors/core"),
      ]);
      if (disposed) return;

      if (!registered) {
        const sizeStyle = QuillClass.import("attributors/style/size") as { whitelist: string[] };
        sizeStyle.whitelist = FONT_SIZES;
        QuillClass.register(sizeStyle as never, true);
        QuillClass.register("modules/cursors", Cursors);
        registered = true;
      }

      const mount = document.createElement("div");
      host.appendChild(mount);
      const quill = new QuillClass(mount, {
        theme: "snow",
        formats: FORMATS,
        placeholder: "Start collaborating...",
        modules: {
          toolbar: TOOLBAR,
          cursors: { transformOnTextChange: true, hideDelayMs: 1500 },
          history: { userOnly: true },
        },
      });
      const toolbar = (quill.getModule("toolbar") as { container: HTMLElement }).container;
      toolbar.setAttribute("aria-label", "Text formatting");
      toolbarContainer.appendChild(toolbar);

      const binding = new QuillBinding(text, quill);
      quill.enable(editableRef.current);

      const onSelection = (range: { index: number; length: number } | null) => {
        if (range) onCursorRef.current(range.index + range.length);
      };
      const onScrollEvent = () => onScrollRef.current(quill.root.scrollTop);
      quill.on("selection-change", onSelection);
      quill.root.addEventListener("scroll", onScrollEvent);
      quillRef.current = quill;

      dispose = () => {
        quill.off("selection-change", onSelection);
        quill.root.removeEventListener("scroll", onScrollEvent);
        binding.destroy();
        toolbar.remove();
        host.replaceChildren();
        quillRef.current = null;
      };
    })();

    return () => {
      disposed = true;
      dispose();
    };
  }, [text, toolbarContainer]);

  useEffect(() => {
    quillRef.current?.enable(editable);
  }, [editable]);

  useEffect(() => {
    const quill = quillRef.current;
    if (!quill) return;
    const cursors = quill.getModule("cursors") as QuillCursors;
    const visible = new Set<string>();
    const maxIndex = Math.max(0, quill.getLength() - 1);
    for (const user of remoteUsers) {
      if (user.cursorPosition == null) continue;
      visible.add(user.uid);
      cursors.createCursor(user.uid, user.displayName.split(" ")[0] || "Collaborator", user.cursorColor);
      cursors.moveCursor(user.uid, { index: Math.min(user.cursorPosition, maxIndex), length: 0 });
    }
    for (const cursor of cursors.cursors()) {
      if (!visible.has(cursor.id)) cursors.removeCursor(cursor.id);
    }
  }, [remoteUsers]);

  return <div ref={hostRef} className="collab-rich absolute inset-0" />;
}
