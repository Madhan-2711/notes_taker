"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { attachmentAccess, downloadAttachment } from "../lib/services/attachments";
import { parseNoteParts } from "../lib/inlineImages";

function InlineImage({ noteId, userId, privateKey, id, alt }: { noteId: string; userId: string; privateKey: CryptoKey | null; id: string; alt: string }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    let objectUrl = "";
    void (async () => {
      try {
        const { key } = await attachmentAccess(noteId, userId, privateKey);
        const blob = await downloadAttachment({ path: `notes/${noteId}/attachments/${id}`, name: alt, size: 0, uploader: "" }, key);
        if (!active) return;
        objectUrl = URL.createObjectURL(new Blob([blob], { type: "image/webp" }));
        setUrl(objectUrl);
      } catch {
        if (active) setError(true);
      }
    })();
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [noteId, userId, privateKey, id, alt]);

  return <figure className="my-5 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-2">
    {url ? <Image src={url} alt={alt || "Note image"} width={1200} height={800} unoptimized className="mx-auto max-h-[65dvh] w-auto max-w-full object-contain" />
      : <p role="status" className="p-4 text-sm text-slate-600">{error ? "Image unavailable. Check your access or connection." : "Loading image…"}</p>}
    {alt && <figcaption className="px-2 py-1 text-xs text-slate-600">{alt}</figcaption>}
  </figure>;
}

export function InlineNoteContent({ content, noteId, userId, privateKey }: { content: string; noteId: string; userId?: string; privateKey: CryptoKey | null }) {
  return <div className="break-words text-lg leading-[1.85] text-slate-800">
    {parseNoteParts(content).map((part, index) => part.kind === "text"
      ? <span key={index} className="whitespace-pre-wrap">{part.value}</span>
      : userId ? <InlineImage key={`${part.id}:${index}`} noteId={noteId} userId={userId} privateKey={privateKey} id={part.id} alt={part.alt} />
        : <span key={index} className="text-sm text-slate-600">[Image requires sign-in]</span>)}
  </div>;
}
