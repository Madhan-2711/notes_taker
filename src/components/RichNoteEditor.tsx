"use client";

import "quill/dist/quill.snow.css";
import "./collabRichText.css";

import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import type Quill from "quill";
import { loadQuill, RICH_FORMATS, RICH_TOOLBAR } from "../lib/quillSetup";
import { plainFromDelta, sanitizeDelta, type NoteImageValue, type RichDelta } from "../lib/richText";
import { loadAttachmentImage } from "../lib/services/attachments";

export interface RichNoteEditorHandle {
  insertImage: (image: NoteImageValue) => void;
  insertText: (text: string) => void;
}

export interface NoteImageContext {
  noteId: string;
  userId: string;
  privateKey: CryptoKey | null;
}

interface RichNoteEditorProps {
  /** Read once on mount; give the component a new `key` to load different content. */
  initial: RichDelta;
  readOnly?: boolean;
  images?: NoteImageContext | null;
  placeholder?: string;
  label?: string;
  onChange?: (delta: RichDelta, plain: string) => void;
  handleRef?: Ref<RichNoteEditorHandle>;
}

export function RichNoteEditor({ initial, readOnly = false, images = null, placeholder, label, onChange, handleRef }: RichNoteEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const quillRef = useRef<Quill | null>(null);
  const initialRef = useRef(initial);
  const onChangeRef = useRef(onChange);
  const imagesRef = useRef(images);
  const urlCache = useRef(new Map<string, Promise<string>>());

  useEffect(() => {
    onChangeRef.current = onChange;
    imagesRef.current = images;
  });

  useImperativeHandle(handleRef, () => ({
    insertImage(image) {
      const quill = quillRef.current;
      if (!quill) return;
      const range = quill.getSelection(true);
      const index = range ? range.index : quill.getLength() - 1;
      quill.insertEmbed(index, "noteImage", image, "user");
      quill.setSelection(index + 1, 0, "silent");
    },
    insertText(text) {
      const quill = quillRef.current;
      if (!quill || !text) return;
      const range = quill.getSelection(true);
      const index = range ? range.index : quill.getLength() - 1;
      quill.insertText(index, text, "user");
      quill.setSelection(index + text.length, 0, "silent");
    },
  }), []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let disposed = false;
    let dispose = () => {};
    const cache = urlCache.current;

    const resolveImages = () => {
      const root = quillRef.current?.root;
      if (!root) return;
      root.querySelectorAll<HTMLElement>("figure.ql-note-image").forEach((figure) => {
        const img = figure.querySelector("img");
        const id = figure.dataset.id;
        if (!img || !id || figure.dataset.state) return;
        const context = imagesRef.current;
        if (!context) {
          figure.dataset.state = "pending";
          return;
        }
        figure.dataset.state = "loading";
        let request = cache.get(id);
        if (!request) {
          request = loadAttachmentImage(context.noteId, context.userId, context.privateKey, id, figure.dataset.alt ?? "")
            .then((blob) => URL.createObjectURL(blob));
          cache.set(id, request);
        }
        request
          .then((url) => { img.src = url; figure.dataset.state = "ready"; })
          .catch(() => { figure.dataset.state = "error"; });
      });
    };

    void loadQuill().then((QuillClass) => {
      if (disposed) return;
      const mount = document.createElement("div");
      host.appendChild(mount);
      const quill = new QuillClass(mount, {
        theme: "snow",
        readOnly,
        placeholder,
        formats: [...RICH_FORMATS, "noteImage"],
        modules: {
          toolbar: readOnly ? false : RICH_TOOLBAR,
          history: { userOnly: true },
        },
      });
      if (!readOnly) {
        const toolbar = quill.getModule("toolbar") as { container: HTMLElement } | undefined;
        toolbar?.container.setAttribute("aria-label", "Text formatting");
        if (label) quill.root.setAttribute("aria-label", label);
      }
      quill.setContents(sanitizeDelta(initialRef.current) as never, "silent");
      quillRef.current = quill;
      resolveImages();

      const onTextChange = () => {
        const delta = sanitizeDelta(quill.getContents());
        onChangeRef.current?.(delta, plainFromDelta(delta));
        resolveImages();
      };
      quill.on("text-change", onTextChange);
      dispose = () => {
        quill.off("text-change", onTextChange);
        host.replaceChildren();
        quillRef.current = null;
      };
    });

    return () => {
      disposed = true;
      dispose();
      for (const request of cache.values()) void request.then((url) => URL.revokeObjectURL(url)).catch(() => {});
      cache.clear();
    };
  }, [readOnly, placeholder, label]);

  return <div ref={hostRef} className={readOnly ? "rich-note rich-note-view" : "rich-note rich-note-edit"} />;
}
