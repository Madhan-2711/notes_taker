"use client";

import Image from "next/image";
import { useAttachmentImageUrl } from "../hooks/useAttachmentImageUrl";
import { parseNoteParts } from "../lib/inlineImages";

function InlineImage({ noteId, userId, privateKey, id, alt }: { noteId: string; userId: string; privateKey: CryptoKey | null; id: string; alt: string }) {
  const { url, error } = useAttachmentImageUrl(noteId, userId, privateKey, id, alt);

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
